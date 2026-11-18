const { consultaUsuario } = require("../src/shared/autenticacao");

// Para os testes que não usam banco: o autenticar passa a achar estes usuários em vez de
// consultar o Postgres. id 1 = gestor, id 2 = funcionário, id 3 = desativado.
const USUARIOS = {
  1: { id: 1, cargo: "GESTOR", ativo: true },
  2: { id: 2, cargo: "FUNCIONARIO", ativo: true },
  3: { id: 3, cargo: "FUNCIONARIO", ativo: false },
};

function usarUsuariosFalsos() {
  consultaUsuario.buscar = async (id) => USUARIOS[id] ?? null;
}

module.exports = { usarUsuariosFalsos };
