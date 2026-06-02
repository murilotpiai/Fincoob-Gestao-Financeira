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

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY nao configurada no servidor." });
  }

  const { question, summary } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Pergunta invalida." });
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: instructions }]
        },
        contents: [{
          role: "user",
          parts: [{
            text: `Dados financeiros do usuario:\n${JSON.stringify(summary || {}, null, 2)}\n\nPergunta do usuario:\n${question}`
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 700
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Erro ao chamar o Gemini." });
    }

    return res.status(200).json({ answer: extractText(data) });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Erro inesperado no assistente." });
  }
}

function extractText(data) {
  const parts = data.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  return parts.map((part) => part.text || "").join("\n").trim() || "Nao consegui gerar uma resposta agora.";
}
