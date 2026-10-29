const {
  Decimal,
  dec,
  dinheiro,
  exigirNaoNegativo,
  exigirPositivo,
} = require("../../shared/numeros");

// Cada custo é uma linha da tabela custo_fixo (RF12 / RF13): { nome, valorMensal }.
function totalCustosFixos(custos) {
  const total = custos.reduce((soma, custo) => {
    const valor = dec(custo.valorMensal);
    exigirNaoNegativo(valor, `Custo fixo "${custo.nome}"`);
    return soma.add(valor);
  }, new Decimal(0));
  return dinheiro(total);
}

// Quanto o custo fixo pesa no faturamento, em % (usado no markup):
// % custo fixo = custos fixos mensais / faturamento médio mensal x 100
function percentualCustoFixo(custosFixosMensais, faturamentoMensal) {
  const custos = dec(custosFixosMensais);
  const faturamento = dec(faturamentoMensal);
  exigirNaoNegativo(custos, "Custos fixos mensais");
  exigirPositivo(faturamento, "Faturamento mensal");
  return custos.div(faturamento).mul(100).toDecimalPlaces(4);
}

// Alternativa por volume: custo fixo por salgado = custos fixos mensais / salgados produzidos no mês
function custoFixoPorUnidade(custosFixosMensais, producaoMensal) {
  const custos = dec(custosFixosMensais);
  const producao = dec(producaoMensal);
  exigirNaoNegativo(custos, "Custos fixos mensais");
  exigirPositivo(producao, "Produção mensal");
  return custos.div(producao).toDecimalPlaces(4);
}

module.exports = { totalCustosFixos, percentualCustoFixo, custoFixoPorUnidade };
