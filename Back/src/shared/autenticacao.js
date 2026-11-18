const jwt = require("jsonwebtoken");
const { prisma } = require("./prisma");

// Login com JWT. O token leva só o id (sub) e o cargo do usuário e vence em JWT_EXPIRES_IN.
// O front manda o token em cada requisição no cabeçalho: Authorization: Bearer <token>.

function gerarToken(usuario) {
  return jwt.sign({ cargo: usuario.cargo }, process.env.JWT_SECRET, {
    subject: String(usuario.id),
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

// Busca o usuário do token no banco a cada requisição. Fica num objeto para os testes
// que não usam banco poderem trocar a consulta por uma falsa.
const consultaUsuario = {
  buscar: (id) =>
    prisma.usuario.findUnique({ where: { id }, select: { id: true, cargo: true, ativo: true } }),
};

function naoAutenticado(res, erro) {
  res.status(401).json({ codigo: "NAO_AUTENTICADO", erro });
}

// Exige um token válido de um usuário ativo e guarda quem está logado em req.usuario = { id, cargo }.
// Consultar o banco faz o token parar de valer na hora em que o gestor desativa o usuário
// (OWASP API2), e uma troca de cargo também vale na hora: o cargo usado é o do banco, não o do token.
async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? "").split(" ");
  if (tipo !== "Bearer" || !token) {
    return naoAutenticado(res, "Faça login para continuar");
  }

  let dados;
  try {
    dados = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // Token expirado, alterado ou assinado com outro segredo.
    return naoAutenticado(res, "Sessão inválida ou expirada, faça login novamente");
  }

  const id = Number(dados.sub);
  if (!Number.isInteger(id) || id <= 0) {
    return naoAutenticado(res, "Sessão inválida ou expirada, faça login novamente");
  }

  try {
    const usuario = await consultaUsuario.buscar(id);
    // Usuário apagado ou desativado depois do login.
    if (!usuario || !usuario.ativo) {
      return naoAutenticado(res, "Usuário desativado ou removido, fale com o gestor");
    }
    req.usuario = { id: usuario.id, cargo: usuario.cargo };
    next();
  } catch (err) {
    next(err);
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

module.exports = { gerarToken, autenticar, exigirCargo, consultaUsuario };
