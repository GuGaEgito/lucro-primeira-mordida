import {
  Decimal,
  dec,
  dinheiro,
  exigirNaoNegativo,
  NumeroEntrada,
  percentual,
} from "../../shared/numeros";
import { calcularCustoFicha, FichaTecnica } from "../fichas-tecnicas/ficha-tecnica.calculo";
import { ItemMix } from "../ponto-equilibrio/ponto-equilibrio.calculo";
import { calcularPrecoSugerido, PercentuaisPreco } from "../precificacao/precificacao.calculo";

export interface ResultadoMensal {
  receita: Decimal;
  custoProdutos: Decimal;
  despesasVariaveis: Decimal;
  margemContribuicao: Decimal;
  custosFixos: Decimal;
  // Lucro = receita - custo dos salgados - despesas variáveis - custos fixos
  lucro: Decimal;
  margemLucroPercentual: Decimal;
}

// "E se eu vender X de cada salgado neste mês?"
export function simularResultadoMensal(
  custosFixosMensais: NumeroEntrada,
  itens: ItemMix[],
  percentualDespesasVariaveis: NumeroEntrada,
): ResultadoMensal {
  const custosFixos = dec(custosFixosMensais);
  exigirNaoNegativo(custosFixos, "Custos fixos mensais");

  let receita = new Decimal(0);
  let custoProdutos = new Decimal(0);
  for (const item of itens) {
    const qtd = dec(item.quantidadeVendida);
    exigirNaoNegativo(qtd, `Quantidade vendida de "${item.nome}"`);
    receita = receita.add(dec(item.precoVenda).mul(qtd));
    custoProdutos = custoProdutos.add(dec(item.custoUnitario).mul(qtd));
  }
  const despesasVariaveis = receita.mul(percentual(percentualDespesasVariaveis));
  const margemContribuicao = receita.sub(custoProdutos).sub(despesasVariaveis);
  const lucro = margemContribuicao.sub(custosFixos);

  return {
    receita: dinheiro(receita),
    custoProdutos: dinheiro(custoProdutos),
    despesasVariaveis: dinheiro(despesasVariaveis),
    margemContribuicao: dinheiro(margemContribuicao),
    custosFixos: dinheiro(custosFixos),
    lucro: dinheiro(lucro),
    margemLucroPercentual: receita.isZero()
      ? new Decimal(0)
      : lucro.div(receita).mul(100).toDecimalPlaces(2),
  };
}

export interface Reajuste {
  ingredienteId: number;
  // Variação do custo do ingrediente em % (10 = subiu 10%, -5 = caiu 5%).
  percentual: NumeroEntrada;
}

export interface SimulacaoReajuste {
  custoPorUnidadeAntes: Decimal;
  custoPorUnidadeDepois: Decimal;
  variacaoPercentual: Decimal;
  precoSugeridoAntes?: Decimal;
  precoSugeridoDepois?: Decimal;
}

// "E se a farinha subir 10%?" Recalcula o custo do salgado e, se informados os percentuais, o preço sugerido.
export function simularReajusteIngredientes(
  ficha: FichaTecnica,
  reajustes: Reajuste[],
  percentuais?: PercentuaisPreco,
): SimulacaoReajuste {
  const fatorPorIngrediente = new Map(
    reajustes.map((r) => [r.ingredienteId, new Decimal(1).add(percentual(r.percentual))]),
  );
  const fichaReajustada: FichaTecnica = {
    ...ficha,
    itens: ficha.itens.map((item) => {
      const fator = fatorPorIngrediente.get(item.ingredienteId);
      return fator ? { ...item, custoUnitario: dec(item.custoUnitario).mul(fator) } : item;
    }),
  };

  const antes = calcularCustoFicha(ficha).custoPorUnidade;
  const depois = calcularCustoFicha(fichaReajustada).custoPorUnidade;
  const resultado: SimulacaoReajuste = {
    custoPorUnidadeAntes: antes,
    custoPorUnidadeDepois: depois,
    variacaoPercentual: antes.isZero()
      ? new Decimal(0)
      : depois.sub(antes).div(antes).mul(100).toDecimalPlaces(2),
  };
  if (percentuais) {
    resultado.precoSugeridoAntes = calcularPrecoSugerido(antes, percentuais).precoSugerido;
    resultado.precoSugeridoDepois = calcularPrecoSugerido(depois, percentuais).precoSugerido;
  }
  return resultado;
}
