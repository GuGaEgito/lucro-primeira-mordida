# Diário de Bordo — Back-end

Registro contínuo das alterações, novas rotas, integrações e decisões técnicas implementadas no projeto.

---

## [29/10/2026] — Implementação do CRUD de Ingredientes e Produtos

### Contexto
Até então, o back-end operava apenas com rotas utilitárias e de cálculos puros (`/api/calculos`), sem comunicação ativa com o PostgreSQL via Prisma. Para viabilizar o cadastro e manipulação de insumos e itens comercializados, foram criadas as primeiras rotas de persistência (CRUD).

---

### O que foi feito

#### 1. Conexão com o Banco de Dados (Prisma 7)
* **Instalação:** Adicionado o pacote `@prisma/adapter-pg` (exigência do Prisma 7 para conexão com PostgreSQL).
* **Geração do Client:** Executado `prisma generate` para compilar o client em `src/generated/prisma`.
* **Singleton de Conexão:** Criado [`src/shared/prisma.js`](../src/shared/prisma.js) para compartilhar uma única instância do `PrismaClient` na aplicação, evitando múltiplas conexões simultâneas desnecessárias.

#### 2. Rotas de Ingredientes (`src/routes/ingredientes.js`)
Criado o conjunto completo de endpoints para gestão de insumos:
* `GET /api/ingredientes` — Lista todos os ingredientes ordenados alfabeticamente.
* `GET /api/ingredientes/:id` — Busca detalhada de um ingrediente por ID (retorna `404 NAO_ENCONTRADO` se inexistente).
* `POST /api/ingredientes` — Cadastra novo ingrediente com validação Zod (impede nomes duplicados via `409 CONFLITO`).
* `PUT /api/ingredientes/:id` — Atualiza nome, unidade de medida e/ou custo unitário.
* `DELETE /api/ingredientes/:id` — Exclui ingrediente (retorna `409 CONFLITO` se houver vínculo com produtos ou histórico).

> **Observação técnica:** A atualização de custo unitário nesta fase ainda não grava na tabela `historico_custo_insumo` por depender de `usuario_id`, funcionalidade que será conectada quando o módulo de autenticação for implantado.

#### 3. Rotas de Produtos (`src/routes/produtos.js`)
Criado o conjunto de endpoints para produtos e salgados:
* `GET /api/produtos` — Lista produtos com os dados do ingrediente vinculado (traz apenas os ativos por padrão; suporta filtro `?todos=true`).
* `GET /api/produtos/:id` — Busca um produto pelo seu ID.
* `POST /api/produtos` — Cadastro de produto (suporta vincular `ingredienteId`, definir `precoVenda` e flag `ativo`).
* `PUT /api/produtos/:id` — Atualização parcial ou total dos dados do produto.
* `PATCH /api/produtos/:id/ativo` — Alteração rápida de status ativo/inativo (`{ "ativo": false }`).
* `DELETE /api/produtos/:id` — Exclusão permanente do registro no banco.

#### 4. Registro no Servidor Principal (`src/app.js`)
* Integrados os novos roteadores sob os prefixos:
  * `app.use("/api/ingredientes", ingredientesRotas)`
  * `app.use("/api/produtos", produtosRotas)`

---

### Resumo dos Novos Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/ingredientes` | Listagem geral de insumos |
| `GET` | `/api/ingredientes/:id` | Consulta de insumo por ID |
| `POST` | `/api/ingredientes` | Criação de insumo |
| `PUT` | `/api/ingredientes/:id` | Alteração de insumo |
| `DELETE` | `/api/ingredientes/:id` | Remoção de insumo |
| `GET` | `/api/produtos` | Listagem de produtos (filtro `?todos=true`) |
| `GET` | `/api/produtos/:id` | Consulta de produto por ID |
| `POST` | `/api/produtos` | Criação de produto |
| `PUT` | `/api/produtos/:id` | Alteração de produto |
| `PATCH` | `/api/produtos/:id/ativo` | Ativação/inativação de produto |
| `DELETE` | `/api/produtos/:id` | Remoção de produto |

---

## [30/10/2026] — Refatoração de Produtos e Criação da Ficha Técnica (Relacionamento N:N)

### Contexto
Originalmente, a tabela `produtos` possuía uma chave estrangeira direta simples (`ingredientes_id`), limitando a associação de cada produto a apenas 1 ingrediente e sem suporte a dosagens (quantidade e unidade na receita). Para suportar receitas reais completas (ex: uma coxinha que leva farinha, frango, óleo e temperos), a modelagem foi expandida com uma tabela associativa direta e sem complexidade desnecessária (o campo `fatorCorrecao` foi removido conforme alinhamento).

---

### O que foi feito

#### 1. Modelagem Prisma (`prisma/schema.prisma` e Migrations)
* **Novo Modelo `ProdutoIngrediente`:**
  * Mapeado para a tabela `produto_ingredientes`.
  * Campos: `id`, `produtoId`, `ingredienteId`, `quantidade` (Decimal) e `unidadeReceita` (Enum `UnidadeMedida`: KG, G, L, ML, UN).
  * Chaves estrangeiras com integridade referencial: exclusão do produto remove seus itens de receita em cascata (`onDelete: Cascade`), enquanto ingredientes vinculados são protegidos contra exclusão acidental (`onDelete: Restrict`).
  * Chave única composta `[produtoId, ingredienteId]` para impedir duplicidade do mesmo insumo na mesma receita.
* **Modelo `Produto`:**
  * Adicionado o campo `rendimento` (Decimal, default 1), permitindo calcular o custo unitário por salgado.
  * Removido o campo obsoleto `ingredientes_id`.
* **Migration criada:** `20261030000000_adiciona_ficha_tecnica/migration.sql`.
* **Client atualizado:** `prisma generate` compilou os novos tipos e métodos (`prisma.produtoIngrediente`).

#### 2. Atualização das Rotas de Produtos (`src/routes/produtos.js`)
* **`POST /api/produtos`:** Cria o produto e seus ingredientes vinculados em uma única transação atômica.
* **`PUT /api/produtos/:id`:** Permite atualizar os dados do produto e sincronizar toda a receita (remove itens antigos e insere a nova composição via `prisma.$transaction`).
* **`GET /api/produtos` e `GET /api/produtos/:id`:** Retornam o produto com a receita completa discriminada (incluindo nome, unidade de cadastro e custo unitário de cada ingrediente).

---

## [30/10/2026] — Autenticação (JWT) e Controle de Acesso (GESTOR/FUNCIONARIO)

### Contexto
A tabela `usuario` existia, mas não havia login nem diferença entre gestor e funcionário: qualquer um que alcançasse a API podia chamar todas as rotas. Também faltava o `usuario_id` para gravar o `historico_custo_insumo`.

---

### O que foi feito

#### 1. Dependências e ambiente
* **`jsonwebtoken`** gera e confere o token; **`bcryptjs`** guarda a senha como hash (JavaScript puro, instala sem compilar no Windows).
* `JWT_SECRET` e `JWT_EXPIRES_IN` (padrão `8h`) no `Back/.env.example` (já existiam no `.env` da raiz e no `docker-compose.yml`). O `server.js` não sobe sem `JWT_SECRET`.

#### 2. Banco
* Migration `20261030000000_usuario_nome_unico`: o `nome` do usuário passa a ser único, pois é usado no login.

#### 3. Middlewares (`src/shared/autenticacao.js`)
* `autenticar`: exige `Authorization: Bearer <token>` e preenche `req.usuario = { id, cargo }`. Sem token, token alterado ou vencido → `401 NAO_AUTENTICADO`.
* `exigirCargo("GESTOR")`: cargo sem acesso → `403 SEM_PERMISSAO`.

#### 4. Rotas novas
* `POST /api/auth/login` (pública): `{ nome, senha }` → `{ token, usuario }`. Nome ou senha errados, ou usuário desativado → `401 CREDENCIAIS_INVALIDAS`.
* `GET /api/auth/eu`: dados de quem está logado.
* `GET /api/usuarios`, `POST /api/usuarios`, `PATCH /api/usuarios/:id/ativo` (só GESTOR).
* Script `npm run criar-gestor -- <nome> <senha>` para criar o primeiro gestor.

#### 5. Permissões nas rotas existentes
* Só `/health`, `/api/docs`, `/api/openapi.json` e `/api/auth/login` são públicos.
* FUNCIONARIO: consulta ingredientes e produtos e usa `/api/calculos`.
* GESTOR: além disso, cria, altera e apaga ingredientes, produtos (com a receita) e usuários.
* `PUT /api/ingredientes/:id` agora grava a troca de custo em `historico_custo_insumo` com o usuário logado.

> **Limite conhecido:** desativar um usuário bloqueia novos logins, mas o token que ele já tem continua valendo até vencer.

---

## [17/11/2026] — Custos fixos, precificação do produto salvo e veredito de rentabilidade

### Contexto
A tabela `custo_fixo` existia, mas não havia rota para cadastrá-la (RF12/RF13). As rotas de `/api/calculos` só funcionavam se o front mandasse todos os números, sem usar o que já está salvo no banco. E a análise de preço devolvia margem e lucro, mas não dizia se o preço era rentável.

---

### O que foi feito

#### 1. Rotas de custos fixos (`src/routes/custos-fixos.js`)
* `GET /api/custos-fixos` — lista os custos e o total do mês (`{ itens, totalMensal }`).
* `GET /api/custos-fixos/:id` — busca um custo fixo.
* `POST`, `PUT /:id`, `DELETE /:id` — só GESTOR. Nome repetido → `409 CONFLITO`.

#### 2. Precificação do produto salvo (`POST /api/produtos/:id/precificacao`)
* Recebe só `{ faturamentoMensal, despesasVariaveis, lucro }`.
* Monta a ficha técnica com a receita e o custo atual dos ingredientes, soma os custos fixos do banco, calcula o % de custo fixo sobre o faturamento, o preço sugerido (markup) e a análise do preço atual.
* A lógica fica em `src/modules/precificacao/precificacao-produto.js` (função pura, testada sem banco).
* Produto sem receita → `422 ERRO_CALCULO`. Não grava nada; FUNCIONARIO também pode usar.

#### 3. Veredito de rentabilidade
* `analisarPreco` agora devolve `situacao` (`RENTAVEL`, `ABAIXO_DA_META`, `PREJUIZO`) e `mensagem`.
* Em `/api/calculos/analise-preco`, `percentuais.lucro` (a meta) passou a ser opcional; sem ele, qualquer lucro positivo é rentável. Quem já usava a rota não quebra.

#### 4. Documentação e testes
* `/api/docs` com as rotas novas e o campo `situacao`.
* 11 testes novos (45 no total). As rotas também foram testadas com um Postgres 16 de verdade (migrations aplicadas, cadastro, conflito, 404, cálculo da coxinha).

---

## [17/11/2026] — Histórico de custo (RF10) e correção das datas 3h adiantadas

### Contexto
O `PUT /api/ingredientes/:id` já gravava cada troca de custo em `historico_custo_insumo`, mas não havia rota para consultar (RF10). E as datas gravadas pelo back (`atualizado_em`, `criado_em`, `alterado_em`) saíam 3h adiantadas no banco: uma mudança feita às 20:32 aparecia como 23:32 no `psql`.

---

### O que foi feito

#### 1. Causa do fuso
* O `@prisma/adapter-pg` (7.10) manda as datas em UTC, mas sem o `+00` no final (ex.: `2026-11-17 23:46:06`). Ao ler, ele troca o fuso que o banco devolve por `+00`.
* O nosso container do Postgres roda em `America/Sao_Paulo` (`db/dockerfile`). Então o banco entendia `23:46` como hora de Brasília e gravava 3h a mais. Pela API parecia certo (o erro se desfazia na leitura), mas o valor no banco estava errado, e qualquer data gerada pelo próprio banco (`now()`, `DEFAULT`) aparecia 3h atrasada na API.

#### 2. Correção (`src/shared/prisma.js`)
* A conexão do back abre a sessão do Postgres em UTC (`options: "-c TimeZone=UTC"`). Assim a hora gravada é a certa. O fuso do container não mudou: no `psql` as datas continuam aparecendo no horário de Brasília.
* A API devolve as datas em UTC (ISO 8601, com `Z`). O front converte para o horário local.

> **Dados antigos:** o que foi gravado pelo back antes desta correção continua 3h adiantado. Se quiser acertar o banco de desenvolvimento, rode uma vez (só nos registros gravados antes de hoje):
> ```sql
> UPDATE historico_custo_insumo SET alterado_em = alterado_em - interval '3 hours' WHERE alterado_em < '2026-11-17';
> UPDATE ingredientes  SET atualizado_em = atualizado_em - interval '3 hours' WHERE atualizado_em < '2026-11-17';
> UPDATE produtos      SET atualizado_em = atualizado_em - interval '3 hours' WHERE atualizado_em < '2026-11-17';
> UPDATE custo_fixo    SET atualizado_em = atualizado_em - interval '3 hours' WHERE atualizado_em < '2026-11-17';
> UPDATE usuario       SET criado_em     = criado_em     - interval '3 hours' WHERE criado_em     < '2026-11-17';
> ```

#### 3. Rota do histórico (`GET /api/ingredientes/:id/historico`)
* Qualquer usuário logado pode consultar.
* Devolve `{ ingrediente, itens }`: cada item tem `custoAnterior`, `custoNovo`, `alteradoEm` e o `usuario` (`id` e `nome`) que fez a mudança, do mais recente para o mais antigo.
* ID inválido → `400 DADOS_INVALIDOS`; ingrediente que não existe → `404 NAO_ENCONTRADO`.

#### 4. Documentação e testes
* `/api/docs` com a rota nova (grupo "Ingredientes").
* `tests/banco.test.js`: testes com Postgres de verdade (data gravada igual ao `now()` do banco, histórico em ordem, 404). Só rodam com `TEST_DATABASE_URL`; sem ela ficam pulados. Rodados com um Postgres 16 em `America/Sao_Paulo`: sem a correção o teste da data falha (diferença de 3h), com ela passa.
* 46 testes sem banco, 49 com banco.
