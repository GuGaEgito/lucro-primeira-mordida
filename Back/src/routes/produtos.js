const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");
const { exigirCargo } = require("../shared/autenticacao");

const produtosRotas = Router();

// Validações
const criarProdutoBody = z.object({
  nome: z.string().min(1).max(50),
  ingredienteId: z.number().int().positive().optional(),
  precoVenda: z.number().nonnegative("Preço de venda não pode ser negativo").optional(),
  ativo: z.boolean().optional(),
});

const atualizarProdutoBody = criarProdutoBody.partial();

const ativoBody = z.object({
  ativo: z.boolean(),
});

// GET /api/produtos — lista produtos (somente ativos por padrão)
// Use ?todos=true para incluir inativos
produtosRotas.get("/", async (req, res, next) => {
  try {
    const incluirTodos = req.query.todos === "true";

    const produtos = await prisma.produto.findMany({
      where: incluirTodos ? {} : { ativo: true },
      include: {
        ingrediente: {
          select: { id: true, nome: true, unidade: true, custoUnitario: true },
        },
      },
      orderBy: { nome: "asc" },
    });

    res.json(produtos);
  } catch (err) {
    next(err);
  }
});

// GET /api/produtos/:id — busca um produto pelo ID
produtosRotas.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const produto = await prisma.produto.findUnique({
      where: { id },
      include: {
        ingrediente: {
          select: { id: true, nome: true, unidade: true, custoUnitario: true },
        },
      },
    });

    if (!produto) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }

    res.json(produto);
  } catch (err) {
    next(err);
  }
});

// POST /api/produtos — cria um produto
produtosRotas.post("/", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const dados = criarProdutoBody.parse(req.body);

    const produto = await prisma.produto.create({
      data: {
        nome: dados.nome,
        ...(dados.ingredienteId !== undefined && { ingredienteId: dados.ingredienteId }),
        ...(dados.precoVenda !== undefined && { precoVenda: dados.precoVenda }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
      },
      include: {
        ingrediente: {
          select: { id: true, nome: true, unidade: true, custoUnitario: true },
        },
      },
    });

    res.status(201).json(produto);
  } catch (err) {
    // ingredienteId não existe no banco
    if (err?.code === "P2003") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Ingrediente informado não existe" });
    }
    next(err);
  }
});

// PUT /api/produtos/:id — atualiza campos de um produto
produtosRotas.put("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const dados = atualizarProdutoBody.parse(req.body);
    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "Nenhum campo enviado para atualizar" });
    }

    const produto = await prisma.produto.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined && { nome: dados.nome }),
        ...(dados.ingredienteId !== undefined && { ingredienteId: dados.ingredienteId }),
        ...(dados.precoVenda !== undefined && { precoVenda: dados.precoVenda }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
      },
      include: {
        ingrediente: {
          select: { id: true, nome: true, unidade: true, custoUnitario: true },
        },
      },
    });

    res.json(produto);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }
    if (err?.code === "P2003") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Ingrediente informado não existe" });
    }
    next(err);
  }
});

// PATCH /api/produtos/:id/ativo — ativa ou desativa um produto
produtosRotas.patch("/:id/ativo", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const { ativo } = ativoBody.parse(req.body);

    const produto = await prisma.produto.update({
      where: { id },
      data: { ativo },
      select: { id: true, nome: true, ativo: true, atualizadoEm: true },
    });

    res.json(produto);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }
    next(err);
  }
});

// DELETE /api/produtos/:id — remove permanentemente um produto
produtosRotas.delete("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    await prisma.produto.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }
    next(err);
  }
});

module.exports = { produtosRotas };
