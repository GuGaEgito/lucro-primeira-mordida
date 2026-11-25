// Cadastra 5 salgados de exemplo com ficha técnica e os ingredientes que faltarem.
// Pode rodar mais de uma vez: ingrediente que já existe (mesmo nome) é reaproveitado
// com o custo que está no banco, e salgado que já existe (mesmo nome) é pulado.
// Uso: npm run cadastrar-salgados
require("dotenv/config");
const { prisma } = require("../src/shared/prisma");

// Custo por 1 unidade de medida, em reais (referência de mercado de nov/2026).
const INGREDIENTES = {
  "Farinha de trigo": { unidade: "KG", custo: "5.50" },
  "Óleo de soja": { unidade: "L", custo: "8.00" },
  Ovo: { unidade: "UN", custo: "0.80" },
  Leite: { unidade: "L", custo: "5.50" },
  Margarina: { unidade: "KG", custo: "14.00" },
  Sal: { unidade: "KG", custo: "3.00" },
  Açúcar: { unidade: "KG", custo: "4.50" },
  "Fermento biológico seco": { unidade: "KG", custo: "60.00" },
  "Carne moída": { unidade: "KG", custo: "38.00" },
  Cebola: { unidade: "KG", custo: "5.00" },
  Tomate: { unidade: "KG", custo: "7.00" },
  "Trigo para kibe": { unidade: "KG", custo: "12.00" },
  Hortelã: { unidade: "KG", custo: "40.00" },
  Salsicha: { unidade: "KG", custo: "18.00" },
  "Queijo muçarela": { unidade: "KG", custo: "42.00" },
  "Massa de pastel": { unidade: "KG", custo: "16.00" },
  "Peito de frango": { unidade: "KG", custo: "22.00" },
  Requeijão: { unidade: "KG", custo: "30.00" },
};

// Receita de uma fornada: [ingrediente, quantidade, unidade da receita].
const SALGADOS = [
  {
    nome: "Esfiha de carne",
    rendimento: "30",
    precoVenda: "7.00",
    receita: [
      ["Farinha de trigo", "1000", "G"],
      ["Leite", "300", "ML"],
      ["Óleo de soja", "100", "ML"],
      ["Ovo", "2", "UN"],
      ["Açúcar", "30", "G"],
      ["Sal", "15", "G"],
      ["Fermento biológico seco", "10", "G"],
      ["Carne moída", "800", "G"],
      ["Cebola", "200", "G"],
      ["Tomate", "200", "G"],
    ],
  },
  {
    nome: "Kibe",
    rendimento: "25",
    precoVenda: "7.50",
    receita: [
      ["Trigo para kibe", "500", "G"],
      ["Carne moída", "700", "G"],
      ["Cebola", "150", "G"],
      ["Hortelã", "20", "G"],
      ["Sal", "15", "G"],
      ["Óleo de soja", "1000", "ML"],
    ],
  },
  {
    nome: "Enroladinho de salsicha",
    rendimento: "30",
    precoVenda: "6.00",
    receita: [
      ["Farinha de trigo", "1000", "G"],
      ["Leite", "300", "ML"],
      ["Margarina", "100", "G"],
      ["Ovo", "2", "UN"],
      ["Açúcar", "30", "G"],
      ["Sal", "10", "G"],
      ["Fermento biológico seco", "10", "G"],
      ["Salsicha", "1000", "G"],
    ],
  },
  {
    nome: "Pastel de queijo",
    rendimento: "20",
    precoVenda: "8.00",
    receita: [
      ["Massa de pastel", "1000", "G"],
      ["Queijo muçarela", "600", "G"],
      ["Óleo de soja", "1000", "ML"],
    ],
  },
  {
    nome: "Empada de frango",
    rendimento: "25",
    precoVenda: "7.50",
    receita: [
      ["Farinha de trigo", "750", "G"],
      ["Margarina", "400", "G"],
      ["Ovo", "3", "UN"],
      ["Sal", "10", "G"],
      ["Peito de frango", "700", "G"],
      ["Requeijão", "200", "G"],
      ["Cebola", "150", "G"],
      ["Tomate", "150", "G"],
    ],
  },
];

const GRUPO = { KG: "massa", G: "massa", L: "volume", ML: "volume", UN: "unidade" };

async function main() {
  await prisma.$transaction(async (tx) => {
    const ids = {};
    for (const [nome, { unidade, custo }] of Object.entries(INGREDIENTES)) {
      let ing = await tx.ingrediente.findUnique({ where: { nome } });
      if (ing) {
        console.log(`Ingrediente "${nome}" já existe (id ${ing.id}), reaproveitado.`);
      } else {
        ing = await tx.ingrediente.create({ data: { nome, unidade, custoUnitario: custo } });
        console.log(`Ingrediente "${nome}" criado (id ${ing.id}).`);
      }
      ids[nome] = ing;
    }

    for (const s of SALGADOS) {
      const existente = await tx.produto.findFirst({ where: { nome: s.nome } });
      if (existente) {
        console.log(`Salgado "${s.nome}" já existe (id ${existente.id}), pulado.`);
        continue;
      }
      for (const [nome, , unidade] of s.receita) {
        if (GRUPO[ids[nome].unidade] !== GRUPO[unidade]) {
          throw new Error(
            `"${nome}" está cadastrado em ${ids[nome].unidade}, que não converte para ${unidade}.`,
          );
        }
      }
      const produto = await tx.produto.create({
        data: {
          nome: s.nome,
          rendimento: s.rendimento,
          precoVenda: s.precoVenda,
          ingredientes: {
            create: s.receita.map(([nome, quantidade, unidadeReceita]) => ({
              ingredienteId: ids[nome].id,
              quantidade,
              unidadeReceita,
            })),
          },
        },
      });
      console.log(`Salgado "${produto.nome}" criado (id ${produto.id}).`);
    }
  });
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
