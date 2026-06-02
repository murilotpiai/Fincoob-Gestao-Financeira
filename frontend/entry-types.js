(function () {
  const incomeCategoriesPatch = [
    { name: "Salário", words: ["salario", "salário", "pagamento", "folha"] },
    { name: "Freelance", words: ["freela", "freelance", "serviço", "servico", "projeto"] },
    { name: "Vendas", words: ["venda", "cliente", "produto"] },
    { name: "Investimentos", words: ["dividendo", "rendimento", "juros", "investimento"] },
    { name: "Reembolso", words: ["reembolso", "estorno", "devolucao", "devolução"] },
    { name: "Presente", words: ["presente", "pix recebido", "ajuda"] },
    { name: "Outros", words: [] }
  ];

  const expenseCategoriesPatch = [
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

  const expenseQuickPatch = ["Mercado", "Alimentação", "Transporte", "Saúde", "Contas"];
  const incomeQuickPatch = ["Salário", "Freelance", "Vendas", "Reembolso", "Investimentos"];
  const byId = (id) => document.getElementById(id);

  currentEntryType = function () {
    return document.querySelector('input[name="entryType"]:checked')?.value || "expense";
  };

  categorySetFor = function (type = currentEntryType()) {
    return type === "income" ? incomeCategoriesPatch : expenseCategoriesPatch;
  };

  classifyIncome = function (description) {
    const text = normalize(description);
    const found = incomeCategoriesPatch.find((category) => category.words.some((word) => text.includes(normalize(word))));
    return found?.name || "Outros";
  };

  fillOptions = function (type = currentEntryType(), selected = "") {
    const currentCategories = categorySetFor(type);
    const options = currentCategories.map((category) => `<option>${category.name}</option>`).join("");
    const allCategories = [...new Set([...expenseCategoriesPatch, ...incomeCategoriesPatch].map((category) => category.name))];
    byId("category").innerHTML = options;
    byId("filterCategory").innerHTML = `<option value="">Todas as categorias</option>${allCategories.map((name) => `<option>${name}</option>`).join("")}`;
    const defaultCategory = type === "income" ? incomeCategoriesPatch[0].name : "Outros";
    byId("category").value = selected && currentCategories.some((category) => category.name === selected) ? selected : defaultCategory;
    const quick = type === "income" ? incomeQuickPatch : expenseQuickPatch;
    byId("quickCategories").innerHTML = quick.map((name) => `<button class="chip" type="button" data-category="${name}">${name}</button>`).join("");
  };

  setEntryType = function (type = "expense", selectedCategory = "") {
    const safeType = type === "income" ? "income" : "expense";
    const radio = safeType === "income" ? byId("typeIncome") : byId("typeExpense");
    if (radio) radio.checked = true;
    fillOptions(safeType, selectedCategory);
    const editing = Boolean(byId("expenseId").value);
    byId("expenseForm").classList.toggle("is-income", safeType === "income");
    byId("expenseForm").classList.toggle("is-expense", safeType === "expense");
    byId("formTitle").textContent = `${editing ? "Editar" : "Adicionar"} ${safeType === "income" ? "receita" : "gasto"}`;
    byId("btnSaveEntry").textContent = `${editing ? "Atualizar" : "Salvar"} ${safeType === "income" ? "receita" : "gasto"}`;
    byId("description").placeholder = safeType === "income" ? "Ex.: salário, freelance, reembolso" : "Ex.: mercado, gasolina, farmácia";
    byId("categorySuggestion").classList.add("hidden");
  };

  saveExpense = function (event) {
    event.preventDefault();
    if (!validateExpenseForm()) return;
    const id = byId("expenseId").value;
    const existing = id ? state.entries.find((item) => item.id === id) : null;
    const type = currentEntryType();
    const amount = parseMoney(byId("amount").value);
    const description = byId("description").value.trim();
    const entry = normalizeEntry({
      id: id || uid(),
      type,
      amount,
      description,
      category: byId("category").value || (type === "income" ? classifyIncome(description) : classify(description)),
      date: byId("date").value,
      payment: byId("payment").value,
      note: byId("note").value,
      source: existing?.source || "manual",
      createdAt: existing?.createdAt
    });
    if (!entry) return toast("Revise valor, descrição e data.", "error");
    state.entries = id ? state.entries.map((item) => item.id === id ? entry : item) : [entry, ...state.entries];
    save();
    resetForm();
    render();
    const label = type === "income" ? "Receita" : "Gasto";
    toast(id ? `${label} atualizado.` : `${label} salvo.`);
  };

  resetForm = function () {
    byId("expenseForm").reset();
    byId("expenseId").value = "";
    byId("typeExpense").checked = true;
    fillOptions("expense", "Outros");
    byId("date").value = today();
    byId("payment").value = "Pix";
    byId("category").value = "Outros";
    byId("btnCancelEdit").classList.add("hidden");
    clearFieldErrors();
    byId("categorySuggestion").classList.add("hidden");
    setEntryType("expense", "Outros");
  };

  validateExpenseForm = function () {
    clearFieldErrors();
    const checks = [
      ["amount", "Informe um valor maior que zero.", () => parseMoney(byId("amount").value) > 0],
      ["description", "Descreva o lançamento com pelo menos 3 caracteres.", () => byId("description").value.trim().length >= 3],
      ["date", "Informe uma data válida.", () => Boolean(parseDate(byId("date").value))]
    ];
    const firstInvalid = checks.find(([, , valid]) => !valid());
    if (!firstInvalid) return true;
    showFieldError(firstInvalid[0], firstInvalid[1]);
    byId(firstInvalid[0]).focus();
    toast("Corrija o campo destacado.", "error");
    return false;
  };

  suggestCategory = function () {
    clearFieldError("description");
    const description = byId("description").value.trim();
    const type = currentEntryType();
    const suggestion = type === "income" ? classifyIncome(description) : classify(description);
    const box = byId("categorySuggestion");
    if (description.length < 3 || suggestion === "Outros" || byId("category").value === suggestion) {
      box.classList.add("hidden");
      return;
    }
    box.innerHTML = `<span>Categoria sugerida: <strong>${esc(suggestion)}</strong></span><button type="button" data-use-suggestion="${esc(suggestion)}">Usar</button>`;
    box.classList.remove("hidden");
    box.querySelector("button").onclick = () => {
      byId("category").value = suggestion;
      box.classList.add("hidden");
    };
  };

  tableAction = function (event) {
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
    byId("expenseId").value = entry.id;
    setEntryType(entry.type, entry.category);
    byId("amount").value = moneyInput(String(Math.round(entry.amount * 100)));
    byId("description").value = entry.description;
    byId("category").value = entry.category;
    byId("date").value = entry.date;
    byId("payment").value = entry.payment;
    byId("note").value = entry.note || "";
    byId("btnCancelEdit").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function bindEntryTypeControls() {
    document.querySelectorAll('input[name="entryType"]').forEach((radio) => {
      radio.onchange = () => safe("tipo de lançamento", () => setEntryType(radio.value));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEntryTypeControls);
  } else {
    bindEntryTypeControls();
  }

  window.fincoobEntryTypesLoaded = true;
})();
