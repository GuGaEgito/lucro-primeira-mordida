const { rateLimit } = require("express-rate-limit");

// Proteção contra força bruta no login (OWASP API2/A07): cada IP pode errar a senha
// LOGIN_MAX_TENTATIVAS vezes (padrão 5) a cada LOGIN_JANELA_MINUTOS minutos (padrão 1).
// Logins certos não contam, então quem acerta a senha não é bloqueado.
// Ao passar do limite, responde 429 até a janela acabar.
function limitarTentativasLogin() {
  const maximo = Number(process.env.LOGIN_MAX_TENTATIVAS ?? 5);
  const minutos = Number(process.env.LOGIN_JANELA_MINUTOS ?? 1);

  return rateLimit({
    windowMs: minutos * 60_000,
    limit: maximo,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8", // envia o cabeçalho RateLimit com quanto falta para liberar
    legacyHeaders: false,
    handler: (_req, res, _next, opcoes) => {
      res.status(opcoes.statusCode).json({
        codigo: "MUITAS_TENTATIVAS",
        erro: `Muitas tentativas de login. Espere ${minutos} minuto(s) e tente de novo`,
      });
    },
  });
}

module.exports = { limitarTentativasLogin };
