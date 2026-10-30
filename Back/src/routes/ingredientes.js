const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");
const { exigirCargo } = require("../shared/autenticacao");

const ingredientesRotas = Router();

// Validações
const unidadeMedida = z.enum(["KG", "G", "L", "ML", "UN"]);

const criarIngredienteBody = z.object({
  nome: z.string().min(1).max(50),
  unidade: unidadeMedida,
  custoUnitario: z
    .number()
    .nonnegative("Custo unitário não pode ser negativo"),
});

const atualizarIngredienteBody = criarIngredienteBody.partial();

// GET /api/ingredientes — lista todos os ingredientes
ingredientesRotas.get("/", async (_req, res, next) => {
  try {
    const ingredientes = await prisma.ingrediente.findMany({
      orderBy: { nome: "asc" },
    });
    res.json(ingredientes);
  } catch (err) {
    next(err);
  }
});

// GET /api/ingredientes/:id — busca um ingrediente pelo ID
ingredientesRotas.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const ingrediente = await prisma.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Ingrediente não encontrado" });
    }

    res.json(ingrediente);
  } catch (err) {
    next(err);
  }
});

// POST /api/ingredientes — cria um ingrediente
ingredientesRotas.post("/", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const dados = criarIngredienteBody.parse(req.body);

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nome: dados.nome,
        unidade: dados.unidade,
        custoUnitario: dados.custoUnitario,
      },
    });

    res.status(201).json(ingrediente);
  } catch (err) {
    // Nome duplicado no banco (unique constraint)
    if (err?.code === "P2002") {
      return res.status(409).json({ codigo: "CONFLITO", erro: "Já existe um ingrediente com esse nome" });
    }
    next(err);
  }
});

// PUT /api/ingredientes/:id — atualiza um ingrediente (campos enviados)
// Se o custoUnitario mudar, grava a mudança no historico_custo_insumo com o usuário logado.
ingredientesRotas.put("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const dados = atualizarIngredienteBody.parse(req.body);
    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "Nenhum campo enviado para atualizar" });
    }

    // Update e histórico na mesma transação: ou grava os dois, ou nenhum.
    const ingrediente = await prisma.$transaction(async (tx) => {
      const atual = await tx.ingrediente.findUnique({ where: { id }, select: { custoUnitario: true } });

      const atualizado = await tx.ingrediente.update({
        where: { id },
        data: {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.unidade !== undefined && { unidade: dados.unidade }),
          ...(dados.custoUnitario !== undefined && { custoUnitario: dados.custoUnitario }),
        },
      });

      if (atual && !atual.custoUnitario.equals(atualizado.custoUnitario)) {
        await tx.historicoCustoInsumo.create({
          data: {
            insumoId: id,
            custoAnterior: atual.custoUnitario,
            custoNovo: atualizado.custoUnitario,
            usuarioId: req.usuario.id,
          },
        });
      }

      return atualizado;
    });

    res.json(ingrediente);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Ingrediente não encontrado" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ codigo: "CONFLITO", erro: "Já existe um ingrediente com esse nome" });
    }
    next(err);
  }
});

// DELETE /api/ingredientes/:id — remove um ingrediente
// Falha se o ingrediente estiver vinculado a algum produto (FK com RESTRICT no histórico)
ingredientesRotas.delete("/:id", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    await prisma.ingrediente.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Ingrediente não encontrado" });
    }
    // FK violation: ingrediente está vinculado a historico_custo_insumo ou produto
    if (err?.code === "P2003") {
      return res.status(409).json({
        codigo: "CONFLITO",
        erro: "Ingrediente está em uso e não pode ser removido",
      });
    }
    next(err);
  }
});

module.exports = { ingredientesRotas };
