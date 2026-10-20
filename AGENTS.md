# AGENTS.md — A Casa do Salgado

Contexto do projeto para agentes de IA (Claude, Copilot, Cursor etc.) e para quem chega agora no grupo.
**Leia este arquivo inteiro antes de qualquer alteração** e **atualize-o no mesmo PR** sempre que mudar
estrutura, stack, modelo de dados, regras de negócio ou o estado do projeto.

> Última atualização: 20/10/2026 (PRs #2, #3 e #4 mesclados na `main`)

---

## 1. O que é o projeto

- **Repositório:** `GuGaEgito/lucro-primeira-mordida` ("Lucro a Primeira Mordida").
- **Sistema:** "A Casa do Salgado", sistema de **precificação e gestão de fichas técnicas** para uma casa de salgados.
- **Contexto:** trabalho escolar em grupo do **SAGA SENAI**. O documento oficial de requisitos (lista de RF/RNF,
  plano de execução por fases, prazos) **não está no repositório**. Quando uma regra não estiver definida aqui
  nem no código, use o padrão mais comum do mercado, **deixe registrado qual foi escolhido** (seção 7)
  e avise no PR.
- **Idioma:** código de domínio, comentários, commits e documentação em **português** (sem acento em nomes de
  arquivos, variáveis e pastas).

### O que o sistema precisa fazer

1. Cadastrar **ingredientes (insumos)** com unidade de medida e custo unitário, guardando o **histórico de custo** (RF10).
2. Montar **fichas técnicas**: cada produto (salgado) com a lista de ingredientes, quantidades e rendimento.
3. Cadastrar **custos fixos mensais** (aluguel, energia, gás, salários) (RF12 / RF13).
4. **Precificar**: calcular custo do produto e sugerir preço de venda (o gestor pode ajustar o preço final).
5. Calcular o **ponto de equilíbrio** (por produto e pelo mix de vendas).
6. Fazer **simulações** (resultado do mês, reajuste de ingrediente).
7. Login com perfis **GESTOR** e **FUNCIONARIO** (JWT, senha sempre em hash).
8. **Backup automático** diário do banco (RNF05).

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Banco | PostgreSQL 16 (Docker, imagem `postgres:16-alpine`, fuso `America/Sao_Paulo`) |
| ORM | Prisma 7 (`prisma-client` generator, config em `prisma7.config.ts`) |
| Back-end | Node.js 22 + Express + TypeScript (strict) |
| Cálculos | `decimal.js` (nunca `number` para dinheiro) |
| API | `cors`, validação com `zod`, documentação OpenAPI + Swagger UI (`swagger-ui-express`) |
| Testes | `node:test` + `tsx` (`npm test`); rotas testadas com `supertest` |
| Qualidade | ESLint 9 (typescript-eslint) + Prettier; CI no GitHub Actions (lint, build e testes) |
| Front-end | React servido por Nginx (**ainda não existe**) |
| Backup | `prodrigestivill/postgres-backup-local:16` (diário; guarda 7 dias, 4 semanas, 6 meses) |
| Auth | JWT (`JWT_SECRET`, `JWT_EXPIRES_IN` padrão `8h`) |

## 3. Estrutura de pastas

Estrutura atual da `main` (o PR #2 unificou a Fase 0 com a `main`, mantendo a pasta `Back/`):

```
.
├── AGENTS.md / CLAUDE.md          # contexto para agentes (CLAUDE.md só importa este arquivo)
├── README.md                      # passo a passo para subir banco + Prisma (Windows)
├── .env.example                   # variáveis da raiz (Docker): POSTGRES_*, DB_PORT, JWT_*, WEB_PORT
├── docker-compose.yml             # serviços db, backend, frontend, backup
├── 01_schema.sql                  # SQL de referência do banco (espelho do schema.prisma)
├── db/dockerfile                  # imagem do Postgres com fuso de São Paulo
├── .github/workflows/ci.yml       # lint + build + test quando Back/** muda (push/PR para main/develop)
└── Back/
    ├── .env.example               # DATABASE_URL e PORT
    ├── prisma7.config.ts
    ├── prisma/schema.prisma
    ├── prisma/migrations/
    ├── src/server.ts              # valida PORT, sobe o app e faz encerramento gracioso
    ├── src/app.ts                 # criarApp(): CORS, JSON, rotas, Swagger, tratamento de erros
    ├── src/docs/openapi.ts        # especificação OpenAPI das rotas
    ├── src/shared/
    │   ├── validacao.ts           # schemas zod reutilizados pelas rotas
    │   ├── numeros.ts             # dec(), percentual(), dinheiro(), validações, ErroCalculo
    │   └── unidades.ts            # conversão KG/G, L/ML, UN
    ├── src/modules/
    │   ├── calculos.rotas.ts      # POST /api/calculos/...
    │   ├── ingredientes/          # vazio
    │   ├── fichas-tecnicas/ficha-tecnica.calculo.ts
    │   ├── custos/custos.calculo.ts
    │   ├── precificacao/precificacao.calculo.ts
    │   ├── ponto-equilibrio/ponto-equilibrio.calculo.ts
    │   └── simulacoes/simulacoes.calculo.ts
    ├── tests/calculos.test.ts     # motor de cálculo
    ├── tests/api.test.ts          # rotas da API
    └── .claude/ .agents/ .windsurf/   # skills oficiais do Prisma para agentes
```

**Skills de agente:** além das do Prisma em `Back/`, o projeto usa `nodejs-backend-patterns`, `api-design-principles`,
`postgresql-table-design` e `code-simplification` (em `.claude/skills/` na raiz, **ainda fora do git**). Siga essas skills ao
escrever back-end, rotas e tabelas.

Padrão: um diretório por módulo de negócio em `src/modules/<modulo>/`. Funções puras de cálculo ficam em
`<modulo>.calculo.ts`, sem acesso ao banco; rotas, serviços e acesso ao Prisma entram em arquivos próprios do módulo.

## 4. Como rodar

O passo a passo completo e os erros comuns estão no [README.md](README.md). Resumo (Windows usa `copy`):

```bash
cp .env.example .env                 # troque POSTGRES_PASSWORD e JWT_SECRET
docker compose up -d --build db      # sobe só o banco; checar "healthy" em docker compose ps
cd Back && cp .env.example .env      # DATABASE_URL com a mesma senha da raiz
npm install
npx prisma migrate deploy --config prisma7.config.ts
npm test                             # testes do motor de cálculo
npm run dev                          # API em http://localhost:3000 (Swagger em /api/docs)
```

- Porta do banco no host: `DB_PORT` (padrão **5433**), só em `127.0.0.1`. Banco `casa_do_salgado`, usuário `salgado`.
- Outros scripts em `Back/`: `npm run build`, `npm run lint`, `npm run format`, `npm run prisma:generate`, `npm run prisma:migrate`.
- Depois de um `git pull` com migrations novas: `npx prisma migrate deploy --config prisma7.config.ts`.

## 5. Modelo de dados

Fonte da verdade: `Back/prisma/schema.prisma` (tabelas em snake_case via `@@map`, campos em camelCase).

| Modelo / tabela | Campos principais | Observações |
|---|---|---|
| `Usuario` / `usuario` | id, nome, cargo (`GESTOR`/`FUNCIONARIO`), senha (hash), criadoEm, ativo | |
| `Ingrediente` / `ingredientes` | id, nome (único), unidade (`KG`,`G`,`L`,`ML`,`UN`), custoUnitario `Decimal(10,4)`, atualizadoEm | custo por **1 unidade de medida** do cadastro |
| `Produto` / `produtos` | id, nome, ingredienteId (opcional), precoVenda `Decimal(10,2)`, ativo, atualizadoEm | precoVenda = preço final aprovado (sugerido ou ajustado) |
| `CustoFixo` / `custo_fixo` | id, nome (único), valorMensal `Decimal(10,2)`, atualizadoEm | RF12/RF13 |
| `HistoricoCustoInsumo` / `historico_custo_insumo` | id, insumoId, custoAnterior, custoNovo, usuarioId, alteradoEm | RF10: quem alterou e quando |

**Pendência:** `Produto` liga a **um único** ingrediente. O motor de cálculo já trabalha com ficha técnica de vários
itens, mas falta a tabela produto × ingrediente (quantidade, unidade, fator de correção) e o campo de
rendimento no produto. Também não há tabelas para parâmetros de precificação (% despesas variáveis, % lucro) nem
para simulações salvas.

Regras do banco: valores monetários e custos nunca negativos (`CHECK >= 0`); dinheiro sempre `Decimal`, nunca `Float`.

A migration `20261020000000_tipos_e_restricoes` (PR #4):
- troca todas as datas para `TIMESTAMPTZ(6)` (`@db.Timestamptz(6)`), convertendo os valores antigos de `America/Sao_Paulo`;
- cria o índice `idx_hist_custo_usuario` em `historico_custo_insumo(usuario_id)`;
- adiciona os `CHECK >= 0` no banco (custo unitário, preço de venda, valor mensal, custos do histórico). O Prisma não representa
  `CHECK` no `schema.prisma`, então eles só existem na migration.
Padrão a seguir em tabelas novas: datas `timestamptz`, índice em toda chave estrangeira, `CHECK` para valores que não podem ser negativos.

## 6. Módulos, regras de negócio e fórmulas

| Módulo | Responsabilidade | Estado |
|---|---|---|
| `ingredientes` | CRUD de insumos; ao alterar custo, gravar `HistoricoCustoInsumo` | vazio |
| `fichas-tecnicas` | custo da receita e do salgado | cálculo pronto |
| `custos` | soma dos custos fixos, % sobre faturamento, rateio por unidade | cálculo pronto |
| `precificacao` | markup, preço sugerido, análise de preço | cálculo pronto |
| `ponto-equilibrio` | por produto e por mix | cálculo pronto |
| `simulacoes` | resultado do mês, reajuste de ingrediente | cálculo pronto |

Percentuais entram como número de 0 a 100 (`8` = 8%).

### Regras gerais de número (`shared/numeros.ts`)

- Toda conta usa `Decimal` (`decimal.js`); entrada aceita `number`, `string` ou o `Decimal` do Prisma (`dec()`).
- Arredondamento só no resultado final: dinheiro com 2 casas, **meio para cima** (`dinheiro()`); custo por unidade com 4 casas (igual a `custo_unitario`); markup com 6 casas; percentuais de resultado com 2 casas.
- Entradas inválidas lançam `ErroCalculo` com mensagem em português (ex.: rendimento ≤ 0, valor negativo, percentual ≥ 100%).

### Ficha técnica (`fichas-tecnicas/ficha-tecnica.calculo.ts`)

- Conversão de unidade só dentro do mesmo grupo: KG = 1000 G, L = 1000 ML, UN sozinha (`shared/unidades.ts`).
- **Fator de correção** (FC) = peso bruto / peso líquido, padrão 1, nunca menor que 1.
- Quantidade bruta = quantidade líquida × FC, convertida para a unidade do cadastro do ingrediente.
- Custo do item = quantidade bruta × custo unitário.
- Custo da receita = soma dos itens. **Custo por salgado = custo da receita / rendimento.**

### Custos fixos (`custos/custos.calculo.ts`)

- Total = soma de `valor_mensal`.
- **% custo fixo** = custos fixos mensais / faturamento médio mensal × 100 (usado no markup).
- Alternativa por volume: custo fixo por salgado = custos fixos mensais / salgados produzidos no mês.

### Precificação, markup SEBRAE (`precificacao/precificacao.calculo.ts`)

- **Markup divisor** = 1 − (% custo fixo + % despesas variáveis + % lucro) / 100. A soma precisa ser < 100%.
- **Markup multiplicador** = 1 / markup divisor.
- **Preço sugerido** = custo do salgado / markup divisor.
- Despesas variáveis = impostos (ex.: Simples), taxa de cartão, comissão, delivery, como % do preço.
- **Análise de um preço** (sugerido ou ajustado pelo gestor):
  - despesas variáveis = preço × % despesas variáveis
  - custo fixo rateado = preço × % custo fixo
  - **margem de contribuição** = preço − custo do salgado − despesas variáveis (também em % do preço)
  - **lucro unitário** = margem de contribuição − custo fixo rateado (também em % do preço)
  - **CMV %** (food cost) = custo do salgado / preço × 100

### Ponto de equilíbrio (`ponto-equilibrio/ponto-equilibrio.calculo.ts`)

- MC unitária = preço − custo do salgado − preço × % despesas variáveis. Precisa ser positiva.
- **Por produto:** quantidade = custos fixos mensais / MC unitária, **arredondada para cima**; receita = quantidade × preço.
- **Mix de produtos:** MC média = Σ(MC × quantidade vendida) / Σ quantidade vendida; quantidade total = custos fixos / MC média
  (para cima); cada salgado fica com a sua proporção do mix (para cima); receita = custos fixos / (MC total / receita total).

### Simulações (`simulacoes/simulacoes.calculo.ts`)

- **Resultado do mês** ("e se eu vender X de cada salgado?"): receita, custo dos salgados, despesas variáveis,
  margem de contribuição, custos fixos, **lucro = receita − custo dos salgados − despesas variáveis − custos fixos** e margem de lucro %.
- **Reajuste de ingrediente** ("e se a farinha subir 10%?"): aplica a variação % no custo unitário dos ingredientes
  escolhidos, recalcula o custo por salgado (antes, depois, variação %) e, se os percentuais forem informados, o preço sugerido antes e depois.

### API REST

As funções de cálculo são expostas sem banco: os dados vão no corpo da requisição. Base `http://localhost:3000`.

| Rota | Função |
|---|---|
| `GET /health` | status do servidor |
| `GET /api/docs` | Swagger UI (testar rotas pelo navegador) |
| `GET /api/openapi.json` | especificação OpenAPI (para o front gerar o cliente) |
| `POST /api/calculos/ficha-tecnica` | `calcularCustoFicha` |
| `POST /api/calculos/custos-fixos` | total, % do faturamento e custo fixo por unidade |
| `POST /api/calculos/markup` | `calcularMarkup` |
| `POST /api/calculos/preco-sugerido` | `calcularPrecoSugerido` |
| `POST /api/calculos/analise-preco` | `analisarPreco` |
| `POST /api/calculos/ponto-equilibrio` | `calcularPontoEquilibrio` |
| `POST /api/calculos/ponto-equilibrio/mix` | `calcularPontoEquilibrioMix` |
| `POST /api/calculos/simulacoes/resultado-mensal` | `simularResultadoMensal` |
| `POST /api/calculos/simulacoes/reajuste` | `simularReajusteIngredientes` |

Contrato com o front-end:
- Corpo validado com `zod` (`shared/validacao.ts`). Decimais podem ir como número ou texto (`"1.50"`, ponto como separador) e **voltam sempre como texto** (`"1.10"`).
- Erros sempre no formato **`{ codigo, erro, detalhes? }`**; o front decide pelo `codigo` e mostra o `erro` ao usuário:

  | Status | `codigo` | Quando |
  |---|---|---|
  | 400 | `DADOS_INVALIDOS` | corpo não passa no `zod` (`detalhes: [{ campo, mensagem }]`) |
  | 400 | `JSON_INVALIDO` | corpo não é JSON válido |
  | 413 | `CORPO_MUITO_GRANDE` | corpo acima de **100kb** |
  | 422 | `ERRO_CALCULO` | cálculo impossível (`ErroCalculo`) |
  | 404 | `ROTA_NAO_ENCONTRADA` | rota inexistente |
  | 500 | `ERRO_INTERNO` | erro inesperado |

- CORS: `CORS_ORIGIN` no `Back/.env`, origens separadas por vírgula (ex.: `http://localhost:5173,http://localhost:8080`). Vazio aceita qualquer origem (só em desenvolvimento).
- Rota nova: schema em `validacao.ts`, rota no arquivo `*.rotas.ts` usando o helper `calculo(schema, funcao)`,
  documentação em `docs/openapi.ts` e teste em `tests/api.test.ts`. Erros sempre por `responderErro` em `app.ts`.
- Servidor: valida `PORT` na subida e faz **encerramento gracioso** em `SIGTERM`/`SIGINT`
  (termina as requisições em andamento; força a saída depois de 10 s). Em produção, sem `CORS_ORIGIN` a API registra um aviso.

### Testes

`Back/tests/calculos.test.ts` tem 16 casos cobrindo todos os cálculos acima, com uma receita de coxinha de exemplo
(rendimento 40). `tests/api.test.ts` cobre as rotas com `supertest`; `npm test` roda os dois. Qualquer mudança de fórmula precisa atualizar os testes e esta seção.

## 7. Convenções

- **Branches:** `tipo/descricao-curta` (ex.: `setup/fase-0-backend`, `feat/motor-precificacao`). Nunca commitar direto na `main`; tudo por PR.
- **Commits:** Conventional Commits em português, ex.: `feat(backend): ...`, `fix: ...`, `docs: ...`.
- **Agentes de IA:** mostrar a mensagem de commit ao Luiz e esperar a aprovação dele **antes** de qualquer commit/push.
- **Código:** TypeScript strict; Prettier + ESLint limpos e `npm test` verde antes do push (o CI roda lint, build e testes).
- **Cálculo:** funções puras, entrada e saída em `Decimal`, validação com `ErroCalculo`, arredondar só no fim.
- **Banco:** toda mudança de schema via migration do Prisma (`npm run prisma:migrate`); manter `01_schema.sql` coerente ou marcá-lo como obsoleto.
- **Segredos:** `.env` nunca vai para o Git (está no `.gitignore`); só `.env.example` com valores de exemplo.
- **Este arquivo:** quem mudar estrutura, regras ou estado do projeto atualiza o `AGENTS.md` no mesmo PR.

### Decisões tomadas sem o documento do SENAI

| Data | Decisão | Motivo |
|---|---|---|
| 20/10/2026 | Documento de contexto chama-se `AGENTS.md` na raiz, com `CLAUDE.md` importando-o | convenção lida pela maioria dos agentes de código |
| 20/10/2026 | Back-end continua em `Back/` (pasta da `main`); o conteúdo da Fase 0 foi trazido para dentro dela, sem renomear para `backend/` | decisão da unificação da `main` com `setup/fase-0-backend` |
| 20/10/2026 | Precificação por **markup divisor do SEBRAE** (custo fixo, despesas variáveis e lucro como % do preço) | método mais usado em food service e em material do SENAI/SEBRAE |
| 20/10/2026 | Custo fixo entra no preço como % do faturamento médio; rateio por unidade fica como alternativa | evita depender de previsão de volume |
| 20/10/2026 | Fator de correção ≥ 1 por ingrediente na ficha técnica | padrão de ficha técnica em cozinha profissional |
| 20/10/2026 | Ponto de equilíbrio arredonda quantidade para cima | vender meia coxinha não existe; arredondar para baixo daria prejuízo |
| 20/10/2026 | API de cálculo não depende do banco: o front manda os dados no corpo | permite o front começar antes dos CRUDs |
| 20/10/2026 | Decimais voltam como texto no JSON | `number` em JSON perde centavos |
| 20/10/2026 | O front-end será feito por outra pessoa do grupo | divisão de tarefas do grupo |

## 8. Estado atual e próximos passos

**Feito**
- Banco PostgreSQL no Docker, Prisma com 5 modelos e migration inicial (`main`, Guilherme, até 17/10/2026).
- README com passo a passo.
- Fase 0: Express + TS, lint, CI, pastas dos módulos (branch `setup/fase-0-backend`, 11/09/2026).
- **PR #2 (mesclado em 20/10/2026):** unificou a `main` com a Fase 0 dentro de `Back/`, corrigiu a porta do `docker-compose.yml`,
  criou os `.env.example` (raiz e `Back/`), adicionou o motor de cálculo dos 5 módulos e 16 testes.
- **PR #3 (mesclado):** API REST dos cálculos com CORS, Swagger/OpenAPI e testes das rotas (seção 6).
- **PR #4 (mesclado):** helper único nas rotas, erros com `codigo`, limite de 100kb, encerramento gracioso e a migration de
  `timestamptz`, índice e `CHECK` (seções 5 e 6).

**Problemas conhecidos**
1. Falta a tabela produto × ingrediente (quantidade, unidade, fator de correção) e o rendimento do produto (seção 5).
2. O serviço `backend` do compose faz build de `./Back`, que ainda não tem Dockerfile; o serviço `frontend` aponta para `./frontend`, que não existe. Hoje só `db` (e `backup`) sobem.
3. Sem CRUD, sem login e sem front-end; as rotas de cálculo ainda não leem nem gravam no banco.
4. As skills de `.claude/skills/` (raiz) ainda não estão no git.

**Em andamento**
- Nada no back-end no momento. O front-end será feito por outra pessoa do grupo, consumindo a API da seção 6.

**Próximos passos**
1. Colocar as skills de `.claude/skills/` no git.
2. Migration da ficha técnica (produto × ingrediente + rendimento) e dos parâmetros de precificação.
3. CRUDs dos módulos (ingredientes com histórico RF10, custos fixos, fichas técnicas) + rotas que usam o motor de cálculo.
4. Autenticação JWT com perfis GESTOR / FUNCIONARIO.
5. Dockerfile do back-end e front-end React.

**Faltando do SENAI:** lista oficial de RF/RNF, plano de execução por fases (Fases 1 e 2 não aparecem em lugar nenhum),
prazos e critérios de entrega. Requisitos citados no código até agora: RF10, RF12, RF13, RNF05.
