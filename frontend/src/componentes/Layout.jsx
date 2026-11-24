import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { contar, useResumo } from "../util/resumo";

export const CALCULOS = [
  {
    grupo: "Preço",
    itens: [
      { id: "preco", nome: "Preço sugerido", dica: "A partir do custo e das metas" },
      { id: "analise", nome: "Conferir um preço", dica: "Margem e lucro de um preço escolhido" },
      { id: "markup", nome: "Markup", dica: "Divisor e multiplicador" },
    ],
  },
  {
    grupo: "Vendas do mês",
    itens: [
      { id: "mes", nome: "Resultado do mês", dica: "Receita, custos e lucro" },
      { id: "equilibrio", nome: "Ponto de equilíbrio", dica: "Quanto vender para empatar" },
    ],
  },
  {
    grupo: "Custos",
    itens: [
      { id: "reajuste", nome: "Reajuste de ingredientes", dica: "Se a farinha subir 10%…" },
      { id: "fixos", nome: "Custos fixos", dica: "Total e peso no faturamento", rota: "/custos-fixos" },
    ],
  },
];

function BarraAviso() {
  const { dados } = useResumo();
  const c = contar(dados?.itens);
  const itens = [];
  if (dados && !dados.prontos) {
    itens.push(
      <span key="cfg">
        <i className="ponto" />
        Informe o faturamento do mês para calcular os preços.{" "}
        <Link to="/?parametros=1">Informar agora</Link>
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
  const [aberto, setAberto] = useState(false);
  const local = useLocation();
  const ref = useRef(null);

  useEffect(() => setAberto(false), [local.pathname, local.search]);

  useEffect(() => {
    if (!aberto) return;
    const clique = (e) => {
      if (!ref.current?.contains(e.target)) setAberto(false);
    };
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <header className="cabecalho" ref={ref}>
      <div className="conteiner">
        <Link to="/" className="marca" aria-label="A Casa do Salgado, ir para o painel">
          <small>A</small> Casa do Salgado
        </Link>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "ativo" : "")}>
            Painel
          </NavLink>
          <NavLink to="/produtos" className={({ isActive }) => (isActive ? "ativo" : "")}>
            Salgados
          </NavLink>
          <NavLink to="/ingredientes" className={({ isActive }) => (isActive ? "ativo" : "")}>
            Ingredientes
          </NavLink>
          <NavLink to="/custos-fixos" className={({ isActive }) => (isActive ? "ativo" : "")}>
            Custos fixos
          </NavLink>
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="submenu-calculos"
            onClick={() => setAberto((a) => !a)}
            className={local.pathname.startsWith("/calculos") ? "ativo" : ""}
          >
            Cálculos <ChevronDown size={16} aria-hidden="true" />
          </button>
          {gestor && (
            <NavLink to="/usuarios" className={({ isActive }) => (isActive ? "ativo" : "")}>
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
      {aberto && (
        <div className="submenu" id="submenu-calculos">
          <div className="conteiner">
            {CALCULOS.map((g) => (
              <div key={g.grupo}>
                <h3>{g.grupo}</h3>
                <ul>
                  {g.itens.map((c) => (
                    <li key={c.id}>
                      <Link to={c.rota || `/calculos?c=${c.id}`}>
                        {c.nome}
                        <span>{c.dica}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="destaque-submenu">
              <h3>Como o preço é montado</h3>
              <p>
                Preço = custo do salgado ÷ (1 − custo fixo % − despesas % − lucro %). É o markup divisor
                usado pelo SEBRAE.
              </p>
              <Link to="/calculos?c=preco" className="botao pequeno">
                Calcular um preço
              </Link>
            </div>
          </div>
        </div>
      )}
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
          <p>Precificação e fichas técnicas: o custo de cada salgado, da receita ao preço de venda.</p>
        </div>
        <div>
          <h3>Cadastros</h3>
          <ul>
            <li>
              <Link to="/produtos">Salgados e receitas</Link>
            </li>
            <li>
              <Link to="/ingredientes">Ingredientes</Link>
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
          <h3>Cálculos</h3>
          <ul>
            <li>
              <Link to="/calculos?c=preco">Preço sugerido</Link>
            </li>
            <li>
              <Link to="/calculos?c=mes">Resultado do mês</Link>
            </li>
            <li>
              <Link to="/calculos?c=equilibrio">Ponto de equilíbrio</Link>
            </li>
            <li>
              <Link to="/calculos?c=reajuste">Reajuste de ingredientes</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Ajuda</h3>
          <ul>
            <li>
              <Link to="/?parametros=1">Dados do mês</Link>
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
