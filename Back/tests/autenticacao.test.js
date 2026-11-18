const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");

process.env.JWT_SECRET = "segredo-dos-testes";
const { criarApp } = require("../src/app");
const { gerarToken } = require("../src/shared/autenticacao");
const { usarUsuariosFalsos } = require("./usuarios-falsos");

// Estes testes não precisam de banco: a consulta do usuário do token é trocada por uma falsa
// e o resto é barrado (token, cargo ou validação) antes de qualquer outra consulta.
usarUsuariosFalsos();
const app = criarApp();
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const funcionario = gerarToken({ id: 2, cargo: "FUNCIONARIO" });
const gestor = gerarToken({ id: 1, cargo: "GESTOR" });

describe("Autenticação", () => {
  it("o token leva o id e o cargo e vence", () => {
    const dados = jwt.verify(gestor, process.env.JWT_SECRET);
    assert.equal(dados.sub, "1");
    assert.equal(dados.cargo, "GESTOR");
    assert.ok(dados.exp > dados.iat);
  });

  it("devolve 401 sem token", async () => {
    const res = await request(app).get("/api/produtos").expect(401);
    assert.equal(res.body.codigo, "NAO_AUTENTICADO");
  });

  it("devolve 401 com token alterado, de outro segredo ou vencido", async () => {
    const outroSegredo = jwt.sign({ cargo: "GESTOR" }, "outro", { subject: "1" });
    const vencido = jwt.sign({ cargo: "GESTOR" }, process.env.JWT_SECRET, {
      subject: "1",
      expiresIn: -10,
    });
    for (const token of [`${gestor}x`, outroSegredo, vencido]) {
      const res = await request(app).get("/api/produtos").set(bearer(token)).expect(401);
      assert.equal(res.body.codigo, "NAO_AUTENTICADO");
    }
  });

  it("devolve 403 quando o funcionário tenta uma ação de gestor", async () => {
    const rotas = [
      request(app).post("/api/ingredientes").send({}),
      request(app).put("/api/produtos/1").send({}),
      request(app).delete("/api/produtos/1"),
      request(app).get("/api/usuarios"),
      request(app).post("/api/custos-fixos").send({}),
      request(app).put("/api/custos-fixos/1").send({}),
      request(app).delete("/api/custos-fixos/1"),
    ];
    for (const req of rotas) {
      const res = await req.set(bearer(funcionario)).expect(403);
      assert.equal(res.body.codigo, "SEM_PERMISSAO");
    }
  });

  it("deixa o gestor passar da checagem de cargo", async () => {
    // Corpo vazio: passa do cargo e para na validação (400), sem chegar no banco.
    const res = await request(app)
      .post("/api/ingredientes")
      .set(bearer(gestor))
      .send({})
      .expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
  });

  it("valida o corpo do custo fixo", async () => {
    const res = await request(app)
      .post("/api/custos-fixos")
      .set(bearer(gestor))
      .send({ nome: "Aluguel", valorMensal: -1 })
      .expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
  });

  it("valida o corpo do login", async () => {
    const res = await request(app).post("/api/auth/login").send({ nome: "" }).expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
  });

  it("histórico de custo: exige login e recusa ID inválido antes de ir ao banco", async () => {
    const semToken = await request(app).get("/api/ingredientes/1/historico").expect(401);
    assert.equal(semToken.body.codigo, "NAO_AUTENTICADO");
    const res = await request(app)
      .get("/api/ingredientes/abc/historico")
      .set(bearer(funcionario))
      .expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
  });
  it("barra o token de um usuário desativado ou removido, mesmo dentro da validade", async () => {
    for (const id of [3, 99]) {
      const token = gerarToken({ id, cargo: "GESTOR" });
      const res = await request(app).get("/api/produtos").set(bearer(token)).expect(401);
      assert.equal(res.body.codigo, "NAO_AUTENTICADO");
    }
  });

  it("usa o cargo do banco, não o do token", async () => {
    // Token antigo dizendo GESTOR, mas no banco o usuário 2 é FUNCIONARIO.
    const tokenAntigo = gerarToken({ id: 2, cargo: "GESTOR" });
    const res = await request(app).get("/api/usuarios").set(bearer(tokenAntigo)).expect(403);
    assert.equal(res.body.codigo, "SEM_PERMISSAO");
  });

  it("recusa token sem um id de usuário válido", async () => {
    const semId = jwt.sign({ cargo: "GESTOR" }, process.env.JWT_SECRET, { subject: "abc" });
    const res = await request(app).get("/api/produtos").set(bearer(semId)).expect(401);
    assert.equal(res.body.codigo, "NAO_AUTENTICADO");
  });

  it("bloqueia o login depois de 5 tentativas erradas seguidas", async () => {
    // App novo para a contagem começar do zero. O corpo inválido (400) conta como erro
    // e não precisa de banco.
    const appNovo = criarApp();
    for (let i = 0; i < 5; i++) {
      await request(appNovo).post("/api/auth/login").send({ nome: "" }).expect(400);
    }
    const res = await request(appNovo).post("/api/auth/login").send({ nome: "" }).expect(429);
    assert.equal(res.body.codigo, "MUITAS_TENTATIVAS");
    assert.ok(res.headers["ratelimit"], "envia o cabeçalho RateLimit");
    // Outras rotas não entram na conta.
    await request(appNovo).get("/health").expect(200);
  });
});
