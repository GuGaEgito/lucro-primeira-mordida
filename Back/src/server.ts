import "dotenv/config";
import { criarApp } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

criarApp().listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Documentação da API: http://localhost:${PORT}/api/docs`);
});
