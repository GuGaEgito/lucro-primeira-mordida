const Decimal = require("decimal.js");

// Os números de entrada podem ser number, string, Decimal (decimal.js) ou o Decimal do Prisma (via toString).

class ErroCalculo extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroCalculo";
  }
}

function dec(valor) {
  if (typeof valor === "number" || typeof valor === "string" || valor instanceof Decimal) {
    return new Decimal(valor);
  }
  return new Decimal(valor.toString());
}

// Converte percentual (ex.: 8 = 8%) para fração (0.08).
function percentual(valor) {
  return dec(valor).div(100);
}

// Arredonda para centavos (meio para cima), usado só no resultado final.
function dinheiro(valor) {
  return valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function exigirPositivo(valor, campo) {
  if (!valor.isFinite() || valor.lte(0)) {
    throw new ErroCalculo(`${campo} deve ser maior que zero`);
  }
}

function exigirNaoNegativo(valor, campo) {
  if (!valor.isFinite() || valor.lt(0)) {
    throw new ErroCalculo(`${campo} não pode ser negativo`);
  }
}

module.exports = {
  Decimal,
  ErroCalculo,
  dec,
  percentual,
  dinheiro,
  exigirPositivo,
  exigirNaoNegativo,
};
