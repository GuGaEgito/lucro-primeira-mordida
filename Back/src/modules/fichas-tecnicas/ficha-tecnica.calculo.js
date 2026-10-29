const {
  Decimal,
  dec,
  dinheiro,
  ErroCalculo,
  exigirNaoNegativo,
  exigirPositivo,
} = require("../../shared/numeros");
const { converterUnidade } = require("../../shared/unidades");

// A ficha técnica é { itens, rendimento }, onde rendimento é quantos salgados a receita rende.
// Cada item diz quanto de um ingrediente entra na receita:
// - custoUnitario: custo por 1 unidade de medida do cadastro (ingredientes.custo_unitario);
// - unidadeCadastro: unidade em que o ingrediente foi cadastrado;
// - quantidade e unidadeReceita: quantidade usada na receita (peso líquido) e a unidade em que foi informada;
// - fatorCorrecao (opcional, padrão 1): peso bruto / peso líquido, para perdas no preparo.

// Custo de um ingrediente na receita:
// quantidade bruta = quantidade líquida x fator de correção (convertida para a unidade do cadastro)
// custo = quantidade bruta x custo unitário
function calcularCustoItem(item) {
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
    quantidadeBruta, // na unidade do cadastro
    custo: quantidadeBruta.mul(custoUnitario),
  };
}

// Custo da receita inteira e de cada salgado (custo total / rendimento).
function calcularCustoFicha(ficha) {
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

module.exports = { calcularCustoItem, calcularCustoFicha };
