const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
process.env.JWT_SECRET = "segredo-dos-testes";
const { criarApp } = require("../src/app");
const { gerarToken } = require("../src/shared/autenticacao");

const app = criarApp();
// As rotas de cálculo exigem login: todas as requisições vão com o token de um funcionário.
const api = request
  .agent(app)
  .set("Authorization", `Bearer ${gerarToken({ id: 1, cargo: "FUNCIONARIO" })}`);

const ficha = {
  rendimento: 40,
  itens: [
    {
      ingredienteId: 1,
      custoUnitario: "5.00",
      unidadeCadastro: "KG",
      quantidade: 500,
      unidadeReceita: "G",
    },
    {
      ingredienteId: 2,
      custoUnitario: "20.00",
      unidadeCadastro: "KG",
      quantidade: 800,
      unidadeReceita: "G",
      fatorCorrecao: "1.25",
    },
    {
      ingredienteId: 3,
      custoUnitario: "8.00",
      unidadeCadastro: "L",
      quantidade: 200,
      unidadeReceita: "ML",
    },
  ],
};
const percentuais = { custoFixo: 20, despesasVariaveis: 10, lucro: 15 };
const mix = {
  custosFixosMensais: 1000,
  percentualDespesasVariaveis: 10,
  itens: [
    { nome: "Coxinha", precoVenda: 5, custoUnitario: "1.5", quantidadeVendida: 300 },
    { nome: "Esfiha", precoVenda: 8, custoUnitario: 3, quantidadeVendida: 100 },
  ],
};

describe("API", () => {
  it("responde o health e a documentação", async () => {
    await api.get("/health").expect(200, { status: "ok" });
    const docs = await api.get("/api/openapi.json").expect(200);
    assert.ok(docs.body.paths["/api/calculos/ficha-tecnica"]);
  });

  it("libera CORS para o front", async () => {
    const res = await api
      .options("/api/calculos/markup")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  });

  it("calcula a ficha técnica com valores em texto", async () => {
    const res = await api.post("/api/calculos/ficha-tecnica").send(ficha).expect(200);
    assert.equal(res.body.custoTotalReceita, "24.1");
    assert.equal(res.body.custoPorUnidade, "0.6025");
  });

  it("calcula custos fixos", async () => {
    const res = await api
      .post("/api/calculos/custos-fixos")
      .send({
        custos: [
          { nome: "Aluguel", valorMensal: 1500 },
          { nome: "Energia", valorMensal: 500 },
        ],
        faturamentoMensal: 10000,
      })
      .expect(200);
    assert.deepEqual(res.body, {
      total: "2000",
      percentualSobreFaturamento: "20",
      porUnidade: null,
    });
  });

  it("calcula markup, preço sugerido e análise de preço", async () => {
    const markup = await api.post("/api/calculos/markup").send(percentuais).expect(200);
    assert.equal(markup.body.divisor, "0.55");
    const preco = await api
      .post("/api/calculos/preco-sugerido")
      .send({ custoUnitario: "0.6025", percentuais })
      .expect(200);
    assert.equal(preco.body.precoSugerido, "1.1");
    const analise = await api
      .post("/api/calculos/analise-preco")
      .send({
        precoVenda: "1.10",
        custoUnitario: "0.6025",
        percentuais: { custoFixo: 20, despesasVariaveis: 10 },
      })
      .expect(200);
    assert.equal(analise.body.lucroUnitario, "0.17");
  });

  it("calcula ponto de equilíbrio e simulações", async () => {
    const pe = await api
      .post("/api/calculos/ponto-equilibrio")
      .send({
        custosFixosMensais: 3000,
        percentualDespesasVariaveis: 10,
        produto: { nome: "Coxinha", precoVenda: 5, custoUnitario: "1.5" },
      })
      .expect(200);
    assert.equal(pe.body.quantidade, "1000");
    const peMix = await api.post("/api/calculos/ponto-equilibrio/mix").send(mix).expect(200);
    assert.equal(peMix.body.porProduto.length, 2);
    const mes = await api.post("/api/calculos/simulacoes/resultado-mensal").send(mix).expect(200);
    assert.equal(mes.body.lucro, "320");
    const reajuste = await api
      .post("/api/calculos/simulacoes/reajuste")
      .send({ ficha, reajustes: [{ ingredienteId: 2, percentual: 10 }], percentuais })
      .expect(200);
    assert.equal(reajuste.body.precoSugeridoDepois, "1.19");
  });

  it("devolve 400 para dados inválidos", async () => {
    const res = await api
      .post("/api/calculos/ficha-tecnica")
      .send({ rendimento: "abc", itens: [] })
      .expect(400);
    assert.equal(res.body.codigo, "DADOS_INVALIDOS");
    assert.equal(res.body.erro, "Dados inválidos");
    assert.ok(res.body.detalhes.some((d) => d.campo === "rendimento"));
  });

  it("devolve 400 para JSON malformado", async () => {
    await api
      .post("/api/calculos/markup")
      .set("Content-Type", "application/json")
      .send("{ruim")
      .expect(400, { codigo: "JSON_INVALIDO", erro: "JSON inválido no corpo da requisição" });
  });

  it("devolve 422 quando o cálculo não é possível", async () => {
    const res = await api
      .post("/api/calculos/markup")
      .send({ custoFixo: 50, despesasVariaveis: 30, lucro: 30 })
      .expect(422);
    assert.equal(res.body.codigo, "ERRO_CALCULO");
    assert.match(res.body.erro, /menor que 100%/);
  });

  it("devolve 404 para rota inexistente", async () => {
    await api
      .get("/api/nao-existe")
      .expect(404, { codigo: "ROTA_NAO_ENCONTRADA", erro: "Rota não encontrada" });
  });

  it("devolve 413 para corpo grande demais", async () => {
    await api
      .post("/api/calculos/markup")
      .send({ custoFixo: 20, despesasVariaveis: 10, lucro: 15, extra: "x".repeat(200_000) })
      .expect(413, { codigo: "CORPO_MUITO_GRANDE", erro: "Corpo da requisição muito grande" });
  });

  it("não expõe o cabeçalho X-Powered-By", async () => {
    const res = await api.get("/health").expect(200);
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});
