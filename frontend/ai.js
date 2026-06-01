const STORE = "fincoob_personal_v1";
const CHAT_STORE = "fincoob_ai_chat_v1";

const prompts = [
  "Analise meus gastos deste mes e me diga onde eu deveria agir primeiro.",
  "Monte um plano simples para eu economizar R$ 300 no proximo mes.",
  "Quais categorias parecem fora de controle e por que?",
  "Me ajude a criar uma regra de gasto semanal baseada no meu historico."
];

const $ = (id) => document.getElementById(id);
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const monthKey = (date = new Date().toISOString().slice(0, 10)) => String(date).slice(0, 7);

let state = { version: 1, theme: "light", entries: [] };
let chat = [];

function safe(scope, fn) {
  try { return fn(); } catch (error) { reportError(scope, error); return null; }
}

function reportError(scope, error) {
  window.fincoobAiLastError = { scope, message: error?.message || String(error), stack: error?.stack || "", at: new Date().toISOString() };
  console.error(`[Fincoob IA] ${scope}`, error);
  toast(`Erro em ${scope}.`, "error");
}

function toast(message, type = "success") {
  const box = $("toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add("hidden"), 3200);
}

function load() {
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    state = { version: 1, theme: "light", entries: [] };
  }
  if (!Array.isArray(state.entries)) state.entries = [];

  try {
    chat = JSON.parse(localStorage.getItem(CHAT_STORE) || "[]");
  } catch {
    chat = [];
  }
  if (!Array.isArray(chat)) chat = [];
}

function saveChat() {
  localStorage.setItem(CHAT_STORE, JSON.stringify(chat.slice(-24)));
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  $("btnTheme").textContent = theme === "dark" ? "Tema escuro" : "Tema claro";
  localStorage.setItem(STORE, JSON.stringify(state));
}

function getSummary() {
  const currentMonth = monthKey();
  const monthEntries = state.entries.filter((entry) => String(entry.date || "").startsWith(currentMonth));
  const expenses = monthEntries.filter((entry) => entry.type !== "income");
  const income = monthEntries.filter((entry) => entry.type === "income");
  const totalExpenses = expenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalIncome = income.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const categories = groupBy(expenses, "category");
  const payments = groupBy(expenses, "payment");
  const biggest = expenses.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 8);

  return {
    month: currentMonth,
    totalEntries: state.entries.length,
    monthEntries: monthEntries.length,
    expenseCount: expenses.length,
    incomeCount: income.length,
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
    categories,
    payments,
    biggest: biggest.map((entry) => ({
      date: entry.date,
      description: entry.description,
      category: entry.category,
      amount: Number(entry.amount || 0)
    }))
  };
}

function groupBy(entries, field) {
  const grouped = entries.reduce((acc, entry) => {
    const key = entry[field] || "Outros";
    acc[key] = (acc[key] || 0) + Number(entry.amount || 0);
    return acc;
  }, {});
  return Object.entries(grouped)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function renderSummary() {
  const summary = getSummary();
  const topCategory = summary.categories[0];
  $("aiDataSummary").innerHTML = `
    <div class="ai-data-card"><span>Gastos do mes</span><strong>${brl(summary.totalExpenses)}</strong></div>
    <div class="ai-data-card"><span>Entradas</span><strong>${brl(summary.totalIncome)}</strong></div>
    <div class="ai-data-card"><span>Saldo detectado</span><strong>${brl(summary.balance)}</strong></div>
    <div class="ai-data-card"><span>Categoria principal</span><strong>${topCategory ? esc(topCategory.name) : "Sem dados"}</strong></div>
  `;
}

function renderPrompts() {
  $("promptList").innerHTML = prompts.map((prompt) => `<button class="prompt-button" type="button">${esc(prompt)}</button>`).join("");
}

function renderChat() {
  if (!chat.length) {
    chat = [{
      role: "assistant",
      content: "Oi, eu sou o assistente financeiro do Fincoob. Posso analisar seus gastos cadastrados e transformar isso em proximas acoes simples."
    }];
  }

  $("chatMessages").innerHTML = chat.map((message) => `
    <div class="chat-message ${message.role}">
      <span>${message.role === "user" ? "Voce" : "Fincoob IA"}</span>
      <p>${formatMessage(message.content)}</p>
    </div>
  `).join("");
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

function formatMessage(content) {
  return esc(content).replace(/\n/g, "<br>");
}

function setLoading(isLoading) {
  $("btnAskAi").disabled = isLoading;
  $("btnAskAi").textContent = isLoading ? "Analisando..." : "Pedir analise";
}

async function askAdvisor(event) {
  event.preventDefault();
  const input = $("advisorQuestion");
  const question = input.value.trim();
  if (question.length < 8) return toast("Digite uma pergunta um pouco mais completa.", "warning");

  chat.push({ role: "user", content: question });
  input.value = "";
  renderChat();
  saveChat();
  setLoading(true);

  try {
    const answer = await requestAi(question, getSummary());
    chat.push({ role: "assistant", content: answer });
    saveChat();
    renderChat();
  } catch (error) {
    const fallback = buildLocalAdvice(question, getSummary());
    chat.push({ role: "assistant", content: fallback });
    saveChat();
    renderChat();
    setStatus("Modo local ativo");
    toast("GPT ainda nao esta conectado. Usei a analise local.", "warning");
  } finally {
    setLoading(false);
  }
}

async function requestAi(question, summary) {
  if (location.protocol === "file:") throw new Error("Endpoint indisponivel em arquivo local.");

  const response = await fetch("/api/finance-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, summary })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha ao consultar o assistente.");
  setStatus("GPT conectado");
  return data.answer || "Nao consegui gerar uma resposta agora.";
}

function buildLocalAdvice(question, summary) {
  if (!summary.expenseCount) {
    return "Ainda nao encontrei gastos deste mes. Cadastre alguns gastos ou importe um extrato na pagina principal; depois eu consigo analisar padroes, excessos e oportunidades de economia.";
  }

  const top = summary.categories[0];
  const second = summary.categories[1];
  const topShare = top ? Math.round((top.total / Math.max(summary.totalExpenses, 1)) * 100) : 0;
  const intent = normalize(question);
  const target = intent.match(/r\$\s?(\d+[.,]?\d*)|(\d+[.,]?\d*)\s?reais/);
  const targetValue = target ? Number(String(target[1] || target[2]).replace(",", ".")) : Math.round(summary.totalExpenses * 0.1);
  const weeklyLimit = Math.max(0, (summary.totalExpenses - targetValue) / 4);

  const lines = [
    `Neste mes voce registrou ${brl(summary.totalExpenses)} em gastos. A categoria que mais pesa e ${top.name}, com ${brl(top.total)} (${topShare}% do total).`,
    `Acao principal: defina um teto para ${top.name} e acompanhe semanalmente. Se reduzir ${brl(targetValue)} no mes, seu limite medio ficaria perto de ${brl(weeklyLimit)} por semana.`,
    second ? `Segunda frente: revise ${second.name}, que soma ${brl(second.total)}. Pequenos cortes aqui ajudam sem depender de uma unica mudanca grande.` : "Segunda frente: separe gastos fixos e variaveis para enxergar melhor o que pode ser cortado.",
    "Regra simples para os proximos 7 dias: antes de comprar, espere 10 minutos e registre o gasto previsto. Se nao for essencial, mova para uma lista de espera."
  ];

  return lines.join("\n\n");
}

function setStatus(text) {
  $("aiStatus").textContent = text;
}

function bind() {
  $("btnTheme").onclick = () => safe("tema", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  $("advisorForm").onsubmit = (event) => safe("pergunta ao assistente", () => askAdvisor(event));
  $("btnClearChat").onclick = () => safe("limpar conversa", () => {
    chat = [];
    localStorage.removeItem(CHAT_STORE);
    renderChat();
  });
  $("promptList").onclick = (event) => safe("pergunta rapida", () => {
    const button = event.target.closest(".prompt-button");
    if (!button) return;
    $("advisorQuestion").value = button.textContent;
    $("advisorQuestion").focus();
  });
}

function init() {
  load();
  bind();
  setTheme(state.theme || "light");
  renderSummary();
  renderPrompts();
  renderChat();
  setStatus(location.protocol === "file:" ? "Modo local ativo" : "Pronto para GPT");
}

window.addEventListener("error", (event) => reportError("erro global", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => reportError("erro assincrono", event.reason));
window.addEventListener("DOMContentLoaded", () => safe("inicializacao", init));
