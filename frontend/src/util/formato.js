// A API devolve dinheiro e percentuais como texto ("1.1", "35.23").
// Estas funções transformam em número e mostram no jeito brasileiro.

const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda4Fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const numFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const dataFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

export function reais(v) {
  const x = n(v);
  return Number.isFinite(x) ? moedaFmt.format(x) : "—";
}

// Custo por salgado tem até 4 casas (R$ 0,5625).
export function reaisFino(v) {
  const x = n(v);
  return Number.isFinite(x) ? moeda4Fmt.format(x) : "—";
}

export function numero(v) {
  const x = n(v);
  return Number.isFinite(x) ? numFmt.format(x) : "—";
}

export function pct(v) {
  const x = n(v);
  return Number.isFinite(x) ? `${pctFmt.format(x)}%` : "—";
}

export function data(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : dataFmt.format(d);
}

// Aceita "1,50" ou "1.50" digitado pelo usuário e devolve número (ou NaN).
export function lerNumero(texto) {
  if (typeof texto === "number") return texto;
  if (texto === null || texto === undefined) return NaN;
  const limpo = String(texto).trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (limpo === "") return NaN;
  return /^-?\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : NaN;
}

export const UNIDADES = [
  { valor: "KG", nome: "quilo (kg)" },
  { valor: "G", nome: "grama (g)" },
  { valor: "L", nome: "litro (L)" },
  { valor: "ML", nome: "mililitro (ml)" },
  { valor: "UN", nome: "unidade (un)" },
];

export function unidadesCompativeis(unidade) {
  if (unidade === "KG" || unidade === "G") return ["KG", "G"];
  if (unidade === "L" || unidade === "ML") return ["L", "ML"];
  return ["UN"];
}

export const rotuloUnidade = (u) => ({ KG: "kg", G: "g", L: "L", ML: "ml", UN: "un" })[u] || u;
