const { ErroCalculo } = require("../../shared/numeros");
const { percentualCustoFixo, totalCustosFixos } = require("../custos/custos.calculo");
const { calcularCustoFicha } = require("../fichas-tecnicas/ficha-tecnica.calculo");
const { analisarPreco, calcularPrecoSugerido } = require("./precificacao.calculo");

// Junta o que está salvo no banco (produto com a receita e custos fixos) com os parâmetros
// que o banco não guarda, e devolve custo, preço sugerido e a análise do preço atual.
// - produto: como vem do Prisma, com ingredientes: [{ quantidade, unidadeReceita, ingrediente }];
// - custosFixos: linhas da tabela custo_fixo ({ nome, valorMensal });
// - parametros: { faturamentoMensal, despesasVariaveis, lucro } (percentuais de 0 a 100).
function precificarProduto(produto, custosFixos, parametros) {
  if (produto.ingredientes.length === 0) {
    throw new ErroCalculo("O produto não tem receita cadastrada");
  }

  const fichaTecnica = calcularCustoFicha({
    rendimento: produto.rendimento,
    itens: produto.ingredientes.map((item) => ({
      ingredienteId: item.ingrediente.id,
      nome: item.ingrediente.nome,
      custoUnitario: item.ingrediente.custoUnitario,
      unidadeCadastro: item.ingrediente.unidade,
      quantidade: item.quantidade,
      unidadeReceita: item.unidadeReceita,
    })),
  });

  const totalMensal = totalCustosFixos(custosFixos);
  const percentuais = {
    custoFixo: percentualCustoFixo(totalMensal, parametros.faturamentoMensal),
    despesasVariaveis: parametros.despesasVariaveis,
    lucro: parametros.lucro,
  };

  const custo = fichaTecnica.custoPorUnidade;
  const temPreco = produto.precoVenda !== null && Number(produto.precoVenda) > 0;

  return {
    produto: {
      id: produto.id,
      nome: produto.nome,
      rendimento: produto.rendimento,
      precoVenda: produto.precoVenda,
    },
    fichaTecnica,
    custosFixos: { totalMensal, percentualSobreFaturamento: percentuais.custoFixo },
    precoSugerido: calcularPrecoSugerido(custo, percentuais),
    // Sem preço de venda cadastrado não há o que analisar.
    analisePrecoAtual: temPreco ? analisarPreco(produto.precoVenda, custo, percentuais) : null,
  };
}

module.exports = { precificarProduto };
