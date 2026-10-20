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

// Percentuais sobre o preço de venda (8 = 8%).
export interface PercentuaisPreco {
  // Peso dos custos fixos no faturamento (ver percentualCustoFixo).
  custoFixo: NumeroEntrada;
  // Despesas que acompanham cada venda: impostos (ex.: Simples), taxa de cartão, comissão, delivery.
  despesasVariaveis: NumeroEntrada;
  // Lucro desejado.
  lucro: NumeroEntrada;
}

export interface Markup {
  divisor: Decimal;
  multiplicador: Decimal;
}

export interface PrecoSugerido extends Markup {
  custoUnitario: Decimal;
  precoSugerido: Decimal;
}

export interface AnalisePreco {
  precoVenda: Decimal;
  custoUnitario: Decimal;
  despesasVariaveis: Decimal;
  custoFixoRateado: Decimal;
  // Margem de contribuição = preço - custo do salgado - despesas variáveis
  margemContribuicao: Decimal;
  margemContribuicaoPercentual: Decimal;
  // Lucro = margem de contribuição - parte do custo fixo
  lucroUnitario: Decimal;
  margemLucroPercentual: Decimal;
  // CMV % (food cost) = custo do salgado / preço
  cmvPercentual: Decimal;
}

function exigirPercentual(valor: Decimal, campo: string): void {
  exigirNaoNegativo(valor, campo);
  if (valor.gte(100)) {
    throw new ErroCalculo(`${campo} deve ser menor que 100%`);
  }
}

// Markup divisor = 1 - (% custo fixo + % despesas variáveis + % lucro) / 100
// Markup multiplicador = 1 / markup divisor
export function calcularMarkup(percentuais: PercentuaisPreco): Markup {
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
export function calcularPrecoSugerido(
  custoUnitario: NumeroEntrada,
  percentuais: PercentuaisPreco,
): PrecoSugerido {
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
export function analisarPreco(
  precoVenda: NumeroEntrada,
  custoUnitario: NumeroEntrada,
  percentuais: Pick<PercentuaisPreco, "custoFixo" | "despesasVariaveis">,
): AnalisePreco {
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
  const margemContribuicao = preco.sub(custo).sub(despesasVariaveis);
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
    cmvPercentual: custo.div(preco).mul(100).toDecimalPlaces(2),
  };
}
