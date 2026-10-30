// Cria o primeiro gestor (sem nenhum usuário no banco ninguém consegue fazer login).
// Uso: npm run criar-gestor -- <nome> <senha>
require("dotenv/config");
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/shared/prisma");

async function main() {
  const [nome, senha] = process.argv.slice(2);
  if (!nome || !senha) {
    console.error("Uso: npm run criar-gestor -- <nome> <senha>");
    process.exitCode = 1;
    return;
  }

  const existente = await prisma.usuario.findUnique({ where: { nome } });
  if (existente) {
    console.error(`Já existe um usuário chamado "${nome}" (id ${existente.id}).`);
    process.exitCode = 1;
    return;
  }

  const usuario = await prisma.usuario.create({
    data: { nome, cargo: "GESTOR", senha: await bcrypt.hash(senha, 10) },
  });
  console.log(`Gestor "${usuario.nome}" criado com id ${usuario.id}.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
