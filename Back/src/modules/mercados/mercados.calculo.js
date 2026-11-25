const { dec, exigirPositivo } = require("../../shared/numeros");
const { converterUnidade } = require("../../shared/unidades");

const UNIDADE_DO_TEXTO = { kg: "KG", k: "KG", g: "G", gr: "G", l: "L", lt: "L", ml: "ML" };
// Ex.: "5kg", "1k", "900 ml", "1,5L" e "12x900ml".
const TAMANHO =
  /(?:(?<![\d.,])(\d{1,3})\s*x\s*)?(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kg|ml|gr|lt|g|k|l)(?![a-zà-ú0-9])/gi;
// Ex.: "c/ 12", "caixa com 6" e "6 unidades": não dá para saber se o tamanho é do todo ou de cada um.
const VARIAS_UNIDADES =
  /(?:c\/|\bcom|\bleve|\bpack|\bfardo|\bcaixa)\s*\d+(?![\d.,]|\s*(?:kg|ml|gr|lt|g|k|l)\b)|\d+\s*(?:un|unid|unidades|und)\b/i;

// Lê o tamanho da embalagem no nome do produto ("Farinha 5kg" -> 5 KG).
// Na dúvida devolve null: melhor ficar sem comparação do que comparar errado.
function extrairEmbalagem(nome) {
  const achados = [...nome.matchAll(TAMANHO)];
  if (achados.length !== 1) return null;
  const [, multiplicador, numero, unidade] = achados[0];
  if (!multiplicador && VARIAS_UNIDADES.test(nome)) return null;

  const quantidade = dec(numero.replace(",", ".")).mul(multiplicador || 1);
  if (quantidade.lte(0)) return null;
  return { quantidade, unidade: UNIDADE_DO_TEXTO[unidade.toLowerCase()] };
}

// Preço por KG ou por L = preço / tamanho da embalagem convertido para KG ou L.
function calcularPrecoBase(preco, { quantidade, unidade }) {
  const valor = dec(preco);
  exigirPositivo(valor, "Preço");
  exigirPositivo(quantidade, "Tamanho da embalagem");
  const unidadeBase = unidade === "KG" || unidade === "G" ? "KG" : "L";
  const tamanho = converterUnidade(quantidade, unidade, unidadeBase);
  return { valor: valor.div(tamanho).toDecimalPlaces(4), unidadeBase };
}

module.exports = { extrairEmbalagem, calcularPrecoBase };
