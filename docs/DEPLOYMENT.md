# Deploy do Fincoob

Este projeto deve ser publicado na Vercel usando a pasta `frontend` como raiz.

## Configuracao da Vercel

Em `Settings > Build and Deployment`:

```text
Root Directory: frontend
Build Command: vazio
Output Directory: vazio
Install Command: vazio
```

## Variaveis de ambiente

Em `Settings > Environment Variables`:

```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` deve ficar como confidencial.

## URLs esperadas

```text
/
/ia
/api/finance-coach
```

O endpoint `/api/finance-coach` aceita somente `POST`. Um acesso via `GET` deve retornar `405`.

## Teste rapido

```bash
curl -X POST https://project-739nb.vercel.app/api/finance-coach \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"teste rapido\",\"summary\":{\"expenseCount\":0}}"
```
