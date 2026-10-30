# Back-end da Casa do Salgado

API REST do sistema de precificação e fichas técnicas da Casa do Salgado. Ela recebe os dados de uma receita, dos custos e das vendas, e devolve custo por salgado, preço sugerido, margem, lucro, ponto de equilíbrio e simulações.

Este documento explica como o back-end funciona por dentro. Para instalar o Docker e subir o banco pela primeira vez, siga o [README da raiz](../README.md).

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Tecnologias](#2-tecnologias)
3. [Como rodar](#3-como-rodar)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Caminho de uma requisição](#5-caminho-de-uma-requisição)
6. [Regras gerais da API](#6-regras-gerais-da-api)
7. [Rotas](#7-rotas)
8. [As fórmulas](#8-as-fórmulas)
9. [Banco de dados](#9-banco-de-dados)
10. [Testes, lint e CI](#10-testes-lint-e-ci)
11. [Variáveis de ambiente](#11-variáveis-de-ambiente)
12. [Como adicionar uma rota nova](#12-como-adicionar-uma-rota-nova)
13. [O que ainda falta](#13-o-que-ainda-falta)

---

## 1. Visão geral

```
 Front-end (React)                 Back-end (este projeto)                    Banco
 ─────────────────                 ───────────────────────                    ─────
                    POST JSON      ┌─────────────────────────────┐
  tela de preço  ───────────────▶  │ Express (src/app.js)        │
                                   │   ├─ CORS                   │
                                   │   ├─ leitura do JSON        │
                                   │   └─ /api/calculos/...      │
                                   │        │                    │
                                   │        ▼                    │
                                   │ Validação (zod)             │
                                   │        │                    │
                                   │        ▼                    │
                                   │ Motor de cálculo            │       PostgreSQL 16
                                   │ (src/modules/*.calculo.js)  │       (Docker, via Prisma)
                                   │        │                    │       ainda não usado
                                   │        ▼                    │       pelas rotas
  resultado     ◀───────────────── │ Resposta JSON               │
                    200 / 4xx      └─────────────────────────────┘
```

Hoje a API tem dois tipos de rota:

- **Rotas do sistema:** `GET /health`, a documentação Swagger em `/api/docs` e a especificação em `/api/openapi.json`.
- **Login e usuários:** `POST /api/auth/login` (público) devolve um token JWT; `GET /api/auth/eu` e `/api/usuarios` (só GESTOR). Veja a seção "Login e permissões" abaixo.
- **Rotas de cálculo:** 9 rotas `POST /api/calculos/...`. Elas recebem todos os dados no corpo da requisição, calculam e respondem. **Não gravam nada no banco.** Por isso funcionam mesmo com o banco desligado.

O banco já existe (tabelas de usuários, ingredientes, produtos, custos fixos e histórico de custos), mas as rotas de cadastro que vão ler e gravar nele ainda serão feitas.

---

## 2. Tecnologias

| Item | Para que serve |
|---|---|
| **Node.js 22** | Roda o JavaScript no servidor. O projeto usa CommonJS (`require` / `module.exports`) e não tem etapa de build. |
| **Express 4** | Recebe as requisições HTTP e chama a função certa para cada rota. |
| **zod** | Confere se o JSON recebido tem os campos e tipos certos antes de calcular. |
| **decimal.js** | Faz as contas com casas decimais exatas. Com `number` comum, `0.1 + 0.2` dá `0.30000000000000004`; em dinheiro isso vira centavos errados. |
| **cors** | Libera o front-end, que roda em outro endereço, para chamar a API. |
| **swagger-ui-express** | Monta a página de documentação em `/api/docs`. |
| **Prisma 7** | Cria as tabelas (migrations) e será usado para ler e gravar no PostgreSQL. |
| **dotenv** | Lê as variáveis do arquivo `.env`. |
| **jsonwebtoken** | Gera e confere o token de login (JWT). |
| **bcryptjs** | Guarda a senha como hash e confere no login (JavaScript puro, instala sem compilar no Windows). |
| **node:test + supertest** | Testes automáticos (o primeiro já vem com o Node; o segundo simula requisições HTTP). |
| **ESLint + Prettier** | Apontam erros comuns e padronizam a formatação do código. |

---

## 3. Como rodar

Dentro da pasta `Back`:

```
npm install
npm run dev
```

A API sobe em `http://localhost:3000`. Abra `http://localhost:3000/api/docs` para ver e testar as rotas pelo navegador.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API e reinicia sozinha quando você salva um arquivo (`node --watch`). Use no desenvolvimento. |
| `npm start` | Sobe a API sem reiniciar sozinha (`node src/server.js`). Use em produção. |
| `npm test` | Roda todos os testes da pasta `tests/`. |
| `npm run lint` | Procura erros comuns no código. |
| `npm run format` | Formata todos os arquivos com o Prettier. |
| `npm run prisma:generate` | Gera o cliente do Prisma em `src/generated/prisma` a partir do `schema.prisma`. |
| `npm run prisma:migrate` | Cria uma migration nova quando você muda o `schema.prisma` (só em desenvolvimento). |
| `npx prisma migrate deploy --config prisma7.config.js` | Aplica no banco as migrations que ainda não foram aplicadas. |

Para encerrar, use `Ctrl+C`. O servidor termina as requisições em andamento antes de sair (o mesmo vale quando o Docker para o container).

---

## 4. Estrutura de pastas

```
Back/
├── src/
│   ├── server.js                  Ponto de entrada: lê o .env, sobe o servidor e cuida do encerramento
│   ├── app.js                     Monta o Express: CORS, JSON, rotas, 404 e tratador de erros
│   ├── docs/
│   │   └── openapi.js             Documentação OpenAPI 3 mostrada em /api/docs
│   ├── modules/
│   │   ├── calculos.rotas.js      As 9 rotas POST /api/calculos/... e a validação de cada corpo
│   │   ├── custos/                Custos fixos: total, % sobre o faturamento, custo por unidade
│   │   ├── fichas-tecnicas/       Custo da receita e de cada salgado
│   │   ├── precificacao/          Markup, preço sugerido e análise de um preço
│   │   ├── ponto-equilibrio/      Ponto de equilíbrio de um produto e de um mix
│   │   ├── simulacoes/            Resultado do mês e reajuste de ingredientes
│   │   └── ingredientes/          Vazia, reservada para o cadastro de ingredientes
│   ├── shared/
│   │   ├── numeros.js             Decimal, arredondamento em centavos, percentuais e ErroCalculo
│   │   ├── unidades.js            Conversão KG↔G, L↔ML, UN
│   │   └── validacao.js           Peças de validação (zod) reaproveitadas pelas rotas
│   └── generated/prisma/          Cliente do Prisma (gerado, fora do git)
├── tests/
│   ├── calculos.test.js           Testa as fórmulas diretamente
│   └── api.test.js                Testa as rotas HTTP de ponta a ponta
├── prisma/
│   ├── schema.prisma              Modelo das tabelas
│   └── migrations/                Scripts SQL que criam e alteram as tabelas
├── prisma7.config.js              Onde o Prisma acha o schema, as migrations e a DATABASE_URL
├── eslint.config.js               Regras do lint
├── .env.example                   Modelo do arquivo .env
└── package.json                   Dependências e comandos npm
```

A separação mais importante é entre **rotas** e **cálculo**:

- `calculos.rotas.js` só cuida de HTTP: recebe o corpo, valida e devolve o JSON.
- Os arquivos `*.calculo.js` são funções puras. Elas não sabem que existe Express nem banco: recebem números e devolvem números. Isso deixa as fórmulas fáceis de testar e de reaproveitar quando as rotas de cadastro começarem a buscar os dados no banco.

---

## 5. Caminho de uma requisição

Exemplo: o front chama `POST /api/calculos/markup` com `{ "custoFixo": 20, "despesasVariaveis": 10, "lucro": 15 }`.

1. **`server.js`** já subiu o app criado por `criarApp()` na porta do `.env` (padrão 3000).
2. **CORS** (`app.js`): confere se a origem do front está em `CORS_ORIGIN`. Se não estiver, o navegador bloqueia a resposta.
3. **Leitura do JSON** (`express.json`): transforma o texto do corpo em objeto. Corpo acima de 100 kb é recusado com `413`; JSON quebrado volta `400 JSON_INVALIDO`.
4. **Roteamento**: `/api/calculos` leva para `calculos.rotas.js`, e `/markup` para a rota certa.
5. **Validação** (`schema.parse` do zod): se faltar campo ou o tipo estiver errado, o zod lança um `ZodError`.
6. **Cálculo**: `calcularMarkup()` em `precificacao.calculo.js` faz a conta com `Decimal`. Se a conta for impossível (ex.: percentuais somando 100% ou mais), lança `ErroCalculo`.
7. **Resposta**: `res.json(...)` devolve `{ "divisor": "0.55", "multiplicador": "1.818182" }`. Os `Decimal` viram texto automaticamente.
8. **Erros**: qualquer erro dos passos 3 a 6 cai no `tratarErros` do `app.js`, que monta a resposta no formato padrão (ver abaixo).

A função `calculo(schema, calcular)` em `calculos.rotas.js` junta os passos 5 a 7 para todas as rotas, então cada rota nova fica com uma ou duas linhas.

---

## 6. Regras gerais da API

### Números

- **Percentuais vão de 0 a 100**: `10` significa 10%.
- **Na entrada**, valores decimais podem ir como número (`1.5`) ou como texto (`"1.50"`). Texto é mais seguro para centavos. Use ponto, não vírgula.
- **Na saída**, todo valor em dinheiro ou percentual **volta como texto** (`"1.10"`, `"35.23"`). O front deve converter para exibir. Zeros à direita não aparecem: `"1.1"` é R$ 1,10.
- Dinheiro é arredondado em centavos (meio para cima) só no resultado final. O custo por salgado guarda 4 casas para não perder centavos no preço.

### Erros

Todo erro tem o mesmo formato:

```json
{ "codigo": "DADOS_INVALIDOS", "erro": "Dados inválidos", "detalhes": [{ "campo": "rendimento", "mensagem": "..." }] }
```

O front decide o que fazer pelo `codigo` e pode mostrar o `erro` para o usuário. `detalhes` só aparece em dados inválidos.

| Status | `codigo` | Quando acontece |
|---|---|---|
| 400 | `DADOS_INVALIDOS` | Campo faltando ou com tipo errado. `detalhes` lista cada campo. |
| 400 | `JSON_INVALIDO` | O corpo não é um JSON válido. |
| 404 | `ROTA_NAO_ENCONTRADA` | Endereço que não existe. |
| 413 | `CORPO_MUITO_GRANDE` | Corpo acima de 100 kb. |
| 422 | `ERRO_CALCULO` | Os dados estão certos, mas a conta não é possível (rendimento zero, percentuais somando 100% ou mais, salgado que não cobre o próprio custo etc.). |
| 500 | `ERRO_INTERNO` | Erro inesperado. O detalhe aparece só no terminal do servidor. |

### Segurança básica

- CORS restrito às origens de `CORS_ORIGIN`.
- Limite de 100 kb no corpo.
- O cabeçalho `X-Powered-By` é removido, para não anunciar que o servidor usa Express.

---

## 7. Rotas

Base: `http://localhost:3000`. Os exemplos abaixo são respostas reais.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/health` | Confirma que o servidor está no ar. Responde `{ "status": "ok" }`. |
| GET | `/api/docs` | Página do Swagger para testar as rotas. |
| GET | `/api/openapi.json` | Especificação OpenAPI. O front pode gerar o cliente a partir dela. |
| POST | `/api/calculos/ficha-tecnica` | Custo da receita e de cada salgado. |
| POST | `/api/calculos/custos-fixos` | Total dos custos fixos, % sobre o faturamento e valor por unidade. |
| POST | `/api/calculos/markup` | Markup divisor e multiplicador. |
| POST | `/api/calculos/preco-sugerido` | Preço sugerido a partir do custo e dos percentuais. |
| POST | `/api/calculos/analise-preco` | Margem, lucro por unidade e CMV de um preço. |
| POST | `/api/calculos/ponto-equilibrio` | Quanto vender de um salgado para empatar. |
| POST | `/api/calculos/ponto-equilibrio/mix` | O mesmo, para vários salgados juntos. |
| POST | `/api/calculos/simulacoes/resultado-mensal` | Receita, custos e lucro do mês para as quantidades informadas. |
| POST | `/api/calculos/simulacoes/reajuste` | Efeito de reajuste de ingredientes no custo e no preço. |

### `POST /api/calculos/ficha-tecnica`

Corpo:

```json
{
  "rendimento": 40,
  "itens": [
    { "ingredienteId": 1, "nome": "Farinha", "custoUnitario": "5.00", "unidadeCadastro": "KG", "quantidade": 500, "unidadeReceita": "G" },
    { "ingredienteId": 2, "nome": "Frango", "custoUnitario": "20.00", "unidadeCadastro": "KG", "quantidade": 800, "unidadeReceita": "G", "fatorCorrecao": "1.25" }
  ]
}
```

- `rendimento`: quantos salgados a receita rende.
- `custoUnitario`: custo de 1 unidade do cadastro (R$ 5,00 por KG).
- `quantidade` + `unidadeReceita`: quanto a receita usa (500 G).
- `fatorCorrecao` (opcional, padrão 1): perda no preparo. `1.25` = compra 25% a mais do que usa.
- Unidades aceitas: `KG`, `G`, `L`, `ML`, `UN`. Só converte dentro do mesmo grupo (massa, volume ou unidade).

Resposta:

```json
{
  "itens": [
    { "ingredienteId": 1, "nome": "Farinha", "quantidadeBruta": "0.5", "custo": "2.5" },
    { "ingredienteId": 2, "nome": "Frango", "quantidadeBruta": "1", "custo": "20" }
  ],
  "custoTotalReceita": "22.5",
  "custoPorUnidade": "0.5625"
}
```

### `POST /api/calculos/custos-fixos`

Corpo: `{ "custos": [{ "nome": "Aluguel", "valorMensal": 1500 }, { "nome": "Energia", "valorMensal": 450 }], "faturamentoMensal": 10000, "producaoMensal": 4000 }`. `faturamentoMensal` e `producaoMensal` são opcionais.

Resposta: `{ "total": "1950", "percentualSobreFaturamento": "19.5", "porUnidade": "0.4875" }`. O campo cujo dado não foi enviado volta `null`.

### `POST /api/calculos/markup`

Corpo: `{ "custoFixo": 20, "despesasVariaveis": 10, "lucro": 15 }`

Resposta: `{ "divisor": "0.55", "multiplicador": "1.818182" }`

### `POST /api/calculos/preco-sugerido`

Corpo: `{ "custoUnitario": "0.6025", "percentuais": { "custoFixo": 20, "despesasVariaveis": 10, "lucro": 15 } }`

Resposta: `{ "divisor": "0.55", "multiplicador": "1.818182", "custoUnitario": "0.6025", "precoSugerido": "1.1" }`

### `POST /api/calculos/analise-preco`

Serve para conferir um preço que o gestor escolheu (que pode ser diferente do sugerido).

Corpo: `{ "precoVenda": "1.10", "custoUnitario": "0.6025", "percentuais": { "custoFixo": 20, "despesasVariaveis": 10 } }`

Resposta:

```json
{
  "precoVenda": "1.1", "custoUnitario": "0.6025",
  "despesasVariaveis": "0.11", "custoFixoRateado": "0.22",
  "margemContribuicao": "0.39", "margemContribuicaoPercentual": "35.23",
  "lucroUnitario": "0.17", "margemLucroPercentual": "15.23",
  "cmvPercentual": "54.77"
}
```

### `POST /api/calculos/ponto-equilibrio`

Corpo: `{ "custosFixosMensais": 3000, "percentualDespesasVariaveis": 10, "produto": { "nome": "Coxinha", "precoVenda": 5, "custoUnitario": "1.5" } }`

Resposta: `{ "margemContribuicaoUnitaria": "3", "quantidade": "1000", "receita": "5000" }`. Ou seja, 1000 coxinhas por mês, R$ 5.000 de faturamento.

### `POST /api/calculos/ponto-equilibrio/mix`

Corpo:

```json
{
  "custosFixosMensais": 3000,
  "percentualDespesasVariaveis": 10,
  "itens": [
    { "nome": "Coxinha", "precoVenda": 5, "custoUnitario": "1.5", "quantidadeVendida": 300 },
    { "nome": "Esfiha", "precoVenda": 8, "custoUnitario": 3, "quantidadeVendida": 100 }
  ]
}
```

Resposta: `{ "margemContribuicaoMedia": "3.3", "quantidadeTotal": "910", "receita": "5227.27", "porProduto": [{ "nome": "Coxinha", "quantidade": "682" }, { "nome": "Esfiha", "quantidade": "228" }] }`

### `POST /api/calculos/simulacoes/resultado-mensal`

Mesmo corpo do mix. Responde o resultado do mês com essas vendas:

`{ "receita": "2300", "custoProdutos": "750", "despesasVariaveis": "230", "margemContribuicao": "1320", "custosFixos": "3000", "lucro": "-1680", "margemLucroPercentual": "-73.04" }`

Lucro negativo é prejuízo.

### `POST /api/calculos/simulacoes/reajuste`

Corpo: `{ "ficha": { ...mesma ficha técnica... }, "reajustes": [{ "ingredienteId": 2, "percentual": 10 }], "percentuais": { "custoFixo": 20, "despesasVariaveis": 10, "lucro": 15 } }`. `percentual` pode ser negativo (o ingrediente ficou mais barato). `percentuais` é opcional; sem ele não volta preço sugerido.

Resposta: `{ "custoPorUnidadeAntes": "0.5625", "custoPorUnidadeDepois": "0.6125", "variacaoPercentual": "8.89", "precoSugeridoAntes": "1.02", "precoSugeridoDepois": "1.11" }`

---

## 8. As fórmulas

Seguem o método de markup divisor do SEBRAE e a análise de margem de contribuição.

| Cálculo | Fórmula | Arquivo |
|---|---|---|
| Quantidade bruta do ingrediente | quantidade líquida × fator de correção, convertida para a unidade do cadastro | `ficha-tecnica.calculo.js` |
| Custo do ingrediente | quantidade bruta × custo unitário | `ficha-tecnica.calculo.js` |
| Custo por salgado | custo total da receita ÷ rendimento | `ficha-tecnica.calculo.js` |
| % custo fixo | custos fixos mensais ÷ faturamento mensal × 100 | `custos.calculo.js` |
| Custo fixo por salgado | custos fixos mensais ÷ salgados produzidos no mês | `custos.calculo.js` |
| Markup divisor | 1 − (% custo fixo + % despesas variáveis + % lucro) ÷ 100 | `precificacao.calculo.js` |
| Markup multiplicador | 1 ÷ markup divisor | `precificacao.calculo.js` |
| Preço sugerido | custo por salgado ÷ markup divisor | `precificacao.calculo.js` |
| Margem de contribuição | preço − custo − preço × % despesas variáveis | `precificacao` e `ponto-equilibrio` |
| Lucro por salgado | margem de contribuição − preço × % custo fixo | `precificacao.calculo.js` |
| CMV % | custo ÷ preço × 100 | `precificacao.calculo.js` |
| Ponto de equilíbrio (qtd.) | custos fixos ÷ margem de contribuição unitária, arredondado para cima | `ponto-equilibrio.calculo.js` |
| Ponto de equilíbrio do mix | custos fixos ÷ margem média ponderada pelas vendas; cada salgado recebe sua fatia | `ponto-equilibrio.calculo.js` |
| Lucro do mês | receita − custo dos salgados − despesas variáveis − custos fixos | `simulacoes.calculo.js` |

Exemplo completo: a receita custa R$ 24,10 e rende 40 coxinhas, então cada uma custa R$ 0,6025. Com 20% de custo fixo, 10% de despesas variáveis e 15% de lucro, o divisor é 1 − 0,45 = 0,55, e o preço sugerido é 0,6025 ÷ 0,55 = **R$ 1,10**.

Validações do motor (geram `422 ERRO_CALCULO`): rendimento, preço e faturamento precisam ser maiores que zero; custos e quantidades não podem ser negativos; fator de correção é no mínimo 1; cada percentual fica abaixo de 100% e a soma do markup também; ponto de equilíbrio exige margem de contribuição positiva.

---

## 9. Banco de dados

O PostgreSQL 16 roda no Docker (ver `docker-compose.yml` na raiz). O Prisma descreve as tabelas em `prisma/schema.prisma` e as cria pelas migrations em `prisma/migrations/`.

| Tabela | Modelo no Prisma | O que guarda |
|---|---|---|
| `usuario` | `Usuario` | Nome, cargo (`GESTOR` ou `FUNCIONARIO`), hash da senha, ativo. |
| `ingredientes` | `Ingrediente` | Nome único, unidade de medida e custo unitário (4 casas). |
| `produtos` | `Produto` | Nome do salgado, preço de venda aprovado, ativo. |
| `custo_fixo` | `CustoFixo` | Aluguel, energia, gás, salários etc., com o valor mensal. |
| `historico_custo_insumo` | `HistoricoCustoInsumo` | Cada mudança no custo de um ingrediente: valor anterior, novo, quem mudou e quando. |

Detalhes:

- Datas usam `timestamptz` (com fuso), no fuso `America/Sao_Paulo`.
- Valores em dinheiro têm `CHECK >= 0` no próprio banco (migration `20261020000000_tipos_e_restricoes`).
- O cliente do Prisma é gerado em JavaScript (`provider = "prisma-client-js"`) em `src/generated/prisma`, que fica fora do git. Rode `npm run prisma:generate` depois de instalar ou mudar o schema.
- No Prisma 7 o cliente precisa de um adaptador de banco. Quando as rotas de cadastro forem criadas, instale `@prisma/adapter-pg` e crie o cliente assim:

```js
const { PrismaClient } = require("./generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
```

Para mudar o banco: altere o `schema.prisma`, rode `npm run prisma:migrate` (cria a migration e aplica) e faça commit da pasta nova em `prisma/migrations/`.

---

## 10. Testes, lint e CI

- `tests/calculos.test.js` chama as fórmulas diretamente e confere os valores (ex.: preço sugerido `1.1`, ponto de equilíbrio `1000`).
- `tests/api.test.js` sobe o app em memória com o supertest e testa as rotas, o CORS e cada tipo de erro.
- São 28 testes. Rode com `npm test`.
- O GitHub Actions (`.github/workflows/ci.yml`) roda em todo push e pull request que mexe em `Back/`: instala as dependências, gera o cliente do Prisma, roda o lint e os testes. Se algum falhar, o PR fica com um X vermelho.

---

## 11. Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

| Variável | Exemplo | Para que serve |
|---|---|---|
| `DATABASE_URL` | `postgresql://salgado:SENHA@localhost:5433/casa_do_salgado?schema=public` | Conexão com o banco. A senha é a mesma do `.env` da raiz. |
| `PORT` | `3000` | Porta da API. |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:8080` | Endereços do front que podem chamar a API, separados por vírgula. Vazio libera qualquer origem (só em desenvolvimento). |

O `.env` nunca vai para o git.

---

## 12. Como adicionar uma rota nova

Exemplo: uma rota que calcula o CMV de um salgado.

1. **Fórmula**: crie a função em um arquivo `*.calculo.js` do módulo certo, usando `dec()` para converter a entrada, `exigirPositivo` / `exigirNaoNegativo` para validar e `dinheiro()` para arredondar o resultado. Exporte com `module.exports`.
2. **Teste da fórmula**: adicione um caso em `tests/calculos.test.js`.
3. **Rota**: em `calculos.rotas.js`, crie o schema do corpo com `z.object(...)` (reaproveite `numero` de `shared/validacao.js`) e registre:
   ```js
   calculosRotas.post("/cmv", calculo(cmvBody, (body) => calcularCmv(body.precoVenda, body.custoUnitario)));
   ```
4. **Teste da rota**: adicione um caso em `tests/api.test.js`.
5. **Documentação**: adicione a rota em `src/docs/openapi.js` com um exemplo, para aparecer no Swagger.
6. Rode `npm run lint` e `npm test` antes de enviar.

---

## Login e permissões

- O login é pelo `nome` (único no banco) e senha. `POST /api/auth/login` confere a senha com bcrypt e devolve um token JWT assinado com `JWT_SECRET`, que leva só o id (`sub`) e o `cargo` e vence em `JWT_EXPIRES_IN` (padrão `8h`).
- `src/shared/autenticacao.js` tem os middlewares: `autenticar` (exige `Authorization: Bearer <token>` e preenche `req.usuario = { id, cargo }`) e `exigirCargo("GESTOR")`.
- No `app.js`, só `/health`, `/api/docs`, `/api/openapi.json` e `/api/auth/login` são públicos. FUNCIONARIO lê ingredientes e produtos e usa os cálculos; criar, alterar e apagar é só do GESTOR.
- Erros: `401 NAO_AUTENTICADO` (sem token, token alterado ou vencido), `401 CREDENCIAIS_INVALIDAS` (nome ou senha errados, ou usuário desativado), `403 SEM_PERMISSAO`.
- Ao mudar o `custoUnitario` de um ingrediente, o `PUT /api/ingredientes/:id` grava a mudança em `historico_custo_insumo` com o usuário logado.
- Primeiro gestor: `npm run criar-gestor -- <nome> <senha>`.
- Limite conhecido: desativar um usuário bloqueia novos logins, mas o token que ele já tem continua valendo até vencer.

---

## 13. O que ainda falta

- Rota de cadastro de custos fixos.
- Tabela que liga produto a vários ingredientes (a ficha técnica salva no banco).
- Diagnóstico de "rentável ou não" para cada salgado.
