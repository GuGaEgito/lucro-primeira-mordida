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
