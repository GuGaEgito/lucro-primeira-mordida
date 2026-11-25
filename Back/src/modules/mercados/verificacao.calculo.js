const { dec, dinheiro } = require("../../shared/numeros");
const { converterUnidade } = require("../../shared/unidades");

const LIGACOES = new Set(["de", "da", "do", "para", "com", "e", "em", "a", "o", "tipo"]);
// Se uma destas palavras está no produto e não no ingrediente, é outro tipo de produto.
const DESCARTE = new Set(
  (
    "empanado empanada desfiado desfiada defumado defumada temperado temperada cozido cozida " +
    "recheado recheada recheio sabor composto composta fermento integral racao chester"
  ).split(" "),
);
// O mesmo, mas só quando é a primeira palavra ("Pizza de mussarela" sai, "Farinha para pizza" fica).
const DESCARTE_NO_INICIO = new Set(
  (
    "pizza sopa caldo tempero lasanha salgadinho biscoito molho pao hamburguer linguica salsicha " +
    "macarrao massa mistura bolo torta snack petisco empada coxinha"
  ).split(" "),
);
// Diferenças de até 2% contam como o mesmo preço.
const TOLERANCIA = 2;

function palavras(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/mucarela|muzarela|mozarela/g, "mussarela")
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !LIGACOES.has(p))
    .map((p) => (p.length > 3 ? p.replace(/s$/, "") : p));
}

// Regra simples, sem IA: o nome do produto precisa ter todas as palavras do ingrediente.
function combina(nomeIngrediente, nomeProduto) {
  const procuradas = palavras(nomeIngrediente);
  const doProduto = palavras(nomeProduto);
  if (!procuradas.length || !procuradas.every((p) => doProduto.includes(p))) return false;
  if (doProduto.some((p) => DESCARTE.has(p) && !procuradas.includes(p))) return false;
  return !DESCARTE_NO_INICIO.has(doProduto[0]) || procuradas.includes(doProduto[0]);
}

function unidadeBaseDe(unidade) {
  if (unidade === "KG" || unidade === "G") return "KG";
  if (unidade === "L" || unidade === "ML") return "L";
  return null;
}

// Compara o custo cadastrado com cada produto encontrado, sempre por KG ou por L.
// diferença % = (preço pago - preço do mercado) / preço do mercado x 100
function compararInsumo(itemReceita, produtos) {
  const { ingrediente, quantidade, unidadeReceita } = itemReceita;
  const unidadeBase = unidadeBaseDe(ingrediente.unidade);
  const resultado = {
    ingredienteId: ingrediente.id,
    nome: ingrediente.nome,
    unidadeBase,
    precoPago: null,
    motivo: null,
    opcoes: [],
  };
  if (!unidadeBase) return { ...resultado, motivo: "VENDIDO_POR_UNIDADE" };

  const custo = dec(ingrediente.custoUnitario);
  if (custo.lte(0)) return { ...resultado, motivo: "SEM_CUSTO" };
  const pago = custo.div(converterUnidade(dec(1), ingrediente.unidade, unidadeBase));
  const naReceita = converterUnidade(dec(quantidade), unidadeReceita, unidadeBase);

  const opcoes = produtos
    .filter((p) => p.unidadeBase === unidadeBase && combina(ingrediente.nome, p.nome))
    .sort((a, b) => dec(a.precoBase).cmp(dec(b.precoBase)))
    .map((p) => {
      const mercado = dec(p.precoBase);
      const diferenca = pago.sub(mercado);
      const percentual = diferenca.div(mercado).mul(100);
      let situacao = "IGUAL";
      if (percentual.gt(TOLERANCIA)) situacao = "PAGANDO_MAIS";
      else if (percentual.lt(-TOLERANCIA)) situacao = "PAGANDO_MENOS";
      return {
        mercadoId: p.mercadoId,
        mercado: p.mercado,
        skuId: p.skuId,
        produto: p.nome,
        link: p.link,
        preco: p.preco,
        precoBase: dinheiro(mercado).toString(),
        situacao,
        diferenca: dinheiro(diferenca).toString(),
        diferencaPercentual: percentual.toDecimalPlaces(1).toString(),
        diferencaReceita: dinheiro(diferenca.mul(naReceita)).toString(),
      };
    });

  return {
    ...resultado,
    precoPago: dinheiro(pago).toString(),
    motivo: opcoes.length ? null : "NAO_ENCONTRADO",
    opcoes,
  };
}

module.exports = { combina, compararInsumo, unidadeBaseDe };
