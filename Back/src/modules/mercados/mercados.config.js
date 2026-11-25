// Mercados consultados automaticamente. Só entram domínios desta lista fixa.
// O preço é o online de referência: a loja de São Carlos ainda não foi confirmada.
const MERCADOS = [
  {
    id: "savegnago",
    nome: "Savegnago",
    dominio: "https://www.savegnago.com.br",
    plataforma: "VTEX",
  },
  {
    id: "atacadao",
    nome: "Atacadão",
    dominio: "https://www.atacadao.com.br",
    plataforma: "VTEX",
  },
];

module.exports = { MERCADOS };
