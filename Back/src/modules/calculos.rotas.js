const { Router } = require("express");
const { z } = require("zod");
const {
  fichaTecnica,
  itemMix,
  numero,
  percentuaisPreco,
  produtoVenda,
} = require("../shared/validacao");
const {
  custoFixoPorUnidade,
  percentualCustoFixo,
  totalCustosFixos,
} = require("./custos/custos.calculo");
const { calcularCustoFicha } = require("./fichas-tecnicas/ficha-tecnica.calculo");
const {
  calcularPontoEquilibrio,
  calcularPontoEquilibrioMix,
} = require("./ponto-equilibrio/ponto-equilibrio.calculo");
const {
  analisarPreco,
  calcularMarkup,
  calcularPrecoSugerido,
} = require("./precificacao/precificacao.calculo");
const {
  simularReajusteIngredientes,
  simularResultadoMensal,
} = require("./simulacoes/simulacoes.calculo");

// Rotas que só calculam: recebem os dados no corpo (JSON) e devolvem o resultado, sem gravar no banco.
// Valores em dinheiro e percentuais voltam como string ("1.10") para não perder centavos.
const calculosRotas = Router();

// Valida o corpo com o schema e responde com o resultado do cálculo.
// Erros de validação (ZodError) e de cálculo (ErroCalculo) seguem para o tratador de erros do app.
function calculo(schema, calcular) {
  return (req, res) => {
    res.json(calcular(schema.parse(req.body)));
  };
}

const custosFixosBody = z.object({
  custos: z.array(z.object({ nome: z.string().min(1), valorMensal: numero })),
  faturamentoMensal: numero.optional(),
  producaoMensal: numero.optional(),
});

const precoSugeridoBody = z.object({ custoUnitario: numero, percentuais: percentuaisPreco });

const analisePrecoBody = z.object({
  precoVenda: numero,
  custoUnitario: numero,
  percentuais: percentuaisPreco.omit({ lucro: true }),
});

const pontoEquilibrioBody = z.object({
  custosFixosMensais: numero,
  percentualDespesasVariaveis: numero,
  produto: produtoVenda,
});

const mixBody = z.object({
  custosFixosMensais: numero,
  percentualDespesasVariaveis: numero,
  itens: z.array(itemMix).min(1),
});

const reajusteBody = z.object({
  ficha: fichaTecnica,
  reajustes: z.array(z.object({ ingredienteId: z.number().int(), percentual: numero })).min(1),
  percentuais: percentuaisPreco.optional(),
});

calculosRotas.post("/ficha-tecnica", calculo(fichaTecnica, calcularCustoFicha));

calculosRotas.post(
  "/custos-fixos",
  calculo(custosFixosBody, ({ custos, faturamentoMensal, producaoMensal }) => {
    const total = totalCustosFixos(custos);
    return {
      total,
      percentualSobreFaturamento:
        faturamentoMensal === undefined ? null : percentualCustoFixo(total, faturamentoMensal),
      porUnidade: producaoMensal === undefined ? null : custoFixoPorUnidade(total, producaoMensal),
    };
  }),
);

calculosRotas.post("/markup", calculo(percentuaisPreco, calcularMarkup));

calculosRotas.post(
  "/preco-sugerido",
  calculo(precoSugeridoBody, (body) => calcularPrecoSugerido(body.custoUnitario, body.percentuais)),
);

calculosRotas.post(
  "/analise-preco",
  calculo(analisePrecoBody, (body) =>
    analisarPreco(body.precoVenda, body.custoUnitario, body.percentuais),
  ),
);

calculosRotas.post(
  "/ponto-equilibrio",
  calculo(pontoEquilibrioBody, (body) =>
    calcularPontoEquilibrio(
      body.custosFixosMensais,
      body.produto,
      body.percentualDespesasVariaveis,
    ),
  ),
);

calculosRotas.post(
  "/ponto-equilibrio/mix",
  calculo(mixBody, (body) =>
    calcularPontoEquilibrioMix(
      body.custosFixosMensais,
      body.itens,
      body.percentualDespesasVariaveis,
    ),
  ),
);

calculosRotas.post(
  "/simulacoes/resultado-mensal",
  calculo(mixBody, (body) =>
    simularResultadoMensal(body.custosFixosMensais, body.itens, body.percentualDespesasVariaveis),
  ),
);

calculosRotas.post(
  "/simulacoes/reajuste",
  calculo(reajusteBody, (body) =>
    simularReajusteIngredientes(body.ficha, body.reajustes, body.percentuais),
  ),
);

module.exports = { calculosRotas };
