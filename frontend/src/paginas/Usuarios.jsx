import { useState } from "react";
import { Plus } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { rotas } from "../api/cliente";
import { Campo, Carregando, Entrada, ErroApiAlerta, Gaveta, Vazio, useAvisar, useCarregar } from "../componentes/ui";
import { data } from "../util/formato";

function FormUsuario({ aoSalvar, aoFechar }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("FUNCIONARIO");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!nome.trim()) return setErro({ message: "Informe o nome que a pessoa vai usar para entrar." });
    if (senha.length < 5) return setErro({ message: "A senha precisa ter pelo menos 5 caracteres." });
    setSalvando(true);
    setErro(null);
    try {
      await rotas.criarUsuario({ nome: nome.trim(), senha, cargo });
      aoSalvar("Usuário cadastrado");
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grade-campos" noValidate>
      <ErroApiAlerta erro={erro} />
      <Campo rotulo="Nome de entrada" ajuda="É com ele que a pessoa entra no sistema.">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={50} autoComplete="off" />
      </Campo>
      <Campo rotulo="Senha inicial" ajuda="Pelo menos 5 caracteres. Passe para a pessoa pessoalmente.">
        <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={72} autoComplete="new-password" />
      </Campo>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, color: "var(--tinta-2)", marginBottom: 6 }}>Cargo</legend>
        {[
          { v: "FUNCIONARIO", t: "Funcionário", d: "Consulta ingredientes e salgados e usa os cálculos." },
          { v: "GESTOR", t: "Gestor", d: "Também cadastra, altera e apaga, e cuida dos usuários." },
        ].map((o) => (
          <label key={o.v} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, cursor: "pointer" }}>
            <input
              type="radio"
              name="cargo"
              value={o.v}
              checked={cargo === o.v}
              onChange={() => setCargo(o.v)}
              style={{ accentColor: "var(--tijolo)", marginTop: 4 }}
            />
            <span>
              <strong>{o.t}</strong>
              <span style={{ display: "block", color: "var(--tinta-3)", fontSize: 13 }}>{o.d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="botao fantasma" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando…" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}

export function Usuarios() {
  const { usuario: eu } = useAutenticacao();
  const avisar = useAvisar();
  const lista = useCarregar(() => rotas.usuarios(), []);
  const [novo, setNovo] = useState(false);
  const [mudando, setMudando] = useState(null);
  const [erro, setErro] = useState(null);

  async function alternar(u) {
    setMudando(u.id);
    setErro(null);
    try {
      await rotas.ativarUsuario(u.id, !u.ativo);
      lista.recarregar();
      avisar(u.ativo ? `${u.nome} não entra mais` : `${u.nome} pode entrar de novo`);
    } catch (e) {
      setErro(e);
    } finally {
      setMudando(null);
    }
  }

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              Quem usa <b>o sistema</b>
            </h1>
            <p>Cadastre os funcionários e desative quem saiu da loja. Ao desativar, a pessoa perde o acesso na hora.</p>
          </div>
          <button type="button" className="botao" onClick={() => setNovo(true)}>
            <Plus size={18} aria-hidden="true" /> Novo usuário
          </button>
        </div>
        {erro && (
          <div style={{ marginBottom: 16 }}>
            <ErroApiAlerta erro={erro} />
          </div>
        )}
        <div className="superficie">
          {lista.carregando && !lista.dados ? (
            <Carregando />
          ) : lista.erro ? (
            <div style={{ padding: 16 }}>
              <ErroApiAlerta erro={lista.erro} />
            </div>
          ) : lista.dados.length === 0 ? (
            <Vazio titulo="Nenhum usuário" />
          ) : (
            <div className="tabela-envolve">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Cadastrado em</th>
                    <th>Acesso</th>
                    <th>
                      <span className="oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.dados.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.nome}</strong>
                        {u.id === eu?.id && <span style={{ color: "var(--tinta-3)" }}> (você)</span>}
                      </td>
                      <td>{u.cargo === "GESTOR" ? "Gestor" : "Funcionário"}</td>
                      <td className="num">{data(u.criadoEm)}</td>
                      <td>
                        <span className={`selo ${u.ativo ? "rentavel" : "neutro"}`}>{u.ativo ? "Ativo" : "Desativado"}</span>
                      </td>
                      <td className="direita">
                        {u.id !== eu?.id && (
                          <button
                            type="button"
                            className={`botao pequeno ${u.ativo ? "fantasma" : "secundario"}`}
                            onClick={() => alternar(u)}
                            disabled={mudando === u.id}
                          >
                            {mudando === u.id ? "…" : u.ativo ? "Desativar" : "Reativar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Gaveta titulo="Novo usuário" aberta={novo} aoFechar={() => setNovo(false)}>
        {novo && (
          <FormUsuario
            aoFechar={() => setNovo(false)}
            aoSalvar={(m) => {
              setNovo(false);
              lista.recarregar();
              avisar(m);
            }}
          />
        )}
      </Gaveta>
    </div>
  );
}
