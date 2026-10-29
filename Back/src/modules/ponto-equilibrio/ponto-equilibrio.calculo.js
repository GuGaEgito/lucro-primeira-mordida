const {
  Decimal,
  dec,
  dinheiro,
  ErroCalculo,
  exigirNaoNegativo,
  exigirPositivo,
  percentual,
} = require("../../shared/numeros");

// Um produto à venda é { nome, precoVenda, custoUnitario }.
// No mix, cada item também tem quantidadeVendida no mês (define o peso de cada salgado no mix).

// Margem de contribuição unitária = preço - custo do salgado - preço x % despesas variáveis
function margemContribuicaoUnitaria(produto, percentualDespesasVariaveis) {
  const preco = dec(produto.precoVenda);
  const custo = dec(produto.custoUnitario);
  exigirPositivo(preco, `Preço de venda de "${produto.nome}"`);
  exigirNaoNegativo(custo, `Custo unitário de "${produto.nome}"`);
  return preco.sub(custo).sub(preco.mul(percentual(percentualDespesasVariaveis)));
}

// Ponto de equilíbrio em quantidade = custos fixos mensais / margem de contribuição unitária
// Ponto de equilíbrio em R$ = quantidade x preço
function calcularPontoEquilibrio(custosFixosMensais, produto, percentualDespesasVariaveis) {
  const custosFixos = dec(custosFixosMensais);
  exigirNaoNegativo(custosFixos, "Custos fixos mensais");
  const mc = margemContribuicaoUnitaria(produto, percentualDespesasVariaveis);
  if (mc.lte(0)) {
    throw new ErroCalculo(
      `"${produto.nome}" não cobre o próprio custo: a margem de contribuição precisa ser positiva`,
    );
  }
  const quantidade = custosFixos.div(mc).ceil();
  return {
    margemContribuicaoUnitaria: dinheiro(mc),
    // Salgados a vender no mês para empatar (arredondado para cima).
    quantidade,
    // Faturamento mensal para empatar.
    receita: dinheiro(quantidade.mul(dec(produto.precoVenda))),
  };
}

// Vários salgados: usa a margem de contribuição média ponderada pelo mix de vendas.
// MC média = soma(MC x quantidade vendida) / soma(quantidade vendida)
// Quantidade total = custos fixos / MC média; cada salgado fica com a sua parte do mix.
// Receita = custos fixos / (MC total / receita total)
function calcularPontoEquilibrioMix(custosFixosMensais, itens, percentualDespesasVariaveis) {
  const custosFixos = dec(custosFixosMensais);
  exigirNaoNegativo(custosFixos, "Custos fixos mensais");
  if (itens.length === 0) {
    throw new ErroCalculo("Informe ao menos um produto");
  }

  let quantidadeVendida = new Decimal(0);
  let mcTotal = new Decimal(0);
  let receitaTotal = new Decimal(0);
  for (const item of itens) {
    const qtd = dec(item.quantidadeVendida);
    exigirNaoNegativo(qtd, `Quantidade vendida de "${item.nome}"`);
    quantidadeVendida = quantidadeVendida.add(qtd);
    mcTotal = mcTotal.add(margemContribuicaoUnitaria(item, percentualDespesasVariaveis).mul(qtd));
    receitaTotal = receitaTotal.add(dec(item.precoVenda).mul(qtd));
  }
  exigirPositivo(quantidadeVendida, "Quantidade vendida total");
  if (mcTotal.lte(0)) {
    throw new ErroCalculo("O mix de vendas não gera margem de contribuição positiva");
  }

  const mcMedia = mcTotal.div(quantidadeVendida);
  const quantidadeTotal = custosFixos.div(mcMedia);
  return {
    margemContribuicaoMedia: dinheiro(mcMedia),
    quantidadeTotal: quantidadeTotal.ceil(),
    receita: dinheiro(custosFixos.div(mcTotal.div(receitaTotal))),
    porProduto: itens.map((item) => ({
      nome: item.nome,
      quantidade: quantidadeTotal.mul(dec(item.quantidadeVendida)).div(quantidadeVendida).ceil(),
    })),
  };
}

module.exports = {
  margemContribuicaoUnitaria,
  calcularPontoEquilibrio,
  calcularPontoEquilibrioMix,
};
