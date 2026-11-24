import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { CardSalgado, GavetaParametros } from "../componentes/Salgados";
import { Alerta, Carregando, ErroApiAlerta, Vazio } from "../componentes/ui";
import { useResumo } from "../util/resumo";

const FILTROS = [
  { id: "todos", nome: "No cardápio" },
  { id: "PREJUIZO", nome: "Prejuízo" },
  { id: "ABAIXO_DA_META", nome: "Abaixo da meta" },
  { id: "RENTAVEL", nome: "Dão lucro" },
  { id: "pendentes", nome: "Sem preço ou receita" },
  { id: "inativos", nome: "Fora do cardápio" },
];

function passa(filtro, item) {
  if (filtro === "inativos") return !item.produto.ativo;
  if (!item.produto.ativo) return false;
  if (filtro === "todos") return true;
  if (filtro === "pendentes") return ["SEM_PRECO", "SEM_RECEITA", "CONFIGURAR"].includes(item.situacao);
  return item.situacao === filtro;
}

export function Produtos() {
  const { gestor } = useAutenticacao();
  const { dados, erro, carregando, parametros } = useResumo();
  const [filtro, setFiltro] = useState("todos");
  const [texto, setTexto] = useState("");
  const [parametrosAbertos, setParametrosAbertos] = useState(false);

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (dados?.itens || [])
      .filter((i) => passa(filtro, i))
      .filter((i) => !t || i.produto.nome.toLowerCase().includes(t));
  }, [dados, filtro, texto]);

  const quantos = (id) => (dados?.itens || []).filter((i) => passa(id, i)).length;

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              Salgados e <b>fichas técnicas</b>
            </h1>
            <p>Cada salgado com a receita, o custo por unidade e se o preço cadastrado dá lucro.</p>
          </div>
          <div className="acoes">
            <button type="button" className="botao fantasma" onClick={() => setParametrosAbertos(true)}>
              Dados do mês
            </button>
            {gestor && (
              <Link to="/produtos/novo" className="botao">
                <Plus size={18} aria-hidden="true" /> Novo salgado
              </Link>
            )}
          </div>
        </div>

        {dados && !dados.prontos && (
          <div style={{ marginBottom: 20 }}>
            <Alerta tipo="atencao" titulo="Falta o faturamento do mês">
              Sem ele não dá para dividir os custos fixos e calcular o preço.{" "}
              <button type="button" className="botao pequeno" style={{ marginLeft: 8 }} onClick={() => setParametrosAbertos(true)}>
                Informar
              </button>
            </Alerta>
          </div>
        )}

        <div className="barra-ferramentas superficie" style={{ marginBottom: 22 }}>
          <div className="busca">
            <Search size={17} aria-hidden="true" />
            <input
              className="entrada"
              type="search"
              placeholder="Buscar salgado"
              aria-label="Buscar salgado"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="abas" role="tablist" aria-label="Filtrar por situação">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.nome} {dados && <span className="num">({quantos(f.id)})</span>}
              </button>
            ))}
          </div>
        </div>

        {carregando && !dados ? (
          <div className="grade-salgados">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="esqueleto" style={{ height: 268 }} />
            ))}
          </div>
        ) : erro ? (
          <ErroApiAlerta erro={erro} />
        ) : lista.length === 0 ? (
          <div className="superficie">
            {(dados?.itens || []).length === 0 ? (
              <Vazio
                titulo="Nenhum salgado cadastrado"
                acao={
                  gestor && (
                    <Link to="/produtos/novo" className="botao">
                      Cadastrar o primeiro
                    </Link>
                  )
                }
              >
                Cadastre os ingredientes primeiro e depois monte a receita de cada salgado.
              </Vazio>
            ) : (
              <Vazio titulo="Nada neste filtro">Troque o filtro ou a busca para ver outros salgados.</Vazio>
            )}
          </div>
        ) : (
          <div className="grade-salgados">
            {lista.map((i) => (
              <CardSalgado key={i.produto.id} item={i} parametros={parametros} />
            ))}
          </div>
        )}
        {carregando && dados && <Carregando texto="Atualizando…" />}
      </div>
      <GavetaParametros aberta={parametrosAbertos} aoFechar={() => setParametrosAbertos(false)} />
    </div>
  );
}
