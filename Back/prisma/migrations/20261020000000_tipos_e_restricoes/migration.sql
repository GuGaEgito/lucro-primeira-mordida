-- Ajustes do schema seguindo as boas práticas de PostgreSQL:
-- 1. Datas passam a ser TIMESTAMPTZ (com fuso). Os valores que já existem foram gravados
--    pelo DEFAULT CURRENT_TIMESTAMP do banco, que roda no fuso America/Sao_Paulo.
-- 2. Índice na chave estrangeira historico_custo_insumo.usuario_id (o PostgreSQL não cria sozinho).
-- 3. CHECK para impedir custo, preço ou valor negativo direto no banco.

-- AlterTable
ALTER TABLE "usuario"
  ALTER COLUMN "criado_em" SET DATA TYPE TIMESTAMPTZ(6) USING "criado_em" AT TIME ZONE 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "ingredientes"
  ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMPTZ(6) USING "atualizado_em" AT TIME ZONE 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "produtos"
  ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMPTZ(6) USING "atualizado_em" AT TIME ZONE 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "custo_fixo"
  ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMPTZ(6) USING "atualizado_em" AT TIME ZONE 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "historico_custo_insumo"
  ALTER COLUMN "alterado_em" SET DATA TYPE TIMESTAMPTZ(6) USING "alterado_em" AT TIME ZONE 'America/Sao_Paulo';

-- CreateIndex
CREATE INDEX "idx_hist_custo_usuario" ON "historico_custo_insumo"("usuario_id");

-- AddCheck (o Prisma não representa CHECK no schema.prisma)
ALTER TABLE "ingredientes"
  ADD CONSTRAINT "ingredientes_custo_unitario_check" CHECK ("custo_unitario" >= 0);

ALTER TABLE "produtos"
  ADD CONSTRAINT "produtos_preco_venda_check" CHECK ("preco_venda" >= 0);

ALTER TABLE "custo_fixo"
  ADD CONSTRAINT "custo_fixo_valor_mensal_check" CHECK ("valor_mensal" >= 0);

ALTER TABLE "historico_custo_insumo"
  ADD CONSTRAINT "historico_custo_insumo_custos_check" CHECK ("custo_novo" >= 0 AND "custo_anterior" >= 0);
