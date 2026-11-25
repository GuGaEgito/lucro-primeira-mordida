// Coleta preços online: node scripts/coletar-precos.js [--salvar] "farinha de trigo" "oleo de soja"
// --salvar acrescenta o resultado em dados/precos.jsonl (provisório, até existir a tabela no banco).
const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: esperar } = require("node:timers/promises");
const { buscarProdutos } = require("../src/modules/mercados/conectores/vtex");
const { MERCADOS } = require("../src/modules/mercados/mercados.config");

const INTERVALO_MS = 2000;
const argumentos = process.argv.slice(2);
const salvar = argumentos.includes("--salvar");
const informados = argumentos.filter((a) => a !== "--salvar");
const termos = informados.length
  ? informados
  : ["farinha de trigo", "peito de frango", "oleo de soja", "queijo mussarela"];

async function main() {
  const arquivo = path.join(__dirname, "..", "dados", "precos.jsonl");
  let falhas = 0;
  for (const mercado of MERCADOS) {
    for (const termo of termos) {
      console.log(`\n=== ${mercado.nome}: ${termo}`);
      try {
        const itens = await buscarProdutos(mercado, termo);
        for (const i of itens) {
          const base = i.precoBase ? `R$ ${i.precoBase}/${i.unidadeBase}` : i.motivoSemBase;
          console.log(`- ${i.nome} | R$ ${i.preco} | ${base}`);
        }
        if (!itens.length) console.log("Sem produtos com preço e estoque.");
        if (salvar && itens.length) {
          fs.mkdirSync(path.dirname(arquivo), { recursive: true });
          const linhas = itens.map((i) => JSON.stringify({ termo, ...i }));
          fs.appendFileSync(arquivo, linhas.join("\n") + "\n");
        }
      } catch (erro) {
        falhas++;
        console.log(`Falhou: ${erro.message}`);
      }
      await esperar(INTERVALO_MS);
    }
  }
  if (falhas) process.exitCode = 1;
}

main();
