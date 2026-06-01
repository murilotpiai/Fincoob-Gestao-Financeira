const instructions = `
Voce e o conselheiro financeiro do Fincoob, um assistente treinado para educacao financeira pessoal.
Responda sempre em portugues do Brasil, com tom direto, pratico e respeitoso.
Use os dados enviados pelo app para apontar padroes de gastos, prioridades, metas simples e proximas acoes.
Nao prometa rentabilidade, nao recomende investimentos especificos como garantia e nao substitua consultoria financeira profissional.
Quando faltarem dados, explique o que registrar para melhorar a analise.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY nao configurada no servidor." });
  }

  const { question, summary } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Pergunta invalida." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions,
        input: `Dados financeiros do usuario:\n${JSON.stringify(summary || {}, null, 2)}\n\nPergunta do usuario:\n${question}`,
        temperature: 0.4,
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Erro ao chamar a OpenAI." });
    }

    return res.status(200).json({ answer: extractText(data) });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Erro inesperado no assistente." });
  }
}

function extractText(data) {
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim() || "Nao consegui gerar uma resposta agora.";
}
