const jwt = require("jsonwebtoken");

// Login com JWT. O token leva só o id (sub) e o cargo do usuário e vence em JWT_EXPIRES_IN.
// O front manda o token em cada requisição no cabeçalho: Authorization: Bearer <token>.

function gerarToken(usuario) {
  return jwt.sign({ cargo: usuario.cargo }, process.env.JWT_SECRET, {
    subject: String(usuario.id),
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

// Exige um token válido e guarda quem está logado em req.usuario = { id, cargo }.
function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? "").split(" ");
  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ codigo: "NAO_AUTENTICADO", erro: "Faça login para continuar" });
  }
  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: Number(dados.sub), cargo: dados.cargo };
    next();
  } catch {
    // Token expirado, alterado ou assinado com outro segredo.
    res
      .status(401)
      .json({
        codigo: "NAO_AUTENTICADO",
        erro: "Sessão inválida ou expirada, faça login novamente",
      });
  }
}

// Use depois de autenticar: exigirCargo("GESTOR") deixa passar só o gestor.
function exigirCargo(...cargos) {
  return (req, res, next) => {
    if (!cargos.includes(req.usuario?.cargo)) {
      return res
        .status(403)
        .json({ codigo: "SEM_PERMISSAO", erro: "Seu cargo não tem acesso a esta ação" });
    }
    next();
  };
}

module.exports = { gerarToken, autenticar, exigirCargo };
