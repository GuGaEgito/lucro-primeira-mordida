import {
  Decimal,
  dec,
  dinheiro,
  exigirNaoNegativo,
  exigirPositivo,
  NumeroEntrada,
} from "../../shared/numeros";

// Linha da tabela custo_fixo (RF12 / RF13).
export interface CustoFixoMensal {
  nome: string;
  valorMensal: NumeroEntrada;
}

export function totalCustosFixos(custos: CustoFixoMensal[]): Decimal {
  const total = custos.reduce((soma, custo) => {
    const valor = dec(custo.valorMensal);
    exigirNaoNegativo(valor, `Custo fixo "${custo.nome}"`);
    return soma.add(valor);
  }, new Decimal(0));
  return dinheiro(total);
}

// Quanto o custo fixo pesa no faturamento, em % (usado no markup):
// % custo fixo = custos fixos mensais / faturamento médio mensal x 100
export function percentualCustoFixo(
  custosFixosMensais: NumeroEntrada,
  faturamentoMensal: NumeroEntrada,
): Decimal {
  const custos = dec(custosFixosMensais);
  const faturamento = dec(faturamentoMensal);
  exigirNaoNegativo(custos, "Custos fixos mensais");
  exigirPositivo(faturamento, "Faturamento mensal");
  return custos.div(faturamento).mul(100).toDecimalPlaces(4);
}

// Alternativa por volume: custo fixo por salgado = custos fixos mensais / salgados produzidos no mês
export function custoFixoPorUnidade(
  custosFixosMensais: NumeroEntrada,
  producaoMensal: NumeroEntrada,
): Decimal {
  const custos = dec(custosFixosMensais);
  const producao = dec(producaoMensal);
  exigirNaoNegativo(custos, "Custos fixos mensais");
  exigirPositivo(producao, "Produção mensal");
  return custos.div(producao).toDecimalPlaces(4);
}
