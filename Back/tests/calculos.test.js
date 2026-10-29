const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { Decimal, ErroCalculo } = require("../src/shared/numeros");
const { converterUnidade } = require("../src/shared/unidades");
const { calcularCustoFicha } = require("../src/modules/fichas-tecnicas/ficha-tecnica.calculo");
const {
  custoFixoPorUnidade,
  percentualCustoFixo,
  totalCustosFixos,
} = require("../src/modules/custos/custos.calculo");
const {
  analisarPreco,
  calcularMarkup,
  calcularPrecoSugerido,
} = require("../src/modules/precificacao/precificacao.calculo");
const {
  calcularPontoEquilibrio,
  calcularPontoEquilibrioMix,
} = require("../src/modules/ponto-equilibrio/ponto-equilibrio.calculo");
const {
  simularReajusteIngredientes,
  simularResultadoMensal,
} = require("../src/modules/simulacoes/simulacoes.calculo");

const igual = (atual, esperado) => assert.equal(atual.toString(), esperado);

// Receita de coxinha que rende 40 unidades.
const coxinha = {
  rendimento: 40,
  itens: [
    {
      ingredienteId: 1,
      nome: "Farinha",
      custoUnitario: "5.00",
      unidadeCadastro: "KG",
      quantidade: 500,
      unidadeReceita: "G",
    },
    {
      ingredienteId: 2,
      nome: "Frango",
      custoUnitario: "20.00",
      unidadeCadastro: "KG",
      quantidade: 800,
      unidadeReceita: "G",
      fatorCorrecao: "1.25",
    },
    {
      ingredienteId: 3,
      nome: "Óleo",
      custoUnitario: "8.00",
      unidadeCadastro: "L",
      quantidade: 200,
      unidadeReceita: "ML",
    },
  ],
};
const percentuais = { custoFixo: 20, despesasVariaveis: 10, lucro: 15 };

describe("unidades", () => {
  it("converte entre unidades do mesmo grupo", () => {
    igual(converterUnidade(new Decimal(500), "G", "KG"), "0.5");
    igual(converterUnidade(new Decimal(2), "L", "ML"), "2000");
  });
  it("recusa grupos diferentes", () => {
    assert.throws(() => converterUnidade(new Decimal(1), "KG", "L"), ErroCalculo);
  });
});

describe("ficha técnica", () => {
  it("calcula custo da receita e por salgado, com fator de correção", () => {
    const custo = calcularCustoFicha(coxinha);
    assert.deepEqual(
      custo.itens.map((i) => i.custo.toFixed(2)),
      ["2.50", "20.00", "1.60"],
    );
    igual(custo.itens[1].quantidadeBruta, "1");
    igual(custo.custoTotalReceita, "24.1");
    igual(custo.custoPorUnidade, "0.6025");
  });
  it("aceita o Decimal do Prisma (qualquer objeto com toString)", () => {
    const custo = calcularCustoFicha({
      rendimento: 1,
      itens: [
        {
          ingredienteId: 1,
          custoUnitario: { toString: () => "3.5" },
          unidadeCadastro: "UN",
          quantidade: 2,
          unidadeReceita: "UN",
        },
      ],
    });
    igual(custo.custoPorUnidade, "7");
  });
  it("recusa rendimento zero e fator de correção menor que 1", () => {
    assert.throws(() => calcularCustoFicha({ ...coxinha, rendimento: 0 }), ErroCalculo);
    assert.throws(
      () =>
        calcularCustoFicha({
          rendimento: 1,
          itens: [{ ...coxinha.itens[0], fatorCorrecao: "0.9" }],
        }),
      ErroCalculo,
    );
  });
});

describe("custos fixos", () => {
  it("soma e calcula o peso no faturamento e por unidade", () => {
    igual(
      totalCustosFixos([
        { nome: "Aluguel", valorMensal: "1500" },
        { nome: "Energia", valorMensal: "450.50" },
      ]),
      "1950.5",
    );
    igual(percentualCustoFixo(2000, 10000), "20");
    igual(custoFixoPorUnidade(3000, 4000), "0.75");
  });
  it("recusa faturamento zero", () => {
    assert.throws(() => percentualCustoFixo(1000, 0), ErroCalculo);
  });
});

describe("precificação", () => {
  it("calcula markup divisor e multiplicador", () => {
    const markup = calcularMarkup(percentuais);
    igual(markup.divisor, "0.55");
    igual(markup.multiplicador, "1.818182");
  });
  it("sugere preço = custo / markup divisor, arredondado em centavos", () => {
    igual(calcularPrecoSugerido("0.6025", percentuais).precoSugerido, "1.1");
  });
  it("recusa percentuais que somam 100% ou mais", () => {
    assert.throws(
      () => calcularMarkup({ custoFixo: 40, despesasVariaveis: 30, lucro: 30 }),
      ErroCalculo,
    );
  });
  it("analisa margem e lucro de um preço", () => {
    const analise = analisarPreco("1.10", "0.6025", percentuais);
    igual(analise.despesasVariaveis, "0.11");
    igual(analise.custoFixoRateado, "0.22");
    igual(analise.margemContribuicao, "0.39");
    igual(analise.margemContribuicaoPercentual, "35.23");
    igual(analise.lucroUnitario, "0.17");
    igual(analise.margemLucroPercentual, "15.23");
    igual(analise.cmvPercentual, "54.77");
  });
});

describe("ponto de equilíbrio", () => {
  it("calcula para um produto", () => {
    const pe = calcularPontoEquilibrio(
      3000,
      { nome: "Coxinha", precoVenda: 5, custoUnitario: "1.5" },
      10,
    );
    igual(pe.margemContribuicaoUnitaria, "3");
    igual(pe.quantidade, "1000");
    igual(pe.receita, "5000");
  });
  it("recusa margem de contribuição negativa", () => {
    assert.throws(
      () => calcularPontoEquilibrio(3000, { nome: "Prejuízo", precoVenda: 1, custoUnitario: 2 }, 0),
      ErroCalculo,
    );
  });
  it("calcula para um mix de produtos", () => {
    const pe = calcularPontoEquilibrioMix(
      3000,
      [
        { nome: "Coxinha", precoVenda: 5, custoUnitario: "1.5", quantidadeVendida: 300 },
        { nome: "Esfiha", precoVenda: 8, custoUnitario: 3, quantidadeVendida: 100 },
      ],
      10,
    );
    igual(pe.margemContribuicaoMedia, "3.3");
    igual(pe.quantidadeTotal, "910");
    igual(pe.receita, "5227.27");
    assert.deepEqual(
      pe.porProduto.map((p) => p.quantidade.toString()),
      ["682", "228"],
    );
  });
});

describe("simulações", () => {
  it("simula o resultado do mês", () => {
    const r = simularResultadoMensal(
      1000,
      [
        { nome: "Coxinha", precoVenda: 5, custoUnitario: "1.5", quantidadeVendida: 300 },
        { nome: "Esfiha", precoVenda: 8, custoUnitario: 3, quantidadeVendida: 100 },
      ],
      10,
    );
    igual(r.receita, "2300");
    igual(r.custoProdutos, "750");
    igual(r.despesasVariaveis, "230");
    igual(r.margemContribuicao, "1320");
    igual(r.lucro, "320");
    igual(r.margemLucroPercentual, "13.91");
  });
  it("simula reajuste de ingrediente no custo e no preço sugerido", () => {
    const s = simularReajusteIngredientes(
      coxinha,
      [{ ingredienteId: 2, percentual: 10 }],
      percentuais,
    );
    igual(s.custoPorUnidadeAntes, "0.6025");
    igual(s.custoPorUnidadeDepois, "0.6525");
    igual(s.variacaoPercentual, "8.3");
    igual(s.precoSugeridoAntes, "1.1");
    igual(s.precoSugeridoDepois, "1.19");
  });
});
