const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Testes com um Postgres de verdade. Só rodam se TEST_DATABASE_URL estiver definida
// (ex.: o banco do Docker, com as migrations aplicadas). Sem ela, ficam como "skipped".
// Use um banco de testes: os registros criados aqui são apagados no fim.
const URL_TESTE = process.env.TEST_DATABASE_URL;
if (URL_TESTE) process.env.DATABASE_URL = URL_TESTE;
process.env.JWT_SECRET = "segredo-dos-testes";

const { criarApp } = require("../src/app");
const { gerarToken } = require("../src/shared/autenticacao");
const { prisma } = require("../src/shared/prisma");

describe("Banco de dados", { skip: !URL_TESTE && "defina TEST_DATABASE_URL" }, () => {
  const sufixo = Date.now();
  let gestor;
  let funcionario;
  let ingrediente;

  before(async () => {
    gestor = await prisma.usuario.create({
      data: { nome: `gestor-teste-${sufixo}`, cargo: "GESTOR", senha: "x" },
    });
    funcionario = await prisma.usuario.create({
      data: { nome: `func-teste-${sufixo}`, cargo: "FUNCIONARIO", senha: "x" },
    });
  });

  after(async () => {
    const usuarios = [gestor?.id, funcionario?.id].filter(Boolean);
    await prisma.historicoCustoInsumo.deleteMany({ where: { usuarioId: { in: usuarios } } });
    if (ingrediente) await prisma.ingrediente.deleteMany({ where: { id: ingrediente.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it("grava as datas no horário certo, sem adiantar o fuso", async () => {
    const antes = Date.now();
    ingrediente = await prisma.ingrediente.create({
      data: { nome: `Farinha teste ${sufixo}`, unidade: "KG", custoUnitario: 5 },
    });
    // Compara a data gravada com o relógio do próprio banco (now()), que não passa pelo adapter.
    const [linha] = await prisma.$queryRaw`
      SELECT EXTRACT(EPOCH FROM (now() - atualizado_em)) AS segundos
      FROM ingredientes WHERE id = ${ingrediente.id}`;
    assert.ok(Math.abs(Number(linha.segundos)) < 60, `diferença de ${linha.segundos}s`);
    assert.ok(Math.abs(ingrediente.atualizadoEm.getTime() - antes) < 60_000);
  });

  it("lista o histórico de custo do ingrediente, do mais recente para o mais antigo", async () => {
    const comoGestor = { Authorization: `Bearer ${gerarToken(gestor)}` };
    const comoFuncionario = { Authorization: `Bearer ${gerarToken(funcionario)}` };
    const url = `/api/ingredientes/${ingrediente.id}/historico`;
    const app = criarApp();

    const vazio = await request(app).get(url).set(comoFuncionario).expect(200);
    assert.deepEqual(vazio.body.itens, []);
    assert.equal(vazio.body.ingrediente.nome, ingrediente.nome);

    const antes = Date.now();
    for (const custoUnitario of [6, 6.5]) {
      await request(app)
        .put(`/api/ingredientes/${ingrediente.id}`)
        .set(comoGestor)
        .send({ custoUnitario })
        .expect(200);
    }
    // Mudar só o nome não entra no histórico.
    await request(app)
      .put(`/api/ingredientes/${ingrediente.id}`)
      .set(comoGestor)
      .send({ nome: `Farinha teste ${sufixo} (nova)` })
      .expect(200);

    const res = await request(app).get(url).set(comoFuncionario).expect(200);
    assert.equal(res.body.itens.length, 2);
    const [maisRecente, primeira] = res.body.itens;
    assert.deepEqual(
      [
        primeira.custoAnterior,
        primeira.custoNovo,
        maisRecente.custoAnterior,
        maisRecente.custoNovo,
      ],
      ["5", "6", "6", "6.5"],
    );
    assert.deepEqual(maisRecente.usuario, { id: gestor.id, nome: gestor.nome });
    assert.ok(Math.abs(new Date(maisRecente.alteradoEm).getTime() - antes) < 60_000);
  });

  it("devolve 404 para ingrediente que não existe", async () => {
    const res = await request(criarApp())
      .get("/api/ingredientes/999999999/historico")
      .set({ Authorization: `Bearer ${gerarToken(funcionario)}` })
      .expect(404);
    assert.equal(res.body.codigo, "NAO_ENCONTRADO");
  });
});
