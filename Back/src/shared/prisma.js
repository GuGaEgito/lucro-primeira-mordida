const { PrismaClient } = require("../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

// Instância única do Prisma Client compartilhada por toda a aplicação.
// Importar daqui evita abrir múltiplas conexões com o banco.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

module.exports = { prisma };
