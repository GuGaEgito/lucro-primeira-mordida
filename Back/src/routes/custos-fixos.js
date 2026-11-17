const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");
const { exigirCargo } = require("../shared/autenticacao");
const { totalCustosFixos } = require("../modules/custos/custos.calculo");

// Custos fixos mensais da loja (RF12 / RF13): aluguel, energia, gás, salários...
// Qualquer usuário logado consulta; só o GESTOR cadastra, altera e apaga.
const custosFixosRotas = Router();

const criarCustoFixoBody = z.object({
  nome: z.string().min(1).max(50),
  valorMensal: z.number().nonnegative("Valor mensal não pode ser negativo"),
});

const atualizarCustoFixoBody = criarCustoFixoBody.partial();

function lerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    return null;
  }
  return id;
}

function tratarErroPrisma(err, res, next) {
  if (err?.code === "P2025") {
    return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Custo fixo não encontrado" });
  }
  if (err?.code === "P2002") {
    return res
      .status(409)
      .json({ codigo: "CONFLITO", erro: "Já existe um custo fixo com esse nome" });
  }
  next(err);
}

// GET /api/custos-fixos — lista os custos e o total do mês
custosFixosRotas.get("/", async (_req, res, next) => {
  try {
    const itens = await prisma.custoFixo.findMany({ orderBy: { nome: "asc" } });
    res.json({ itens, totalMensal: totalCustosFixos(itens) });
  } catch (err) {
    next(err);
  }
});

// GET /api/custos-fixos/:id — busca um custo fixo
custosFixosRotas.get("/:id", async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const custo = await prisma.custoFixo.findUnique({ where: { id } });
    if (!custo) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Custo fixo não encontrado" });
    }
    res.json(custo);
  } catch (err) {
    next(err);
  }
});

// POST /api/custos-fixos — cadastra um custo fixo
custosFixosRotas.post("/", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const dados = criarCustoFixoBody.parse(req.body);
    const custo = await prisma.custoFixo.create({ data: dados });
    res.status(201).json(custo);
  } catch (err) {
    tratarErroPrisma(err, res, next);
  }
});

// PUT /api/custos-fixos/:id — altera nome e/ou valor mensal
custosFixosRotas.put("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const dados = atualizarCustoFixoBody.parse(req.body);
    if (Object.keys(dados).length === 0) {
      return res
        .status(400)
        .json({ codigo: "DADOS_INVALIDOS", erro: "Nenhum campo enviado para atualizar" });
    }

    const custo = await prisma.custoFixo.update({ where: { id }, data: dados });
    res.json(custo);
  } catch (err) {
    tratarErroPrisma(err, res, next);
  }
});

// DELETE /api/custos-fixos/:id — remove um custo fixo
custosFixosRotas.delete("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    await prisma.custoFixo.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    tratarErroPrisma(err, res, next);
  }
});

module.exports = { custosFixosRotas };
