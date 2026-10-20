import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import { ZodError } from "zod";
import { openapi } from "./docs/openapi";
import { calculosRotas } from "./modules/calculos.rotas";
import { ErroCalculo } from "./shared/numeros";

// CORS_ORIGIN: endereços do front separados por vírgula (ex.: http://localhost:5173).
// Sem a variável, qualquer origem é aceita (bom para desenvolvimento; defina em produção).
function origensPermitidas(): cors.CorsOptions["origin"] {
  const valor = process.env.CORS_ORIGIN?.trim();
  if (!valor) return true;
  return valor.split(",").map((origem) => origem.trim());
}

// O Express só reconhece o tratador de erros se ele tiver os 4 parâmetros.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const tratarErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  if (erro instanceof ZodError) {
    res.status(400).json({
      erro: "Dados inválidos",
      detalhes: erro.issues.map((issue) => ({
        campo: issue.path.join("."),
        mensagem: issue.message,
      })),
    });
    return;
  }
  if (erro instanceof ErroCalculo) {
    res.status(422).json({ erro: erro.message });
    return;
  }
  if (erro?.type === "entity.parse.failed") {
    res.status(400).json({ erro: "JSON inválido no corpo da requisição" });
    return;
  }
  console.error(erro);
  res.status(500).json({ erro: "Erro interno do servidor" });
};

export function criarApp() {
  const app = express();

  app.use(cors({ origin: origensPermitidas() }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/openapi.json", (_req, res) => {
    res.json(openapi);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use("/api/calculos", calculosRotas);

  app.use((_req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
  });
  app.use(tratarErros);

  return app;
}
