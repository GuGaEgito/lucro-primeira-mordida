require("dotenv/config");
const { criarApp } = require("./app");

const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`PORT inválida: "${process.env.PORT}"`);
}

const servidor = criarApp().listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Documentação da API: http://localhost:${PORT}/api/docs`);
});

// Encerramento gracioso: o Docker manda SIGTERM ao parar o container e o Ctrl+C manda SIGINT.
// Para de aceitar conexões, termina as requisições em andamento e só então sai.
function encerrar(sinal) {
  console.log(`${sinal} recebido, encerrando o servidor...`);
  servidor.close(() => process.exit(0));
  // Se alguma conexão ficar presa, força a saída depois de 10 segundos.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);
