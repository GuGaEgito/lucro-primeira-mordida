const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { combina, compararInsumo } = require("../src/modules/mercados/verificacao.calculo");
const { verificarInsumos } = require("../src/modules/mercados/verificacao");

const receita = (nome, unidade, custoUnitario, quantidade = 500, unidadeReceita = "G") => ({
  quantidade,
  unidadeReceita,
  ingrediente: { id: 1, nome, unidade, custoUnitario },
});
const achado = (nome, precoBase, unidadeBase = "KG") => ({ nome, precoBase, unidadeBase });

const produtoVtex = (nome, preco) => ({
  productId: "1",
  productName: nome,
  items: [
    {
      itemId: "1",
      sellers: [{ sellerId: "1", commertialOffer: { Price: preco, AvailableQuantity: 5 } }],
    },
  ],
});
const mercados = [
  { id: "a", nome: "A", dominio: "https://a.test" },
  { id: "b", nome: "B", dominio: "https://b.test" },
];

describe("Verificação de insumos", () => {
  it("escolhe só produtos parecidos com o ingrediente", () => {
    assert.ok(combina("Peito de frango", "Filé de Peito de Frango Seara 1kg"));
    assert.ok(combina("Queijo mussarela", "Queijo Muçarela Galbani 300g"));
    assert.ok(combina("Farinha de trigo", "Farinha de Trigo Nita Para Pizza 5kg"));
    assert.ok(combina("Óleo de soja", "Oleo Soja Vitaliv 900ml"));
    assert.ok(!combina("Peito de frango", "Sopa VONO Peito de Frango 17g"));
    assert.ok(!combina("Peito de frango", "Empanado Peito Frango 110g"));
    assert.ok(!combina("Mussarela", "Pizza de mussarela 440g"));
    assert.ok(!combina("Farinha de trigo", "Farinha de rosca 500g"));
  });

  it("diz quanto paga a mais, a menos ou igual, do mais barato ao mais caro", () => {
    const { precoPago, opcoes } = compararInsumo(receita("Farinha de trigo", "KG", "5"), [
      achado("Farinha de trigo C 1kg", "6.25"),
      achado("Farinha de trigo A 1kg", "4"),
      achado("Farinha de trigo B 1kg", "5.05"),
    ]);
    assert.equal(precoPago, "5");
    assert.deepEqual(
      opcoes.map((o) => [o.situacao, o.diferenca, o.diferencaPercentual, o.diferencaReceita]),
      [
        ["PAGANDO_MAIS", "1", "25", "0.5"],
        ["IGUAL", "-0.05", "-1", "-0.03"],
        ["PAGANDO_MENOS", "-1.25", "-20", "-0.63"],
      ],
    );
  });

  it("converte custo cadastrado em grama ou mililitro", () => {
    const item = receita("Óleo de soja", "ML", "0.009", 200, "ML");
    const { precoPago, opcoes } = compararInsumo(item, [achado("Óleo de soja 900ml", "8", "L")]);
    assert.equal(precoPago, "9");
    assert.equal(opcoes[0].diferencaReceita, "0.2");
  });

  it("explica quando não dá para comparar", () => {
    const motivo = (item, produtos = []) => compararInsumo(item, produtos).motivo;
    assert.equal(motivo(receita("Ovo", "UN", "1", 2, "UN")), "VENDIDO_POR_UNIDADE");
    assert.equal(motivo(receita("Sal", "KG", "0")), "SEM_CUSTO");
    assert.equal(motivo(receita("Sal", "KG", "2"), [achado("Sal 1L", "2", "L")]), "NAO_ENCONTRADO");
  });

  it("segue com um mercado quando o outro bloqueia, sem insistir", async () => {
    const chamadas = { "a.test": 0, "b.test": 0 };
    const buscar = async (url) => {
      chamadas[url.host]++;
      if (url.host === "b.test") return new Response("", { status: 403 });
      const sal = url.search.includes("Sal");
      return new Response(JSON.stringify(sal ? [produtoVtex("Sal 1kg", 2)] : []));
    };
    const produto = {
      id: 7,
      nome: "Coxinha",
      ingredientes: [receita("Sal", "KG", "3"), receita("Trigo", "KG", "3")],
    };
    const r = await verificarInsumos(produto, { mercados, buscar, intervalo: 0 });
    assert.deepEqual(chamadas, { "a.test": 2, "b.test": 1 });
    assert.equal(r.mercados[0].erro, null);
    assert.match(r.mercados[1].erro, /403/);
    assert.equal(r.insumos[0].opcoes[0].mercado, "A");
    assert.equal(r.insumos[1].motivo, "FALHA_NA_BUSCA");
  });

  it("recusa produto sem receita", async () => {
    const produto = { id: 1, nome: "X", ingredientes: [] };
    await assert.rejects(verificarInsumos(produto), /receita/);
  });
});
