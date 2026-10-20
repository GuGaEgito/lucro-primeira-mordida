import {
  Decimal,
  dec,
  dinheiro,
  ErroCalculo,
  exigirNaoNegativo,
  exigirPositivo,
  NumeroEntrada,
  percentual,
} from "../../shared/numeros";

export interface ProdutoVenda {
  nome: string;
  precoVenda: NumeroEntrada;
  custoUnitario: NumeroEntrada;
}

export interface PontoEquilibrioProduto {
  margemContribuicaoUnitaria: Decimal;
  // Salgados a vender no mês para empatar (arredondado para cima).
  quantidade: Decimal;
  // Faturamento mensal para empatar.
  receita: Decimal;
}

export interface ItemMix extends ProdutoVenda {
  // Quantidade vendida no mês (define o peso de cada salgado no mix).
  quantidadeVendida: NumeroEntrada;
}

export interface PontoEquilibrioMix {
  margemContribuicaoMedia: Decimal;
  quantidadeTotal: Decimal;
  receita: Decimal;
  porProduto: { nome: string; quantidade: Decimal }[];
}

// Margem de contribuição unitária = preço - custo do salgado - preço x % despesas variáveis
export function margemContribuicaoUnitaria(
  produto: ProdutoVenda,
  percentualDespesasVariaveis: NumeroEntrada,
): Decimal {
  const preco = dec(produto.precoVenda);
  const custo = dec(produto.custoUnitario);
  exigirPositivo(preco, `Preço de venda de "${produto.nome}"`);
  exigirNaoNegativo(custo, `Custo unitário de "${produto.nome}"`);
  return preco.sub(custo).sub(preco.mul(percentual(percentualDespesasVariaveis)));
}

// Ponto de equilíbrio em quantidade = custos fixos mensais / margem de contribuição unitária
// Ponto de equilíbrio em R$ = quantidade x preço
export function calcularPontoEquilibrio(
  custosFixosMensais: NumeroEntrada,
  produto: ProdutoVenda,
  percentualDespesasVariaveis: NumeroEntrada,
): PontoEquilibrioProduto {
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
    quantidade,
    receita: dinheiro(quantidade.mul(dec(produto.precoVenda))),
  };
}

// Vários salgados: usa a margem de contribuição média ponderada pelo mix de vendas.
// MC média = soma(MC x quantidade vendida) / soma(quantidade vendida)
// Quantidade total = custos fixos / MC média; cada salgado fica com a sua parte do mix.
// Receita = custos fixos / (MC total / receita total)
export function calcularPontoEquilibrioMix(
  custosFixosMensais: NumeroEntrada,
  itens: ItemMix[],
  percentualDespesasVariaveis: NumeroEntrada,
): PontoEquilibrioMix {
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
