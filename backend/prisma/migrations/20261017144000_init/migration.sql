-- CreateEnum
CREATE TYPE "cargo_usuario" AS ENUM ('GESTOR', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "unidade_medida" AS ENUM ('KG', 'G', 'L', 'ML', 'UN');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "cargo" "cargo_usuario" NOT NULL,
    "senha" VARCHAR(100) NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "unidade" "unidade_medida" NOT NULL,
    "custo_unitario" DECIMAL(10,4) NOT NULL,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "ingredientes_id" INTEGER,
    "preco_venda" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custo_fixo" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custo_fixo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_custo_insumo" (
    "id" SERIAL NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "custo_anterior" DECIMAL(10,4),
    "custo_novo" DECIMAL(10,4) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "alterado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_custo_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_nome_key" ON "ingredientes"("nome");

-- CreateIndex
CREATE INDEX "idx_produtos_ingrediente" ON "produtos"("ingredientes_id");

-- CreateIndex
CREATE UNIQUE INDEX "custo_fixo_nome_key" ON "custo_fixo"("nome");

-- CreateIndex
CREATE INDEX "idx_hist_custo_insumo" ON "historico_custo_insumo"("insumo_id", "alterado_em" DESC);

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_ingredientes_id_fkey" FOREIGN KEY ("ingredientes_id") REFERENCES "ingredientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_custo_insumo" ADD CONSTRAINT "historico_custo_insumo_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_custo_insumo" ADD CONSTRAINT "historico_custo_insumo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
