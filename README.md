# Fincoob - Gestao Financeira Pessoal

Fincoob e um aplicativo web para controle de gastos pessoais, importacao de extratos e analise financeira com assistente IA via Gemini. O foco do projeto e ser simples, rapido e util no dia a dia: registrar gastos com poucos campos, visualizar relatorios claros e receber sugestoes praticas de economia.

- Site publicado: https://project-739nb.vercel.app/
- Assistente IA: https://project-739nb.vercel.app/ia
- Repositorio: https://github.com/murilotpiai/Fincoob-Gestao-Financeira

## Principais recursos

- Cadastro rapido de gastos com valor, descricao, categoria, data, pagamento e observacao.
- Sugestao automatica de categoria a partir da descricao.
- Relatorio mensal com total de gastos, media diaria, maior categoria e entradas detectadas.
- Graficos com Chart.js para categoria e evolucao diaria.
- Importacao de extratos em CSV, TXT, OFX, XLS e XLSX.
- Deteccao de possiveis lancamentos duplicados.
- Historico editavel de lancamentos.
- Exportacao dos dados em CSV.
- Tema claro/escuro com visual futurista.
- Segunda pagina com assistente financeiro IA.
- Endpoint serverless seguro para Gemini, sem expor chave no navegador.

## Como funciona

O Fincoob salva os dados no `LocalStorage` do navegador. A pagina principal (`frontend/index.html`) cuida do cadastro, relatorio e importacao de extratos. A pagina de IA (`frontend/ia.html`) le o resumo financeiro salvo localmente e envia a pergunta para o endpoint:

```text
frontend/api/finance-coach.js
```

Esse endpoint roda na Vercel e chama a Gemini API usando variaveis de ambiente do servidor.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- LocalStorage
- Chart.js
- SheetJS
- Gemini API
- Vercel Serverless Functions

## Rodar localmente

Nao existe etapa de build para usar o app localmente. Abra:

```text
frontend/index.html
```

Para abrir a pagina da IA localmente:

```text
frontend/ia.html
```

Ao abrir pelo `file://`, a IA usa um modo local de fallback. Para usar Gemini de verdade, publique na Vercel.

## Deploy na Vercel

Configuracao correta do projeto:

```text
Root Directory: frontend
Build Command: vazio
Output Directory: vazio
Install Command: vazio
```

Variaveis de ambiente:

```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_MODEL` e opcional, porque o endpoint ja usa `gemini-2.5-flash` como padrao.

Importante: nunca coloque a chave do Gemini dentro de arquivos publicos como HTML, CSS ou JavaScript do frontend.

## Estrutura

```text
Fincoob-Gestao-Financeira/
|-- frontend/
|   |-- api/
|   |   `-- finance-coach.js
|   |-- .env.example
|   |-- ai.js
|   |-- app.js
|   |-- ia.html
|   |-- index.html
|   |-- style.css
|   `-- vercel.json
|-- docs/
|-- .gitignore
`-- README.md
```

## Seguranca

- A chave `GEMINI_API_KEY` fica somente nas variaveis de ambiente da Vercel.
- O navegador chama apenas `/api/finance-coach`.
- O endpoint limita a resposta e orienta a IA para educacao financeira pessoal.
- O assistente nao substitui consultoria financeira profissional.

## Autor

Desenvolvido por Murilo Turcato Piai.

- LinkedIn: https://www.linkedin.com/in/mtpiai
- GitHub: https://github.com/murilotpiai
