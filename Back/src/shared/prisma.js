const { PrismaClient } = require("../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

// Instância única do Prisma Client compartilhada por toda a aplicação.
// Importar daqui evita abrir múltiplas conexões com o banco.
//
// Fuso: o adapter-pg envia as datas em UTC, mas sem o "+00" no final, e ao ler troca o fuso
// que o banco devolve por "+00". Se a sessão do Postgres estiver em America/Sao_Paulo (como no
// nosso container), o banco entende a hora UTC como hora de Brasília e grava tudo 3h adiantado.
// Forçar a sessão em UTC faz a hora gravada ser a certa. O fuso do servidor não muda.
const OPCOES_SESSAO = "-c TimeZone=UTC";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: OPCOES_SESSAO }),
});

module.exports = { prisma };
