-- O login é feito pelo nome, então dois usuários não podem ter o mesmo nome.
-- CreateIndex
CREATE UNIQUE INDEX "usuario_nome_key" ON "usuario"("nome");
