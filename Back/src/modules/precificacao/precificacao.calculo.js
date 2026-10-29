const {
  Decimal,
  dec,
  dinheiro,
  ErroCalculo,
  exigirNaoNegativo,
  exigirPositivo,
  percentual,
} = require("../../shared/numeros");

// Percentuais sobre o preço de venda (8 = 8%):
// - custoFixo: peso dos custos fixos no faturamento (ver percentualCustoFixo);
// - despesasVariaveis: despesas que acompanham cada venda: impostos (ex.: Simples), taxa de cartão, comissão, delivery;
// - lucro: lucro desejado.

function exigirPercentual(valor, campo) {
  exigirNaoNegativo(valor, campo);
  if (valor.gte(100)) {
    throw new ErroCalculo(`${campo} deve ser menor que 100%`);
  }
}

// Markup divisor = 1 - (% custo fixo + % despesas variáveis + % lucro) / 100
// Markup multiplicador = 1 / markup divisor
function calcularMarkup(percentuais) {
  const custoFixo = dec(percentuais.custoFixo);
  const despesas = dec(percentuais.despesasVariaveis);
  const lucro = dec(percentuais.lucro);
  exigirPercentual(custoFixo, "Percentual de custo fixo");
  exigirPercentual(despesas, "Percentual de despesas variáveis");
  exigirPercentual(lucro, "Percentual de lucro");

  const divisor = new Decimal(1).sub(percentual(custoFixo.add(despesas).add(lucro)));
  if (divisor.lte(0)) {
    throw new ErroCalculo(
      "A soma de custo fixo, despesas variáveis e lucro precisa ser menor que 100%",
    );
  }
  return {
    divisor: divisor.toDecimalPlaces(6),
    multiplicador: new Decimal(1).div(divisor).toDecimalPlaces(6),
  };
}

// Preço sugerido = custo do salgado / markup divisor
function calcularPrecoSugerido(custoUnitario, percentuais) {
  const custo = dec(custoUnitario);
  exigirNaoNegativo(custo, "Custo unitário");
  const markup = calcularMarkup(percentuais);
  return {
    ...markup,
    custoUnitario: custo,
    precoSugerido: dinheiro(custo.div(markup.divisor)),
  };
}

// Mostra o que um preço (sugerido ou ajustado pelo gestor) realmente deixa de margem e lucro.
// Usa só custoFixo e despesasVariaveis dos percentuais.
function analisarPreco(precoVenda, custoUnitario, percentuais) {
  const preco = dec(precoVenda);
  const custo = dec(custoUnitario);
  exigirPositivo(preco, "Preço de venda");
  exigirNaoNegativo(custo, "Custo unitário");
  const pctCustoFixo = dec(percentuais.custoFixo);
  const pctDespesas = dec(percentuais.despesasVariaveis);
  exigirPercentual(pctCustoFixo, "Percentual de custo fixo");
  exigirPercentual(pctDespesas, "Percentual de despesas variáveis");

  const despesasVariaveis = preco.mul(percentual(pctDespesas));
  const custoFixoRateado = preco.mul(percentual(pctCustoFixo));
  // Margem de contribuição = preço - custo do salgado - despesas variáveis
  const margemContribuicao = preco.sub(custo).sub(despesasVariaveis);
  // Lucro = margem de contribuição - parte do custo fixo
  const lucroUnitario = margemContribuicao.sub(custoFixoRateado);

  return {
    precoVenda: dinheiro(preco),
    custoUnitario: custo,
    despesasVariaveis: dinheiro(despesasVariaveis),
    custoFixoRateado: dinheiro(custoFixoRateado),
    margemContribuicao: dinheiro(margemContribuicao),
    margemContribuicaoPercentual: margemContribuicao.div(preco).mul(100).toDecimalPlaces(2),
    lucroUnitario: dinheiro(lucroUnitario),
    margemLucroPercentual: lucroUnitario.div(preco).mul(100).toDecimalPlaces(2),
    // CMV % (food cost) = custo do salgado / preço
    cmvPercentual: custo.div(preco).mul(100).toDecimalPlaces(2),
  };
}

module.exports = { calcularMarkup, calcularPrecoSugerido, analisarPreco };
