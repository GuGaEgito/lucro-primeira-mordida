// Cliente da API da Casa do Salgado.
// Guarda o token do login e manda em todas as chamadas no cabeçalho Authorization.

const BASE = import.meta.env.VITE_API_URL || "";
const CHAVE_TOKEN = "casa-do-salgado:token";

let aoSairPorToken = () => {};

export function definirAoSair(fn) {
  aoSairPorToken = fn;
}

export function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function salvarToken(token) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* navegador sem armazenamento: o login dura só esta aba */
  }
}

export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro || mensagemPadrao(status));
    this.status = status;
    this.codigo = corpo?.codigo;
    this.detalhes = corpo?.detalhes || [];
  }
}

function mensagemPadrao(status) {
  if (status === 0) return "Não foi possível falar com o servidor. Confira se a API está ligada.";
  if (status === 403) return "Seu cargo não pode fazer esta ação.";
  if (status === 404) return "Não encontrado.";
  if (status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  return "Algo deu errado no servidor. Tente de novo.";
}

async function requisitar(metodo, caminho, corpo) {
  const token = lerToken();
  let resposta;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0);
  }

  if (resposta.status === 204) return null;

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    // Token vencido ou usuário desativado: volta para o login.
    if (resposta.status === 401 && caminho !== "/api/auth/login") {
      salvarToken(null);
      aoSairPorToken();
    }
    throw new ErroApi(resposta.status, dados);
  }
  return dados;
}

export const api = {
  get: (c) => requisitar("GET", c),
  post: (c, corpo = {}) => requisitar("POST", c, corpo),
  put: (c, corpo) => requisitar("PUT", c, corpo),
  patch: (c, corpo) => requisitar("PATCH", c, corpo),
  del: (c) => requisitar("DELETE", c),
};

// Rotas usadas pelas telas, num lugar só.
export const rotas = {
  login: (nome, senha) => api.post("/api/auth/login", { nome, senha }),
  eu: () => api.get("/api/auth/eu"),

  ingredientes: () => api.get("/api/ingredientes"),
  criarIngrediente: (d) => api.post("/api/ingredientes", d),
  alterarIngrediente: (id, d) => api.put(`/api/ingredientes/${id}`, d),
  apagarIngrediente: (id) => api.del(`/api/ingredientes/${id}`),
  historicoIngrediente: (id) => api.get(`/api/ingredientes/${id}/historico`),

  produtos: (todos = false) => api.get(`/api/produtos${todos ? "?todos=true" : ""}`),
  produto: (id) => api.get(`/api/produtos/${id}`),
  criarProduto: (d) => api.post("/api/produtos", d),
  alterarProduto: (id, d) => api.put(`/api/produtos/${id}`, d),
  ativarProduto: (id, ativo) => api.patch(`/api/produtos/${id}/ativo`, { ativo }),
  apagarProduto: (id) => api.del(`/api/produtos/${id}`),
  precificar: (id, parametros) => api.post(`/api/produtos/${id}/precificacao`, parametros),

  custosFixos: () => api.get("/api/custos-fixos"),
  criarCustoFixo: (d) => api.post("/api/custos-fixos", d),
  alterarCustoFixo: (id, d) => api.put(`/api/custos-fixos/${id}`, d),
  apagarCustoFixo: (id) => api.del(`/api/custos-fixos/${id}`),

  usuarios: () => api.get("/api/usuarios"),
  criarUsuario: (d) => api.post("/api/usuarios", d),
  ativarUsuario: (id, ativo) => api.patch(`/api/usuarios/${id}/ativo`, { ativo }),

  calc: (nome, corpo) => api.post(`/api/calculos/${nome}`, corpo),
};
