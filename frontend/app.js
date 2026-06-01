const STORE = "fincoob_personal_v1";
const OLD_STORES = ["fincoob_app_v4", "fincoob_app_v3"];

const categories = [
  { name: "Alimentação", words: ["restaurante", "lanche", "ifood", "padaria", "pizza", "burger", "cafe", "açaí", "acai"] },
  { name: "Mercado", words: ["mercado", "supermercado", "atacadao", "atacadão", "savegnago", "carrefour", "pao de acucar", "extra"] },
  { name: "Transporte", words: ["uber", "99", "combustivel", "combustível", "posto", "gasolina", "alcool", "etanol", "pedagio", "pedágio"] },
  { name: "Moradia", words: ["aluguel", "condominio", "condomínio", "energia", "cpfl", "agua", "água", "internet", "vivo", "claro", "tim"] },
  { name: "Saúde", words: ["farmacia", "farmácia", "drogaria", "consulta", "medico", "médico", "hospital", "exame"] },
  { name: "Educação", words: ["faculdade", "curso", "livro", "escola", "unifafibe", "udemy"] },
  { name: "Lazer", words: ["cinema", "bar", "show", "netflix", "spotify", "prime", "jogo"] },
  { name: "Compras", words: ["amazon", "mercadolivre", "mercado livre", "magazine", "shein", "shopee", "loja"] },
  { name: "Assinaturas", words: ["assinatura", "mensalidade", "google", "apple", "microsoft", "adobe"] },
  { name: "Contas", words: ["boleto", "fatura", "tarifa", "juros", "iof", "anuidade"] },
  { name: "Outros", words: [] }
];

const payments = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto", "Transferência", "Outro"];

let state = emptyState();
let charts = {};
let pendingImport = [];

const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date = today()) => String(date).slice(0, 7);
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function emptyState() {
  return { version: 1, theme: "light", entries: [] };
}

function reportError(scope, error) {
  window.fincoobLastError = { scope, message: error?.message || String(error), stack: error?.stack || "", at: new Date().toISOString() };
  console.error(`[Fincoob] ${scope}`, error);
  toast(`Erro em ${scope}.`, "error");
}

function safe(scope, fn) {
  try { return fn(); } catch (error) { reportError(scope, error); return null; }
}

function parseMoney(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return NaN;
  const negative = /(^-|^\(|\sD$|\sDEBITO$|\sDÉBITO$)/i.test(value);
  value = value.replace(/[R$\s]/g, "").replace(/[()]/g, "").replace(/[^\d,.-]/g, "");
  if (!value || value === "-" || value === ",") return NaN;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) value = value.replace(/,/g, "");
  else value = value.replace(",", ".");
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return negative ? -Math.abs(parsed) : parsed;
}

function moneyInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

function parseDate(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const iso = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const br = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const ofx = value.match(/(\d{4})(\d{2})(\d{2})/);
  return ofx ? `${ofx[1]}-${ofx[2]}-${ofx[3]}` : "";
}

function classify(description) {
  const text = normalize(description);
  const found = categories.find((category) => category.words.some((word) => text.includes(normalize(word))));
  return found?.name || "Outros";
}

function normalizeEntry(entry) {
  const amount = Math.abs(Number(entry.amount || 0));
  const type = entry.type === "income" || entry.type === "receita" ? "income" : "expense";
  const date = parseDate(entry.date || entry.data || today());
  if (!date || !Number.isFinite(amount) || amount <= 0) return null;
  const description = String(entry.description || entry.descricao || entry.memo || "Lançamento").trim().slice(0, 120);
  return {
    id: String(entry.id || uid()),
    type,
    date,
    description,
    amount,
    category: String(entry.category || entry.categoria || classify(description)),
    payment: String(entry.payment || entry.pagamento || "Outro"),
    note: String(entry.note || entry.observacao || ""),
    source: String(entry.source || "manual"),
    createdAt: entry.createdAt || new Date().toISOString()
  };
}

function load() {
  try {
    state = { ...emptyState(), ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    state = emptyState();
  }
  if (!Array.isArray(state.entries) || !state.entries.length) migrateOldData();
  state.entries = (state.entries || []).map(normalizeEntry).filter(Boolean);
  save();
}

function migrateOldData() {
  for (const key of OLD_STORES) {
    try {
      const old = JSON.parse(localStorage.getItem(key) || "{}");
      if (!Array.isArray(old.transactions) || !old.transactions.length) continue;
      state.theme = old.theme || state.theme;
      state.entries = old.transactions.map((item) => normalizeEntry({
        id: item.id,
        type: item.type === "receita" ? "income" : "expense",
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
        payment: item.payment,
        note: item.note,
        source: "migração"
      })).filter(Boolean);
      return;
    } catch {}
  }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function toast(message, type = "success") {
  const box = $("toast");
  if (!box) return;
  box.textContent = message;
  box.className = `toast ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add("hidden"), 2800);
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  $("btnTheme").textContent = theme === "dark" ? "Tema escuro" : "Tema claro";
  save();
  renderCharts();
}

function fillOptions() {
  const categoryOptions = categories.map((category) => `<option>${category.name}</option>`).join("");
  $("category").innerHTML = categoryOptions;
  $("filterCategory").innerHTML = `<option value="">Todas as categorias</option>${categoryOptions}`;
  $("quickCategories").innerHTML = ["Mercado", "Alimentação", "Transporte", "Saúde", "Contas"].map((name) => `<button class="chip" type="button" data-category="${name}">${name}</button>`).join("");
}

function bind() {
  $("btnTheme").onclick = () => safe("tema", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  $("btnExport").onclick = () => safe("exportação", exportCsv);
  $("expenseForm").onsubmit = (event) => safe("salvar gasto", () => saveExpense(event));
  $("btnCancelEdit").onclick = () => safe("cancelar edição", resetForm);
  $("amount").oninput = (event) => { event.target.value = moneyInput(event.target.value); };
  $("amount").onblur = () => safe("validar valor", () => validateSingleField("amount"));
  $("description").oninput = () => safe("sugerir categoria", suggestCategory);
  $("description").onblur = () => safe("validar descrição", () => validateSingleField("description"));
  $("date").onblur = () => safe("validar data", () => validateSingleField("date"));
  $("quickCategories").onclick = (event) => safe("categoria rápida", () => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    $("category").value = button.dataset.category;
  });
  ["filterMonth", "filterCategory", "searchText"].forEach((id) => { $(id).oninput = () => safe(`filtro ${id}`, render); });
  $("btnClearFilters").onclick = () => safe("limpar filtros", () => { $("searchText").value = ""; $("filterCategory").value = ""; render(); });
  $("entriesTable").onclick = (event) => safe("ações da tabela", () => tableAction(event));
  $("statementFile").onchange = (event) => safe("importar arquivo", () => readStatementFile(event));
  $("btnParsePaste").onclick = () => safe("analisar texto", () => analyzeStatementText($("statementPaste").value, "texto colado"));
  $("btnImportDetected").onclick = () => safe("importar detectados", importDetected);
  $("btnClearData").onclick = () => safe("limpar dados", clearData);
  document.addEventListener("keydown", (event) => safe("atalhos", () => handleShortcuts(event)));
  bindDropArea();
}

function saveExpense(event) {
  event.preventDefault();
  if (!validateExpenseForm()) return;
  const id = $("expenseId").value;
  const amount = parseMoney($("amount").value);
  const entry = normalizeEntry({
    id: id || uid(),
    type: "expense",
    amount,
    description: $("description").value,
    category: $("category").value,
    date: $("date").value,
    payment: $("payment").value,
    note: $("note").value,
    source: id ? state.entries.find((item) => item.id === id)?.source || "manual" : "manual",
    createdAt: state.entries.find((item) => item.id === id)?.createdAt
  });
  if (!entry) return toast("Revise valor, descrição e data.", "error");
  state.entries = id ? state.entries.map((item) => item.id === id ? entry : item) : [entry, ...state.entries];
  save();
  resetForm();
  render();
  toast(id ? "Gasto atualizado." : "Gasto salvo.");
}

function resetForm() {
  $("expenseForm").reset();
  $("expenseId").value = "";
  $("date").value = today();
  $("payment").value = "Pix";
  $("category").value = "Outros";
  $("btnCancelEdit").classList.add("hidden");
  clearFieldErrors();
  $("categorySuggestion").classList.add("hidden");
}

function validateExpenseForm() {
  clearFieldErrors();
  const checks = [
    ["amount", "Informe um valor maior que zero.", () => parseMoney($("amount").value) > 0],
    ["description", "Descreva o gasto com pelo menos 3 caracteres.", () => $("description").value.trim().length >= 3],
    ["date", "Informe uma data válida.", () => Boolean(parseDate($("date").value))]
  ];
  const firstInvalid = checks.find(([, , valid]) => !valid());
  if (!firstInvalid) return true;
  showFieldError(firstInvalid[0], firstInvalid[1]);
  $(firstInvalid[0]).focus();
  toast("Corrija o campo destacado.", "error");
  return false;
}

function validateSingleField(id) {
  const rules = {
    amount: ["Informe um valor maior que zero.", () => !$("amount").value || parseMoney($("amount").value) > 0],
    description: ["A descrição precisa ter pelo menos 3 caracteres.", () => !$("description").value || $("description").value.trim().length >= 3],
    date: ["Informe uma data válida.", () => !$("date").value || Boolean(parseDate($("date").value))]
  };
  const rule = rules[id];
  if (!rule) return;
  clearFieldError(id);
  if (!rule[1]()) showFieldError(id, rule[0]);
}

function showFieldError(id, message) {
  $(id)?.classList.add("is-invalid");
  const box = $(`error-${id}`);
  if (box) box.textContent = message;
}

function clearFieldError(id) {
  $(id)?.classList.remove("is-invalid");
  const box = $(`error-${id}`);
  if (box) box.textContent = "";
}

function clearFieldErrors() {
  ["amount", "description", "date"].forEach(clearFieldError);
}

function suggestCategory() {
  clearFieldError("description");
  const description = $("description").value.trim();
  const suggestion = classify(description);
  const box = $("categorySuggestion");
  if (description.length < 3 || suggestion === "Outros" || $("category").value === suggestion) {
    box.classList.add("hidden");
    return;
  }
  box.innerHTML = `<span>Categoria sugerida: <strong>${esc(suggestion)}</strong></span><button type="button" data-use-suggestion="${esc(suggestion)}">Usar</button>`;
  box.classList.remove("hidden");
  box.querySelector("button").onclick = () => {
    $("category").value = suggestion;
    box.classList.add("hidden");
  };
}

function handleShortcuts(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    $("expenseForm").requestSubmit();
  }
  if (event.key === "Escape" && $("expenseId").value) resetForm();
}

function bindDropArea() {
  const area = document.querySelector(".drop-area");
  if (!area) return;
  ["dragenter", "dragover"].forEach((eventName) => area.addEventListener(eventName, (event) => {
    event.preventDefault();
    area.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => area.addEventListener(eventName, (event) => {
    event.preventDefault();
    area.classList.remove("is-dragging");
  }));
  area.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    readStatementFile({ target: { files: [file], value: "" } });
  });
}

function filteredEntries() {
  const month = $("filterMonth").value || monthKey();
  const category = $("filterCategory").value;
  const search = normalize($("searchText").value);
  return state.entries
    .filter((entry) => monthKey(entry.date) === month)
    .filter((entry) => !category || entry.category === category)
    .filter((entry) => !search || normalize(`${entry.description} ${entry.note} ${entry.category}`).includes(search))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function totals(rows = filteredEntries()) {
  const expenses = rows.filter((entry) => entry.type === "expense");
  const income = rows.filter((entry) => entry.type === "income");
  return {
    expenses,
    income,
    expenseTotal: expenses.reduce((sum, entry) => sum + entry.amount, 0),
    incomeTotal: income.reduce((sum, entry) => sum + entry.amount, 0)
  };
}

function groupByCategory(expenses) {
  const map = {};
  expenses.forEach((entry) => { map[entry.category] = (map[entry.category] || 0) + entry.amount; });
  return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function groupByDay(expenses) {
  const map = {};
  expenses.forEach((entry) => { map[entry.date] = (map[entry.date] || 0) + entry.amount; });
  return Object.entries(map).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
}

function render() {
  const rows = filteredEntries();
  const summary = totals(rows);
  const topCategories = groupByCategory(summary.expenses);
  const daysWithExpense = new Set(summary.expenses.map((entry) => entry.date)).size || 1;
  $("kpiExpenses").textContent = brl(summary.expenseTotal);
  $("kpiExpenseCount").textContent = `${summary.expenses.length} gastos registrados`;
  $("kpiDailyAverage").textContent = brl(summary.expenseTotal / daysWithExpense);
  $("kpiTopCategory").textContent = topCategories[0]?.category || "-";
  $("kpiTopCategoryValue").textContent = topCategories[0] ? brl(topCategories[0].amount) : "Sem dados";
  $("kpiIncome").textContent = brl(summary.incomeTotal);
  $("categoryChartHint").textContent = ($("filterMonth").value || monthKey()).split("-").reverse().join("/");
  renderInsights(rows, summary, topCategories);
  renderTable(rows);
  renderCharts(rows);
}

function renderInsights(rows, summary, topCategories) {
  const largest = summary.expenses.slice().sort((a, b) => b.amount - a.amount)[0];
  const recurring = recurringExpenses(summary.expenses)[0];
  const balance = summary.incomeTotal - summary.expenseTotal;
  const cards = [
    topCategories[0]
      ? `<article class="insight-card"><strong>Categoria que mais pesa</strong><span>${esc(topCategories[0].category)} representa ${percent(topCategories[0].amount, summary.expenseTotal)} dos gastos do mês.</span></article>`
      : `<article class="insight-card"><strong>Sem gastos no período</strong><span>Adicione um gasto ou importe um extrato para gerar a análise.</span></article>`,
    largest
      ? `<article class="insight-card"><strong>Maior gasto</strong><span>${esc(largest.description)} em ${formatDate(largest.date)}: ${brl(largest.amount)}.</span></article>`
      : "",
    recurring
      ? `<article class="insight-card"><strong>Possível recorrência</strong><span>${esc(recurring.name)} apareceu ${recurring.count} vezes, somando ${brl(recurring.total)}.</span></article>`
      : `<article class="insight-card"><strong>Saldo do extrato</strong><span>${summary.incomeTotal ? `Entradas menos gastos: ${brl(balance)}.` : "Cadastre entradas via extrato para comparar com os gastos."}</span></article>`
  ];
  $("insights").innerHTML = cards.join("");
}

function recurringExpenses(expenses) {
  const map = {};
  expenses.forEach((entry) => {
    const name = normalize(entry.description).replace(/\d+/g, "").replace(/\s+/g, " ").trim().slice(0, 28);
    if (!name) return;
    map[name] = map[name] || { name: entry.description, count: 0, total: 0 };
    map[name].count += 1;
    map[name].total += entry.amount;
  });
  return Object.values(map).filter((item) => item.count > 1).sort((a, b) => b.total - a.total);
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function renderTable(rows) {
  $("entriesTable").innerHTML = rows.length ? rows.map((entry) => `
    <tr>
      <td>${formatDate(entry.date)}</td>
      <td><strong>${esc(entry.description)}</strong>${entry.note ? `<br><small>${esc(entry.note)}</small>` : ""}</td>
      <td>${esc(entry.category)}</td>
      <td>${esc(entry.payment)}</td>
      <td><span class="pill ${entry.type}">${esc(entry.source)}</span></td>
      <td class="right amount-${entry.type}">${entry.type === "expense" ? "-" : "+"}${brl(entry.amount)}</td>
      <td><div class="row-actions"><button class="mini-btn" data-action="edit" data-id="${entry.id}">Editar</button><button class="mini-btn" data-action="delete" data-id="${entry.id}">Excluir</button></div></td>
    </tr>
  `).join("") : `<tr><td colspan="7">Nenhum lançamento encontrado.</td></tr>`;
}

function tableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const entry = state.entries.find((item) => item.id === button.dataset.id);
  if (!entry) return;
  if (button.dataset.action === "delete") {
    if (!confirm("Excluir este lançamento?")) return;
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    save();
    render();
    return;
  }
  if (entry.type === "income") return toast("Entradas importadas não são editadas no formulário de gasto.", "warning");
  $("expenseId").value = entry.id;
  $("amount").value = moneyInput(String(Math.round(entry.amount * 100)));
  $("description").value = entry.description;
  $("category").value = entry.category;
  $("date").value = entry.date;
  $("payment").value = entry.payment;
  $("note").value = entry.note || "";
  $("btnCancelEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function chart(id, config) {
  const canvas = $(id);
  if (!canvas || !window.Chart) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, config);
}

function chartOptions() {
  const style = getComputedStyle(document.documentElement);
  const text = style.getPropertyValue("--text").trim();
  const soft = style.getPropertyValue("--text-soft").trim();
  const border = style.getPropertyValue("--border").trim();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: text } } },
    scales: {
      x: { ticks: { color: soft }, grid: { color: border } },
      y: { beginAtZero: true, ticks: { color: soft }, grid: { color: border } }
    }
  };
}

function renderCharts(rows = filteredEntries()) {
  const style = getComputedStyle(document.documentElement);
  const palette = ["--danger", "--primary", "--accent", "--warning", "--success"].map((name) => style.getPropertyValue(name).trim());
  const expenseRows = rows.filter((entry) => entry.type === "expense");
  const categoriesData = groupByCategory(expenseRows);
  const dayData = groupByDay(expenseRows);
  chart("categoryChart", {
    type: "doughnut",
    data: { labels: categoriesData.map((item) => item.category), datasets: [{ data: categoriesData.map((item) => item.amount), backgroundColor: palette }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: style.getPropertyValue("--text").trim() } } } }
  });
  chart("dailyChart", {
    type: "bar",
    data: { labels: dayData.map((item) => formatDate(item.date, true)), datasets: [{ label: "Gastos", data: dayData.map((item) => item.amount), backgroundColor: style.getPropertyValue("--danger").trim() }] },
    options: chartOptions()
  });
}

async function readStatementFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  $("importStatus").textContent = file.name;
  const ext = file.name.split(".").pop().toLowerCase();
  if ((ext === "xlsx" || ext === "xls") && window.XLSX) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    analyzeRows(rows, file.name);
    return;
  }
  analyzeStatementText(await file.text(), file.name);
  event.target.value = "";
}

function analyzeStatementText(text, source) {
  if (!String(text || "").trim()) return toast("Cole ou selecione um extrato primeiro.", "error");
  if (/<OFX|<STMTTRN/i.test(text)) return analyzeOfx(text, source);
  const rows = String(text).split(/\r?\n/).map((line) => splitCsvLine(line)).filter((row) => row.some((cell) => String(cell).trim()));
  analyzeRows(rows, source);
}

function splitCsvLine(line) {
  const delimiter = [";", "\t", ","].sort((a, b) => line.split(b).length - line.split(a).length)[0];
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function analyzeRows(rows, source) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => /data|date|descri|hist[oó]rico|valor|amount|debito|cr[eé]dito/i.test(String(cell))));
  let parsed = [];
  if (headerIndex >= 0) parsed = parseRowsWithHeader(rows.slice(headerIndex));
  if (!parsed.length) parsed = parseRowsByPattern(rows);
  setImportPreview(parsed.map((entry) => ({ ...entry, source })));
}

function parseRowsWithHeader(rows) {
  const headers = rows[0].map((cell) => normalize(cell));
  const find = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const dateIndex = find("data", "date", "dt");
  const descIndex = find("descricao", "historico", "memo", "lancamento", "nome", "estabelecimento");
  const amountIndex = find("valor", "amount", "total");
  const debitIndex = find("debito", "saida");
  const creditIndex = find("credito", "entrada");
  return rows.slice(1).map((row) => {
    const date = parseDate(row[dateIndex]);
    const description = String(row[descIndex] || row.find((cell, i) => i !== dateIndex && i !== amountIndex && i !== debitIndex && i !== creditIndex) || "").trim();
    let rawAmount = amountIndex >= 0 ? parseMoney(row[amountIndex]) : NaN;
    let type = rawAmount < 0 ? "expense" : "income";
    if (!Number.isFinite(rawAmount) && debitIndex >= 0 && row[debitIndex]) { rawAmount = parseMoney(row[debitIndex]); type = "expense"; }
    if ((!Number.isFinite(rawAmount) || rawAmount === 0) && creditIndex >= 0 && row[creditIndex]) { rawAmount = parseMoney(row[creditIndex]); type = "income"; }
    if (debitIndex >= 0 && row[debitIndex]) type = "expense";
    const entry = normalizeEntry({ date, description, amount: Math.abs(rawAmount), type, category: classify(description), payment: "Extrato", source: "extrato" });
    return entry;
  }).filter(Boolean);
}

function parseRowsByPattern(rows) {
  return rows.map((row) => {
    const line = row.join(" ");
    const date = parseDate(line);
    const moneyMatches = line.match(/-?\(?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}\)?|-?\d+\.\d{2}/g);
    const rawMoney = moneyMatches?.at(-1);
    const amount = parseMoney(rawMoney);
    const description = line.replace(rawMoney || "", "").replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/, "").trim();
    return normalizeEntry({ date, description, amount: Math.abs(amount), type: amount < 0 ? "expense" : "income", category: classify(description), payment: "Extrato", source: "extrato" });
  }).filter(Boolean);
}

function analyzeOfx(text, source) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  const parsed = blocks.map((block) => {
    const get = (tag) => (block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i")) || [])[1] || "";
    const amount = parseMoney(get("TRNAMT"));
    const description = get("MEMO") || get("NAME") || get("TRNTYPE") || "Lançamento";
    return normalizeEntry({ date: parseDate(get("DTPOSTED")), description, amount: Math.abs(amount), type: amount < 0 ? "expense" : "income", category: classify(description), payment: "Extrato", source });
  }).filter(Boolean);
  setImportPreview(parsed);
}

function isDuplicate(entry) {
  return state.entries.some((item) =>
    item.date === entry.date &&
    item.type === entry.type &&
    Math.abs(item.amount - entry.amount) < 0.01 &&
    normalize(item.description) === normalize(entry.description)
  );
}

function setImportPreview(entries) {
  pendingImport = entries.map((entry) => ({ ...entry, duplicate: isDuplicate(entry) }));
  const expenses = pendingImport.filter((entry) => entry.type === "expense");
  const income = pendingImport.filter((entry) => entry.type === "income");
  const duplicated = pendingImport.filter((entry) => entry.duplicate);
  $("importSummary").classList.remove("hidden");
  $("importSummary").innerHTML = `
    <article class="insight-card"><strong>${pendingImport.length}</strong><span>linhas reconhecidas</span></article>
    <article class="insight-card"><strong>${expenses.length}</strong><span>gastos detectados</span></article>
    <article class="insight-card"><strong>${brl(expenses.reduce((s, e) => s + e.amount, 0))}</strong><span>total de gastos</span></article>
    <article class="insight-card"><strong>${duplicated.length}</strong><span>possíveis duplicados</span></article>
  `;
  $("importPreview").classList.remove("hidden");
  $("importPreview").innerHTML = pendingImport.slice(0, 60).map((entry) => `
    <div class="import-line ${entry.duplicate ? "duplicate" : ""}">
      <strong>${formatDate(entry.date)}</strong>
      <div><strong>${esc(entry.description)}</strong><span>${esc(entry.category)}</span></div>
      <span class="pill ${entry.type}">${entry.type === "expense" ? "gasto" : "entrada"}</span>
      <strong class="amount-${entry.type}">${entry.type === "expense" ? "-" : "+"}${brl(entry.amount)}</strong>
    </div>
  `).join("") || `<div class="insight-card">Nenhum lançamento reconhecido.</div>`;
  $("btnImportDetected").classList.toggle("hidden", !pendingImport.some((entry) => !entry.duplicate));
  toast(`${pendingImport.length} linhas reconhecidas no extrato.`);
}

function importDetected() {
  const entries = pendingImport.filter((entry) => !entry.duplicate).map(({ duplicate, ...entry }) => ({ ...entry, id: uid(), createdAt: new Date().toISOString() }));
  if (!entries.length) return toast("Nada novo para importar.", "warning");
  state.entries = [...entries, ...state.entries];
  save();
  pendingImport = [];
  $("importPreview").classList.add("hidden");
  $("importSummary").classList.add("hidden");
  $("btnImportDetected").classList.add("hidden");
  render();
  toast(`${entries.length} lançamentos importados.`);
}

function exportCsv() {
  const rows = [["data", "tipo", "descricao", "categoria", "pagamento", "valor", "origem"]];
  state.entries.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((entry) => {
    rows.push([entry.date, entry.type, entry.description, entry.category, entry.payment, entry.amount.toFixed(2), entry.source]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `fincoob-gastos-${today()}.csv`);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function clearData() {
  if (!confirm("Apagar todos os lançamentos do Fincoob simplificado?")) return;
  const theme = state.theme;
  state = emptyState();
  state.theme = theme;
  save();
  render();
}

function formatDate(date, short = false) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-BR", short ? { day: "2-digit", month: "2-digit" } : undefined);
}

function init() {
  load();
  fillOptions();
  $("filterMonth").value = monthKey();
  $("date").value = today();
  bind();
  setTheme(state.theme || "light");
  resetForm();
  render();
}

window.addEventListener("error", (event) => reportError("erro global", event.error || event.message));
window.addEventListener("unhandledrejection", (event) => reportError("erro assíncrono", event.reason));
window.addEventListener("DOMContentLoaded", () => safe("inicialização", init));
