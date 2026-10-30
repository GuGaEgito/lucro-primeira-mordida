const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { prisma } = require("../shared/prisma");

// Rotas montadas no app.js atrás de autenticar + exigirCargo("GESTOR").
const usuariosRotas = Router();

// Nunca devolver a coluna senha (hash).
const semSenha = { id: true, nome: true, cargo: true, ativo: true, criadoEm: true };

const criarUsuarioBody = z.object({
  nome: z.string().min(1).max(50),
  senha: z.string().min(5, "A senha precisa ter pelo menos 5 caracteres").max(72),
  cargo: z.enum(["GESTOR", "FUNCIONARIO"]),
});

const ativoBody = z.object({
  ativo: z.boolean(),
});

// GET /api/usuarios — lista os usuários
usuariosRotas.get("/", async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({ select: semSenha, orderBy: { nome: "asc" } });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios — cadastra um usuário (a senha é gravada como hash bcrypt)
usuariosRotas.post("/", async (req, res, next) => {
  try {
    const dados = criarUsuarioBody.parse(req.body);

    const usuario = await prisma.usuario.create({
      data: { nome: dados.nome, cargo: dados.cargo, senha: await bcrypt.hash(dados.senha, 10) },
      select: semSenha,
    });

    res.status(201).json(usuario);
  } catch (err) {
    if (err?.code === "P2002") {
      return res
        .status(409)
        .json({ codigo: "CONFLITO", erro: "Já existe um usuário com esse nome" });
    }
    next(err);
  }
});

// PATCH /api/usuarios/:id/ativo — ativa ou desativa um usuário
usuariosRotas.patch("/:id/ativo", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ codigo: "DADOS_INVALIDOS", erro: "ID inválido" });
    }

    const { ativo } = ativoBody.parse(req.body);

    const usuario = await prisma.usuario.update({
      where: { id },
      data: { ativo },
      select: semSenha,
    });
    res.json(usuario);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ codigo: "NAO_ENCONTRADO", erro: "Usuário não encontrado" });
    }
    next(err);
  }
});

module.exports = { usuariosRotas };
