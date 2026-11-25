const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calcularPrecoBase, extrairEmbalagem } = require("../src/modules/mercados/mercados.calculo");
const { buscarProdutos } = require("../src/modules/mercados/conectores/vtex");

const mercado = { id: "teste", nome: "Teste", dominio: "https://mercado.test" };

function produto(nome, preco, { estoque = 10, unidade = "un", multiplicador = 1 } = {}) {
  const commertialOffer = { Price: preco, AvailableQuantity: estoque };
  return {
    productId: "1",
    productName: nome,
    items: [
      {
        itemId: "2",
        measurementUnit: unidade,
        unitMultiplier: multiplicador,
        sellers: [{ sellerId: "1", commertialOffer }],
      },
    ],
  };
}

const responder = (corpo, status = 200) => ({
  buscar: async () => new Response(JSON.stringify(corpo), { status }),
});

describe("Embalagem e preço-base", () => {
  for (const [nome, quantidade, unidade] of [
    ["Farinha Nita 5kg", "5", "KG"],
    ["Farinha Trigo Renata 1k Especial", "1", "KG"],
    ["Queijo Tirolez Fatiado150g", "150", "G"],
    ["Óleo Soja 900ml", "900", "ML"],
    ["Óleo 12x900ml", "10800", "ML"],
    ["Leite 1,5 L", "1.5", "L"],
  ]) {
    it(`lê "${nome}"`, () => {
      const embalagem = extrairEmbalagem(nome);
      assert.equal(embalagem.quantidade.toString(), quantidade);
      assert.equal(embalagem.unidade, unidade);
    });
  }

  for (const nome of ["Coxinha", "Frango 1kg a 2kg", "Óleo 900ml c/ 12", "Molho 300g 6 unidades"]) {
    it(`não adivinha "${nome}"`, () => assert.equal(extrairEmbalagem(nome), null));
  }

  it("calcula por kg e por litro", () => {
    const base = (preco, nome) => calcularPrecoBase(preco, extrairEmbalagem(nome)).valor.toString();
    assert.equal(base(202.3, "Frango 17kg"), "11.9");
    assert.equal(base(7.69, "Óleo 900ml"), "8.5444");
  });
});

describe("Conector VTEX", () => {
  it("normaliza e descarta preço zero e falta de estoque", async () => {
    const corpo = [
      produto("Farinha 5kg", 13.99),
      produto("Farinha 1kg", 0),
      produto("Farinha 2kg", 8, { estoque: 0 }),
    ];
    const itens = await buscarProdutos(mercado, "farinha", responder(corpo));
    assert.equal(itens.length, 1);
    assert.equal(itens[0].precoBase, "2.798");
  });

  it("não calcula base de venda fracionada", async () => {
    const corpo = [produto("Filezinho quilo", 20.99, { unidade: "kg", multiplicador: 0.2 })];
    const [item] = await buscarProdutos(mercado, "frango", responder(corpo));
    assert.equal(item.precoBase, null);
    assert.equal(item.motivoSemBase, "VENDA_FRACIONADA");
  });

  it("codifica espaço como %20 na busca", async () => {
    let chamada;
    const buscar = async (url) => {
      chamada = url.href;
      return new Response("[]");
    };
    await buscarProdutos(mercado, "oleo de soja", { buscar });
    assert.match(chamada, /ft=oleo%20de%20soja&_from=0&_to=9$/);
  });

  it("avisa bloqueio, formato inesperado e falha de rede", async () => {
    await assert.rejects(buscarProdutos(mercado, "x", responder({}, 403)), { status: 403 });
    await assert.rejects(buscarProdutos(mercado, "x", responder({ a: 1 })), /formato/);
    const buscar = async () => {
      throw new Error("sem rede");
    };
    await assert.rejects(buscarProdutos(mercado, "x", { buscar }), /sem rede/);
  });
});
