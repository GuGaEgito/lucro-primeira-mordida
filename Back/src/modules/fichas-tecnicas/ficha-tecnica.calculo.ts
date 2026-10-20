import {
  Decimal,
  dec,
  dinheiro,
  ErroCalculo,
  exigirNaoNegativo,
  exigirPositivo,
  NumeroEntrada,
} from "../../shared/numeros";
import { converterUnidade, UnidadeMedida } from "../../shared/unidades";

// Um item da ficha técnica: quanto de um ingrediente entra na receita.
export interface ItemFicha {
  ingredienteId: number;
  nome?: string;
  // Custo por 1 unidade de medida do cadastro (ingredientes.custo_unitario).
  custoUnitario: NumeroEntrada;
  unidadeCadastro: UnidadeMedida;
  // Quantidade usada na receita (peso líquido) e a unidade em que foi informada.
  quantidade: NumeroEntrada;
  unidadeReceita: UnidadeMedida;
  // Fator de correção (peso bruto / peso líquido) para perdas no preparo. Padrão 1.
  fatorCorrecao?: NumeroEntrada;
}

export interface FichaTecnica {
  itens: ItemFicha[];
  // Quantos salgados a receita rende.
  rendimento: NumeroEntrada;
}

export interface CustoItem {
  ingredienteId: number;
  nome?: string;
  quantidadeBruta: Decimal; // na unidade do cadastro
  custo: Decimal;
}

export interface CustoFicha {
  itens: CustoItem[];
  custoTotalReceita: Decimal;
  custoPorUnidade: Decimal;
}

// Custo de um ingrediente na receita:
// quantidade bruta = quantidade líquida x fator de correção (convertida para a unidade do cadastro)
// custo = quantidade bruta x custo unitário
export function calcularCustoItem(item: ItemFicha): CustoItem {
  const quantidade = dec(item.quantidade);
  const custoUnitario = dec(item.custoUnitario);
  const fatorCorrecao = dec(item.fatorCorrecao ?? 1);
  exigirNaoNegativo(quantidade, "Quantidade do ingrediente");
  exigirNaoNegativo(custoUnitario, "Custo unitário do ingrediente");
  if (!fatorCorrecao.isFinite() || fatorCorrecao.lt(1)) {
    throw new ErroCalculo("Fator de correção deve ser maior ou igual a 1");
  }

  const quantidadeBruta = converterUnidade(
    quantidade.mul(fatorCorrecao),
    item.unidadeReceita,
    item.unidadeCadastro,
  );
  return {
    ingredienteId: item.ingredienteId,
    nome: item.nome,
    quantidadeBruta,
    custo: quantidadeBruta.mul(custoUnitario),
  };
}

// Custo da receita inteira e de cada salgado (custo total / rendimento).
export function calcularCustoFicha(ficha: FichaTecnica): CustoFicha {
  const rendimento = dec(ficha.rendimento);
  exigirPositivo(rendimento, "Rendimento da receita");

  const itens = ficha.itens.map(calcularCustoItem);
  const custoTotalReceita = itens.reduce((soma, item) => soma.add(item.custo), new Decimal(0));
  return {
    itens: itens.map((item) => ({ ...item, custo: dinheiro(item.custo) })),
    custoTotalReceita: dinheiro(custoTotalReceita),
    // Mantém 4 casas, como custo_unitario no banco, para não perder centavos no preço.
    custoPorUnidade: custoTotalReceita.div(rendimento).toDecimalPlaces(4),
  };
}
