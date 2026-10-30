-- AlterTable produtos
ALTER TABLE "produtos" DROP CONSTRAINT IF EXISTS "produtos_ingredientes_id_fkey";
DROP INDEX IF EXISTS "idx_produtos_ingrediente";
ALTER TABLE "produtos" DROP COLUMN IF EXISTS "ingredientes_id";
ALTER TABLE "produtos" ADD COLUMN "rendimento" DECIMAL(10,2) NOT NULL DEFAULT 1;
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_rendimento_check" CHECK ("rendimento" > 0);

-- CreateTable produto_ingredientes
CREATE TABLE "produto_ingredientes" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "ingrediente_id" INTEGER NOT NULL,
    "quantidade" DECIMAL(10,4) NOT NULL,
    "unidade_receita" "unidade_medida" NOT NULL,

    CONSTRAINT "produto_ingredientes_pkey" PRIMARY KEY ("id")
);

-- Constraints e Índices
CREATE UNIQUE INDEX "uq_produto_ingrediente" ON "produto_ingredientes"("produto_id", "ingrediente_id");
CREATE INDEX "idx_prod_ing_ingrediente" ON "produto_ingredientes"("ingrediente_id");

ALTER TABLE "produto_ingredientes" ADD CONSTRAINT "produto_ingredientes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "produto_ingredientes" ADD CONSTRAINT "produto_ingredientes_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "produto_ingredientes" ADD CONSTRAINT "produto_ingredientes_quantidade_check" CHECK ("quantidade" > 0);
