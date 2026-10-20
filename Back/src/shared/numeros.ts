import Decimal from "decimal.js";

// Aceita number, string, Decimal (decimal.js) ou o Decimal do Prisma (via toString).
export type NumeroEntrada = Decimal.Value | { toString(): string };

export class ErroCalculo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroCalculo";
  }
}

export function dec(valor: NumeroEntrada): Decimal {
  if (typeof valor === "number" || typeof valor === "string" || valor instanceof Decimal) {
    return new Decimal(valor);
  }
  return new Decimal(valor.toString());
}

// Converte percentual (ex.: 8 = 8%) para fração (0.08).
export function percentual(valor: NumeroEntrada): Decimal {
  return dec(valor).div(100);
}

// Arredonda para centavos (meio para cima), usado só no resultado final.
export function dinheiro(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function exigirPositivo(valor: Decimal, campo: string): void {
  if (!valor.isFinite() || valor.lte(0)) {
    throw new ErroCalculo(`${campo} deve ser maior que zero`);
  }
}

export function exigirNaoNegativo(valor: Decimal, campo: string): void {
  if (!valor.isFinite() || valor.lt(0)) {
    throw new ErroCalculo(`${campo} não pode ser negativo`);
  }
}

export { Decimal };
