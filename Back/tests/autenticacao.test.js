const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");

process.env.JWT_SECRET = "segredo-dos-testes";
const { criarApp } = require("../src/app");
const { gerarToken } = require("../src/shared/autenticacao");

// Estes testes não precisam de banco: o token é barrado (ou o cargo é recusado) antes de qualquer consulta.
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

  it("valida o corpo do login", async () => {
    const res = await request(app).post("/api/auth/login").send({ nome: "" }).expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
  });
});
