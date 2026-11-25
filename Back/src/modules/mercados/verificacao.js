const { setTimeout: esperar } = require("node:timers/promises");
const { ErroCalculo } = require("../../shared/numeros");
const { ErroMercado, buscarProdutos } = require("./conectores/vtex");
const { MERCADOS } = require("./mercados.config");
const { compararInsumo, unidadeBaseDe } = require("./verificacao.calculo");

// Busca os termos um por vez no mercado. Se o mercado bloquear ou cair, para de insistir.
async function buscarNoMercado(mercado, termos, { buscar, intervalo }) {
  const porTermo = new Map();
  let erro = null;
  for (const [indice, termo] of termos.entries()) {
    if (indice > 0) await esperar(intervalo);
    try {
      const itens = await buscarProdutos(mercado, termo, { limite: 20, buscar });
      porTermo.set(
        termo,
        itens.map((item) => ({ ...item, mercado: mercado.nome })),
      );
    } catch (falha) {
      if (!(falha instanceof ErroMercado)) throw falha;
      erro = falha.message;
      // 400 é um termo que o site não aceitou: os outros termos ainda podem funcionar.
      if (falha.status !== 400) break;
    }
  }
  return { mercado, porTermo, erro };
}

// Consulta os mercados na hora e compara com o custo cadastrado. Não grava nada.
async function verificarInsumos(
  produto,
  { mercados = MERCADOS, buscar = fetch, intervalo = 300 } = {},
) {
  if (!produto.ingredientes.length) {
    throw new ErroCalculo("Este produto não tem receita cadastrada");
  }
  const termos = [
    ...new Set(
      produto.ingredientes
        .filter((i) => unidadeBaseDe(i.ingrediente.unidade))
        .map((i) => i.ingrediente.nome),
    ),
  ];
  const buscas = await Promise.all(
    mercados.map((m) => buscarNoMercado(m, termos, { buscar, intervalo })),
  );

  return {
    produto: { id: produto.id, nome: produto.nome },
    consultadoEm: new Date().toISOString(),
    mercados: buscas.map(({ mercado, erro }) => ({ id: mercado.id, nome: mercado.nome, erro })),
    insumos: produto.ingredientes.map((item) => {
      const nome = item.ingrediente.nome;
      const insumo = compararInsumo(
        item,
        buscas.flatMap((b) => b.porTermo.get(nome) ?? []),
      );
      // "Não encontrado" só vale se os mercados responderam a este termo.
      const falhou = buscas.some((b) => !b.porTermo.has(nome));
      if (insumo.motivo === "NAO_ENCONTRADO" && falhou) insumo.motivo = "FALHA_NA_BUSCA";
      return insumo;
    }),
  };
}

module.exports = { verificarInsumos };
