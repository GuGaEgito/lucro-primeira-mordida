const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");
const { autenticar, gerarToken } = require("../shared/autenticacao");

const authRotas = Router();

const loginBody = z.object({
  nome: z.string().min(1).max(50),
  senha: z.string().min(1).max(100),
});

// POST /api/auth/login — confere nome e senha e devolve o token
authRotas.post("/login", async (req, res, next) => {
  try {
    const { nome, senha } = loginBody.parse(req.body);

    const usuario = await prisma.usuario.findUnique({ where: { nome } });
    const senhaCorreta = usuario ? await bcrypt.compare(senha, usuario.senha) : false;

    // Mesma resposta para nome inexistente, senha errada ou usuário desativado,
    // para não revelar quais nomes existem.
    if (!usuario || !usuario.ativo || !senhaCorreta) {
      return res
        .status(401)
        .json({ codigo: "CREDENCIAIS_INVALIDAS", erro: "Nome ou senha incorretos" });
    }

    res.json({
      token: gerarToken(usuario),
      usuario: { id: usuario.id, nome: usuario.nome, cargo: usuario.cargo },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/eu — dados de quem está logado (o front usa para saber o que mostrar)
authRotas.get("/eu", autenticar, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, cargo: true, ativo: true },
    });
    if (!usuario) {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Usuário não encontrado" });
    }
    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

module.exports = { authRotas };
