import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { Alerta, Campo, Entrada } from "../componentes/ui";

export function Login() {
  const { usuario, entrar, motivoSaida } = useAutenticacao();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();
  const local = useLocation();

  if (usuario) return <Navigate to={local.state?.de || "/"} replace />;

  async function enviar(e) {
    e.preventDefault();
    if (!nome.trim() || !senha) {
      setErro("Preencha o nome e a senha.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(nome.trim(), senha);
      navegar(local.state?.de || "/", { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-login">
      <section className="login-parede" aria-label="A Casa do Salgado">
        <div className="login-marca">
          <span className="placa">Precificação e fichas técnicas</span>
          <h1>
            A Casa
            <br />
            do Salgado
          </h1>
        </div>
      </section>

      <div className="login-form">
        <form onSubmit={enviar} noValidate>
          <div>
            <h2>Entrar</h2>
            <p className="sub">Use o nome e a senha que o gestor cadastrou para você.</p>
          </div>
          {motivoSaida && <Alerta tipo="atencao">{motivoSaida}</Alerta>}
          {erro && <Alerta tipo="erro">{erro}</Alerta>}
          <Campo rotulo="Nome">
            <Entrada
              autoComplete="username"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              maxLength={50}
            />
          </Campo>
          <Campo rotulo="Senha">
            <Entrada
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              maxLength={100}
            />
          </Campo>
          <button className="botao" type="submit" disabled={enviando}>
            <LogIn size={18} aria-hidden="true" />
            {enviando ? "Entrando…" : "Entrar"}
          </button>
          <p className="ajuda">Esqueceu a senha? Fale com o gestor da loja.</p>
        </form>
      </div>
    </div>
  );
}
