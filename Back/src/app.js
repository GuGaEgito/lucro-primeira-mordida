const cors = require("cors");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { ZodError } = require("zod");
const { openapi } = require("./docs/openapi");
const { calculosRotas } = require("./modules/calculos.rotas");
const { ErroCalculo } = require("./shared/numeros");

// Formato único de erro da API: { codigo, erro, detalhes? }.
// O front decide o que fazer pelo `codigo`; `erro` é a mensagem para mostrar ao usuário.
// Códigos: DADOS_INVALIDOS, JSON_INVALIDO, CORPO_MUITO_GRANDE, ERRO_CALCULO, ROTA_NAO_ENCONTRADA, ERRO_INTERNO.
function responderErro(res, status, codigo, erro, detalhes) {
  res.status(status).json({ codigo, erro, ...(detalhes && { detalhes }) });
}

// CORS_ORIGIN: endereços do front separados por vírgula (ex.: http://localhost:5173).
// Sem a variável, qualquer origem é aceita (bom para desenvolvimento; defina em produção).
function origensPermitidas() {
  const valor = process.env.CORS_ORIGIN?.trim();
  if (!valor) {
    if (process.env.NODE_ENV === "production") {
      console.warn("CORS_ORIGIN não definida: a API está aceitando requisições de qualquer origem");
    }
    return true;
  }
  return valor.split(",").map((origem) => origem.trim());
}

// O Express só reconhece o tratador de erros se ele tiver os 4 parâmetros.
// eslint-disable-next-line no-unused-vars
function tratarErros(erro, _req, res, _next) {
  if (erro instanceof ZodError) {
    const detalhes = erro.issues.map((issue) => ({
      campo: issue.path.join("."),
      mensagem: issue.message,
    }));
    responderErro(res, 400, "DADOS_INVALIDOS", "Dados inválidos", detalhes);
    return;
  }
  if (erro instanceof ErroCalculo) {
    responderErro(res, 422, "ERRO_CALCULO", erro.message);
    return;
  }
  // Erros do express.json() ao ler o corpo da requisição.
  if (erro?.type === "entity.parse.failed") {
    responderErro(res, 400, "JSON_INVALIDO", "JSON inválido no corpo da requisição");
    return;
  }
  if (erro?.type === "entity.too.large") {
    responderErro(res, 413, "CORPO_MUITO_GRANDE", "Corpo da requisição muito grande");
    return;
  }
  console.error(erro);
  responderErro(res, 500, "ERRO_INTERNO", "Erro interno do servidor");
}

function criarApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: origensPermitidas() }));
  // Os cálculos recebem poucos dados; o limite evita que um corpo enorme trave o servidor.
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/openapi.json", (_req, res) => {
    res.json(openapi);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/api/calculos", calculosRotas);

  app.use((_req, res) => {
    responderErro(res, 404, "ROTA_NAO_ENCONTRADA", "Rota não encontrada");
  });
  app.use(tratarErros);

  return app;
}

module.exports = { criarApp };
