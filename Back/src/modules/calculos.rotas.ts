import { Router } from "express";
import { z } from "zod";
import { fichaTecnica, itemMix, numero, percentuaisPreco, produtoVenda } from "../shared/validacao";
import {
  custoFixoPorUnidade,
  percentualCustoFixo,
  totalCustosFixos,
} from "./custos/custos.calculo";
import { calcularCustoFicha } from "./fichas-tecnicas/ficha-tecnica.calculo";
import {
  calcularPontoEquilibrio,
  calcularPontoEquilibrioMix,
} from "./ponto-equilibrio/ponto-equilibrio.calculo";
import {
  analisarPreco,
  calcularMarkup,
  calcularPrecoSugerido,
} from "./precificacao/precificacao.calculo";
import {
  simularReajusteIngredientes,
  simularResultadoMensal,
} from "./simulacoes/simulacoes.calculo";

// Rotas que só calculam: recebem os dados no corpo (JSON) e devolvem o resultado, sem gravar no banco.
// Valores em dinheiro e percentuais voltam como string ("1.10") para não perder centavos.
export const calculosRotas = Router();

calculosRotas.post("/ficha-tecnica", (req, res) => {
  res.json(calcularCustoFicha(fichaTecnica.parse(req.body)));
});

const custosFixosBody = z.object({
  custos: z.array(z.object({ nome: z.string().min(1), valorMensal: numero })),
  faturamentoMensal: numero.optional(),
  producaoMensal: numero.optional(),
});

calculosRotas.post("/custos-fixos", (req, res) => {
  const body = custosFixosBody.parse(req.body);
  const total = totalCustosFixos(body.custos);
  res.json({
    total,
    percentualSobreFaturamento:
      body.faturamentoMensal === undefined
        ? null
        : percentualCustoFixo(total, body.faturamentoMensal),
    porUnidade:
      body.producaoMensal === undefined ? null : custoFixoPorUnidade(total, body.producaoMensal),
  });
});

calculosRotas.post("/markup", (req, res) => {
  res.json(calcularMarkup(percentuaisPreco.parse(req.body)));
});

const precoSugeridoBody = z.object({ custoUnitario: numero, percentuais: percentuaisPreco });

calculosRotas.post("/preco-sugerido", (req, res) => {
  const body = precoSugeridoBody.parse(req.body);
  res.json(calcularPrecoSugerido(body.custoUnitario, body.percentuais));
});

const analisePrecoBody = z.object({
  precoVenda: numero,
  custoUnitario: numero,
  percentuais: percentuaisPreco.omit({ lucro: true }),
});

calculosRotas.post("/analise-preco", (req, res) => {
  const body = analisePrecoBody.parse(req.body);
  res.json(analisarPreco(body.precoVenda, body.custoUnitario, body.percentuais));
});

const pontoEquilibrioBody = z.object({
  custosFixosMensais: numero,
  percentualDespesasVariaveis: numero,
  produto: produtoVenda,
});

calculosRotas.post("/ponto-equilibrio", (req, res) => {
  const body = pontoEquilibrioBody.parse(req.body);
  res.json(
    calcularPontoEquilibrio(
      body.custosFixosMensais,
      body.produto,
      body.percentualDespesasVariaveis,
    ),
  );
});

const mixBody = z.object({
  custosFixosMensais: numero,
  percentualDespesasVariaveis: numero,
  itens: z.array(itemMix).min(1),
});

calculosRotas.post("/ponto-equilibrio/mix", (req, res) => {
  const body = mixBody.parse(req.body);
  res.json(
    calcularPontoEquilibrioMix(
      body.custosFixosMensais,
      body.itens,
      body.percentualDespesasVariaveis,
    ),
  );
});

calculosRotas.post("/simulacoes/resultado-mensal", (req, res) => {
  const body = mixBody.parse(req.body);
  res.json(
    simularResultadoMensal(body.custosFixosMensais, body.itens, body.percentualDespesasVariaveis),
  );
});

const reajusteBody = z.object({
  ficha: fichaTecnica,
  reajustes: z.array(z.object({ ingredienteId: z.number().int(), percentual: numero })).min(1),
  percentuais: percentuaisPreco.optional(),
});

calculosRotas.post("/simulacoes/reajuste", (req, res) => {
  const body = reajusteBody.parse(req.body);
  res.json(simularReajusteIngredientes(body.ficha, body.reajustes, body.percentuais));
});
