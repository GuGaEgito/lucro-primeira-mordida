import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { contar, useResumo } from "../util/resumo";

function BarraAviso() {
  const { dados } = useResumo();
  const c = contar(dados?.itens);
  const itens = [];
  if (dados && !dados.prontos) {
    itens.push(
      <span key="cfg">
        <i className="ponto" />
        Informe o faturamento do mês para calcular os preços.{" "}
        <Link to="/painel?parametros=1">Informar agora</Link>
      </span>,
    );
  } else if (dados) {
    itens.push(
      <span key="p">
        <i className={`ponto ${c.prejuizo ? "ruim" : "bom"}`} />
        {c.prejuizo === 0
          ? "Nenhum salgado no prejuízo"
          : `${c.prejuizo} ${c.prejuizo === 1 ? "salgado está" : "salgados estão"} no prejuízo`}
      </span>,
    );
    if (c.abaixo > 0)
      itens.push(
        <span key="a">
          <i className="ponto" />
          {c.abaixo} abaixo da meta de lucro
        </span>,
      );
    if (c.semPreco > 0)
      itens.push(
        <span key="s">
          <i className="ponto" />
          {c.semPreco} sem preço ou receita
        </span>,
      );
  }
  return (
    <div className="aviso-topo">
      <div className="conteiner">
        {itens.length ? itens : <span>Precificação pelo método do markup divisor (SEBRAE)</span>}
      </div>
    </div>
  );
}

function Cabecalho() {
  const { usuario, gestor, sair } = useAutenticacao();
  const classe = ({ isActive }) => (isActive ? "ativo" : "");

  return (
    <header className="cabecalho">
      <div className="conteiner">
        <Link to="/" className="marca" aria-label="A Casa do Salgado, ir para o início">
          <small>A</small> Casa do Salgado
        </Link>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/painel" className={classe}>
            Painel
          </NavLink>
          <NavLink to="/custos-fixos" className={classe}>
            Custos fixos
          </NavLink>
          <NavLink to="/produtos" className={classe}>
            Salgados
          </NavLink>
          <NavLink to="/verificacao-insumos" className={classe}>
            Verificação de insumos
          </NavLink>
          {gestor && (
            <NavLink to="/usuarios" className={classe}>
              Usuários
            </NavLink>
          )}
        </nav>
        <div className="usuario-topo">
          <div className="quem">
            <strong>{usuario?.nome}</strong>
            <span>{gestor ? "Gestor" : "Funcionário"}</span>
          </div>
          <button type="button" className="botao-sair" onClick={() => sair()} aria-label="Sair do sistema" title="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Rodape() {
  const { gestor } = useAutenticacao();
  return (
    <footer className="rodape">
      <div className="conteiner">
        <div>
          <h2>
            A Casa
            <span>do Salgado</span>
          </h2>
          <p>Precificação e fichas técnicas dos salgados.</p>
        </div>
        <div>
          <h3>Telas</h3>
          <ul>
            <li>
              <Link to="/painel">Painel</Link>
            </li>
            <li>
              <Link to="/produtos">Salgados e receitas</Link>
            </li>
            <li>
              <Link to="/custos-fixos">Custos fixos</Link>
            </li>
            {gestor && (
              <li>
                <Link to="/usuarios">Usuários</Link>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h3>Ajuda</h3>
          <ul>
            <li>
              <Link to="/painel?parametros=1">Dados do mês</Link>
            </li>
            <li>
              <a href="http://localhost:3000/api/docs" target="_blank" rel="noreferrer">
                Documentação da API
              </a>
            </li>
          </ul>
        </div>
        <div className="base">
          <span>© {new Date().getFullYear()} A Casa do Salgado</span>
          <span>Valores em reais, arredondados em centavos</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <>
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <BarraAviso />
      <Cabecalho />
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
      <Rodape />
    </>
  );
}
