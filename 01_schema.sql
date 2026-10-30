-- =====================================================================
-- A CASA DO SALGADO - Banco de dados (PostgreSQL)
-- Baseado no modelo atual do grupo. NÃO altera o schema.prisma.
--
-- Uso:
--   createdb casa_do_salgado
--   psql -d casa_do_salgado -f criar_banco_casa_do_salgado.sql
-- =====================================================================

-- ---------- TIPOS ----------
CREATE TYPE cargo_usuario  AS ENUM ('GESTOR', 'FUNCIONARIO');
CREATE TYPE unidade_medida AS ENUM ('KG', 'G', 'L', 'ML', 'UN');

-- ---------- USUÁRIO ----------
CREATE TABLE usuario (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(50)  NOT NULL UNIQUE,              -- usado no login
    cargo     cargo_usuario NOT NULL,
    senha     VARCHAR(100) NOT NULL,                 -- hash, nunca texto puro
    criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ativo     BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------- INGREDIENTES ----------
CREATE TABLE ingredientes (
    id             SERIAL PRIMARY KEY,
    nome           VARCHAR(50)    NOT NULL UNIQUE,
    unidade        unidade_medida NOT NULL,
    custo_unitario NUMERIC(10,4)  NOT NULL CHECK (custo_unitario >= 0),  -- custo por 1 unidade de medida
    atualizado_em  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------- PRODUTOS ----------
CREATE TABLE produtos (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(50) NOT NULL,
    ingredientes_id INT REFERENCES ingredientes(id),
    preco_venda     NUMERIC(10,2) CHECK (preco_venda IS NULL OR preco_venda >= 0), -- preço final aprovado (sugerido ou ajustado)
    ativo           BOOLEAN   NOT NULL DEFAULT TRUE,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- CUSTO FIXO (RF12 / RF13) ----------
CREATE TABLE custo_fixo (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(50)   NOT NULL UNIQUE,     -- ex.: Aluguel, Energia, Gás, Salários
    valor_mensal  NUMERIC(10,2) NOT NULL CHECK (valor_mensal >= 0),
    atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------- HISTÓRICO DE CUSTO DO INGREDIENTE (RF10) ----------
CREATE TABLE historico_custo_insumo (
    id             SERIAL PRIMARY KEY,
    insumo_id      INT NOT NULL REFERENCES ingredientes(id),   -- aponta para ingredientes.id
    custo_anterior NUMERIC(10,4) CHECK (custo_anterior >= 0),
    custo_novo     NUMERIC(10,4) NOT NULL CHECK (custo_novo >= 0),
    usuario_id     INT NOT NULL REFERENCES usuario(id),
    alterado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- ÍNDICES ----------
CREATE INDEX idx_produtos_ingrediente ON produtos(ingredientes_id);
CREATE INDEX idx_hist_custo_insumo    ON historico_custo_insumo(insumo_id, alterado_em DESC);
CREATE INDEX idx_hist_custo_usuario   ON historico_custo_insumo(usuario_id);
