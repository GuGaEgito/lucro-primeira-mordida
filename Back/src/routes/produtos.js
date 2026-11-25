const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");
const { exigirCargo } = require("../shared/autenticacao");
const { numero } = require("../shared/validacao");
const { precificarProduto } = require("../modules/precificacao/precificacao-produto");
const { verificarInsumos } = require("../modules/mercados/verificacao");

const produtosRotas = Router();

// Validações
const unidadeMedida = z.enum(["KG", "G", "L", "ML", "UN"]);

const itemReceitaSchema = z.object({
  ingredienteId: z.number().int().positive("ID do ingrediente inválido"),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  unidadeReceita: unidadeMedida,
});

const criarProdutoBody = z.object({
  nome: z.string().min(1).max(50),
  rendimento: z.number().positive("Rendimento deve ser maior que zero").optional().default(1),
  precoVenda: z.number().nonnegative("Preço de venda não pode ser negativo").optional(),
  ativo: z.boolean().optional().default(true),
  ingredientes: z.array(itemReceitaSchema).optional().default([]),
});

const atualizarProdutoBody = z.object({
  nome: z.string().min(1).max(50).optional(),
  rendimento: z.number().positive("Rendimento deve ser maior que zero").optional(),
  precoVenda: z.number().nonnegative("Preço de venda não pode ser negativo").nullable().optional(),
  ativo: z.boolean().optional(),
  ingredientes: z.array(itemReceitaSchema).optional(),
});

// Parâmetros que o banco não guarda; percentuais de 0 a 100 (10 = 10%).
const precificacaoBody = z.object({
  faturamentoMensal: numero,
  despesasVariaveis: numero,
  lucro: numero,
});

const ativoBody = z.object({
  ativo: z.boolean(),
});

const includeIngredientes = {
  ingredientes: {
    include: {
      ingrediente: {
        select: { id: true, nome: true, unidade: true, custoUnitario: true },
      },
    },
  },
};

// GET /api/produtos — lista produtos (somente ativos por padrão)
// Use ?todos=true para incluir inativos
produtosRotas.get("/", async (req, res, next) => {
  try {
    const incluirTodos = req.query.todos === "true";

    const produtos = await prisma.produto.findMany({
      where: incluirTodos ? {} : { ativo: true },
      include: includeIngredientes,
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
      include: includeIngredientes,
    });

    if (!produto) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }

    res.json(produto);
  } catch (err) {
    next(err);
  }
});

// POST /api/produtos — cria um produto com sua receita de ingredientes
produtosRotas.post("/", exigirCargo("GESTOR"), async (req, res, next) => {
  try {
    const dados = criarProdutoBody.parse(req.body);

    const produto = await prisma.produto.create({
      data: {
        nome: dados.nome,
        rendimento: dados.rendimento,
        precoVenda: dados.precoVenda,
        ativo: dados.ativo,
        ingredientes: {
          create: dados.ingredientes.map((item) => ({
            ingredienteId: item.ingredienteId,
            quantidade: item.quantidade,
            unidadeReceita: item.unidadeReceita,
          })),
        },
      },
      include: includeIngredientes,
    });

    res.status(201).json(produto);
  } catch (err) {
    // Ingrediente informado não existe no banco
    if (err?.code === "P2003") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Um ou mais ingredientes informados não existem" });
    }
    // Ingrediente duplicado na mesma receita
    if (err?.code === "P2002") {
      return res.status(409).json({ codigo: "CONFLITO", erro: "Não é permitido adicionar o mesmo ingrediente mais de uma vez na mesma receita" });
    }
    next(err);
  }
});

// PUT /api/produtos/:id — atualiza campos de um produto e/ou sua receita
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

    const produtoExiste = await prisma.produto.findUnique({ where: { id } });
    if (!produtoExiste) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }

    const produto = await prisma.$transaction(async (tx) => {
      // Se enviou a lista de ingredientes, substitui a receita
      if (dados.ingredientes !== undefined) {
        await tx.produtoIngrediente.deleteMany({
          where: { produtoId: id },
        });

        if (dados.ingredientes.length > 0) {
          await tx.produtoIngrediente.createMany({
            data: dados.ingredientes.map((item) => ({
              produtoId: id,
              ingredienteId: item.ingredienteId,
              quantidade: item.quantidade,
              unidadeReceita: item.unidadeReceita,
            })),
          });
        }
      }

      // Separa a receita (já gravada acima) dos campos da tabela produtos.
      // eslint-disable-next-line no-unused-vars
      const { ingredientes, ...dadosProduto } = dados;

      return tx.produto.update({
        where: { id },
        data: dadosProduto,
        include: includeIngredientes,
      });
    });

    res.json(produto);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }
    if (err?.code === "P2003") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Um ou mais ingredientes informados não existem" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ codigo: "CONFLITO", erro: "Não é permitido adicionar o mesmo ingrediente mais de uma vez na mesma receita" });
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

// POST /api/produtos/:id/precificacao — custo, preço sugerido e se o preço atual é rentável,
// usando a receita, os custos dos ingredientes e os custos fixos salvos no banco.
// Só calcula, não grava nada; por isso o FUNCIONARIO também pode usar.
produtosRotas.post("/:id/precificacao", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const parametros = precificacaoBody.parse(req.body);

    const [produto, custosFixos] = await Promise.all([
      prisma.produto.findUnique({ where: { id }, include: includeIngredientes }),
      prisma.custoFixo.findMany(),
    ]);
    if (!produto) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }

    res.json(precificarProduto(produto, custosFixos, parametros));
  } catch (err) {
    next(err);
  }
});

// Cada verificação faz várias buscas nos sites: o limite evita sobrecarregar os mercados.
const limitarVerificacoes = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      codigo: "MUITAS_TENTATIVAS",
      erro: "Muitas verificações seguidas. Espere um minuto e tente de novo.",
    }),
});

// GET /api/produtos/:id/verificacao-insumos — compara o custo de cada insumo da receita com os
// preços online dos mercados. Busca na hora e não grava nada.
produtosRotas.get("/:id/verificacao-insumos", limitarVerificacoes, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const produto = await prisma.produto.findUnique({
      where: { id },
      include: includeIngredientes,
    });
    if (!produto) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Produto não encontrado" });
    }

    res.json(await verificarInsumos(produto));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/produtos/:id — remove permanentemente um produto (itens da receita são excluídos em cascata)
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
