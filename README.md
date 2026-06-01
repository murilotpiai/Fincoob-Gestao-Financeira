# Fincoob - Gestao Financeira Pessoal

Aplicativo web para controle de gastos pessoais, feito com HTML, CSS e JavaScript puro. A proposta atual do Fincoob e ser simples, rapido e eficiente: registrar despesas, importar extratos, analisar o mes e receber dicas financeiras com apoio de IA.

- Repositorio: https://github.com/murilotpiai/Fincoob-Gestao-Financeira

## Objetivo

Criar uma ferramenta pessoal para entender para onde o dinheiro esta indo, sem excesso de telas e sem burocracia. O foco e facilitar o registro de gastos e transformar os dados em relatorios claros para tomada de decisao.

## Funcionalidades

- Cadastro rapido de gastos com valor, descricao, categoria, data, pagamento e observacao.
- Sugestao automatica de categoria com base na descricao.
- Relatorio mensal com total de gastos, media diaria, maior categoria e entradas detectadas.
- Graficos de gastos por categoria e evolucao diaria.
- Historico editavel de lancamentos.
- Importacao e analise de extratos em CSV, TXT, OFX, XLS e XLSX.
- Deteccao de possiveis duplicados ao importar extratos.
- Exportacao dos lancamentos em CSV.
- Tema claro e escuro com visual futurista.
- Segunda pagina com assistente financeiro IA.
- Modo local de conselhos quando o site e aberto pelo arquivo `file://`.
- Endpoint seguro para conectar com a OpenAI sem expor a chave no navegador.

## Assistente IA

A pagina `frontend/ia.html` le os dados salvos no LocalStorage do Fincoob e permite conversar com um assistente financeiro. Quando o site esta rodando apenas como arquivo local, o assistente usa uma analise local simples. Quando publicado com backend/serverless, ele chama o endpoint:

```text
frontend/api/finance-coach.js
```

Para ativar o GPT real no servidor, configure as variaveis de ambiente:

```env
OPENAI_API_KEY=sua_chave_da_openai
OPENAI_MODEL=gpt-4.1-mini
```

Nunca coloque a chave da OpenAI dentro do HTML, CSS ou JavaScript publico.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- LocalStorage
- Chart.js
- SheetJS
- OpenAI Responses API
- Vercel/serverless para o endpoint da IA

## Como executar localmente

Abra o arquivo abaixo no navegador:

```text
frontend/index.html
```

Para acessar o assistente:

```text
frontend/ia.html
```

## Como publicar com IA

1. Publique a pasta `frontend` como raiz do projeto em uma plataforma que suporte rotas serverless, como Vercel.
2. Configure `OPENAI_API_KEY` nas variaveis de ambiente.
3. Acesse o site pela URL publicada, nao pelo `file://`.
4. A pagina da IA chamara automaticamente `/api/finance-coach`.

## Estrutura

```text
Fincoob-Gestao-Financeira-main/
|-- frontend/
|   |-- api/
|   |   `-- finance-coach.js
|   |-- .env.example
|   |-- ai.js
|   |-- app.js
|   |-- ia.html
|   |-- index.html
|   `-- style.css
|-- docs/
|-- README.md
`-- .gitignore
```

## Autor

Desenvolvido por Murilo Turcato Piai.

- LinkedIn: https://www.linkedin.com/in/mtpiai
- GitHub: https://github.com/murilotpiai
