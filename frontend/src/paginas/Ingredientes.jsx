import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, History, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { rotas } from "../api/cliente";
import {
  Campo,
  Carregando,
  Entrada,
  ErroApiAlerta,
  Gaveta,
  Vazio,
  useAvisar,
  useCarregar,
  useConfirmar,
} from "../componentes/ui";
import { data, lerNumero, reaisFino, rotuloUnidade, UNIDADES } from "../util/formato";
import { invalidarResumo } from "../util/resumo";

// Ingrediente cujo custo mudou nos últimos 7 dias fica marcado até alguém abrir o histórico.
const CHAVE_VISTOS = "casa-do-salgado:ingredientes-vistos";
function lerVistos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "{}");
  } catch {
    return {};
  }
}
function marcarVisto(ing) {
  try {
    const v = lerVistos();
    v[ing.id] = ing.atualizadoEm;
    localStorage.setItem(CHAVE_VISTOS, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

function FormIngrediente({ inicial, aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [unidade, setUnidade] = useState(inicial?.unidade || "KG");
  const [custo, setCusto] = useState(inicial ? String(Number(inicial.custoUnitario)).replace(".", ",") : "");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const valor = lerNumero(custo);
    if (!nome.trim()) return setErro({ message: "Dê um nome ao ingrediente." });
    if (!(valor >= 0)) return setErro({ message: "Informe o custo com números, por exemplo 5,90." });
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { nome: nome.trim(), unidade, custoUnitario: valor };
      if (inicial) await rotas.alterarIngrediente(inicial.id, corpo);
      else await rotas.criarIngrediente(corpo);
      aoSalvar(inicial ? "Ingrediente atualizado" : "Ingrediente cadastrado");
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form id="form-ingrediente" onSubmit={enviar} className="grade-campos" noValidate>
      <ErroApiAlerta erro={erro} />
      <Campo rotulo="Nome">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={50} placeholder="Farinha de trigo" />
      </Campo>
      <div className="grade-campos duas">
        <Campo rotulo="Como você compra" ajuda="A unidade do preço da nota.">
          <select className="entrada" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo={`Custo por ${rotuloUnidade(unidade)}`} ajuda="Até 4 casas decimais.">
          <Entrada prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="5,90" />
        </Campo>
      </div>
      {inicial && (
        <p style={{ fontSize: 13.5, color: "var(--tinta-2)" }}>
          Se o custo mudar, a mudança vai para o histórico com o seu nome, e todo salgado que usa este ingrediente muda de
          preço.
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="botao fantasma" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando…" : inicial ? "Salvar" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}

function Historico({ ingrediente }) {
  const h = useCarregar(() => rotas.historicoIngrediente(ingrediente.id), [ingrediente.id]);
  if (h.carregando) return <Carregando />;
  if (h.erro) return <ErroApiAlerta erro={h.erro} />;
  if (!h.dados.itens.length)
    return <Vazio titulo="Sem mudanças de custo">O custo deste ingrediente não mudou desde o cadastro.</Vazio>;
  return (
    <table className="tabela num">
      <thead>
        <tr>
          <th>Quando</th>
          <th className="direita">Antes</th>
          <th className="direita">Depois</th>
          <th className="direita">Variação</th>
          <th>Quem</th>
        </tr>
      </thead>
      <tbody>
        {h.dados.itens.map((i) => {
          const antes = Number(i.custoAnterior);
          const depois = Number(i.custoNovo);
          const variacao = antes > 0 ? ((depois - antes) / antes) * 100 : null;
          return (
            <tr key={i.id}>
              <td>{data(i.alteradoEm)}</td>
              <td className="direita">{i.custoAnterior === null ? "—" : reaisFino(i.custoAnterior)}</td>
              <td className="direita">{reaisFino(i.custoNovo)}</td>
              <td
                className="direita"
                style={{ color: variacao > 0 ? "var(--prejuizo)" : variacao < 0 ? "var(--azulejo)" : undefined, fontWeight: 600 }}
              >
                {variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(1).replace(".", ",")}%`}
              </td>
              <td>{i.usuario?.nome}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Ingredientes() {
  const { gestor } = useAutenticacao();
  const avisar = useAvisar();
  const [confirmar, elementoConfirmar] = useConfirmar();
  const lista = useCarregar(() => rotas.ingredientes(), []);
  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState({ campo: "nome", sobe: true });
  const [editando, setEditando] = useState(null); // null | "novo" | ingrediente
  const [historico, setHistorico] = useState(null);
  const [vistos, setVistos] = useState(lerVistos);

  const linhas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const l = (lista.dados || []).filter((g) => !t || g.nome.toLowerCase().includes(t));
    const valor = (g) =>
      ordem.campo === "custo" ? Number(g.custoUnitario) : ordem.campo === "data" ? new Date(g.atualizadoEm).getTime() : g.nome.toLowerCase();
    return l.sort((a, b) => (valor(a) < valor(b) ? -1 : valor(a) > valor(b) ? 1 : 0) * (ordem.sobe ? 1 : -1));
  }, [lista.dados, texto, ordem]);

  const mudou = (g) => Date.now() - new Date(g.atualizadoEm).getTime() < SETE_DIAS && vistos[g.id] !== g.atualizadoEm;

  const Cabeca = ({ campo, children, direita }) => (
    <th className={direita ? "direita" : undefined} aria-sort={ordem.campo === campo ? (ordem.sobe ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setOrdem((o) => ({ campo, sobe: o.campo === campo ? !o.sobe : true }))}>
        {children}
        {ordem.campo === campo && (ordem.sobe ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );

  const fecharForm = () => setEditando(null);

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              <b>Ingredientes</b> e o que custam
            </h1>
            <p>O preço que você paga em cada ingrediente. É daqui que sai o custo de toda receita.</p>
          </div>
          {gestor && (
            <button type="button" className="botao" onClick={() => setEditando("novo")}>
              <Plus size={18} aria-hidden="true" /> Novo ingrediente
            </button>
          )}
        </div>

        <div className="superficie">
          <div className="barra-ferramentas">
            <div className="busca">
              <Search size={17} aria-hidden="true" />
              <input
                className="entrada"
                type="search"
                placeholder="Buscar ingrediente"
                aria-label="Buscar ingrediente"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            {lista.dados && (
              <span style={{ fontSize: 13.5, color: "var(--tinta-3)" }} className="num">
                {linhas.length} de {lista.dados.length}
              </span>
            )}
          </div>

          {lista.carregando && !lista.dados ? (
            <Carregando />
          ) : lista.erro ? (
            <div style={{ padding: 16 }}>
              <ErroApiAlerta erro={lista.erro} />
            </div>
          ) : (lista.dados || []).length === 0 ? (
            <Vazio
              titulo="Nenhum ingrediente ainda"
              acao={
                gestor && (
                  <button type="button" className="botao" onClick={() => setEditando("novo")}>
                    Cadastrar o primeiro
                  </button>
                )
              }
            >
              Comece pela farinha, o óleo e o recheio: com eles cadastrados, dá para montar a receita da coxinha.
            </Vazio>
          ) : linhas.length === 0 ? (
            <Vazio titulo="Nada com esse nome">Confira a busca.</Vazio>
          ) : (
            <div className="tabela-envolve">
              <table className="tabela num">
                <thead>
                  <tr>
                    <Cabeca campo="nome">Ingrediente</Cabeca>
                    <th>Unidade de compra</th>
                    <Cabeca campo="custo" direita>
                      Custo
                    </Cabeca>
                    <Cabeca campo="data">Atualizado</Cabeca>
                    <th className="direita">
                      <span className="oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((g) => (
                    <tr key={g.id}>
                      <td className="nome-celula">
                        <strong>{g.nome}</strong>{" "}
                        {mudou(g) && (
                          <span className="selo mudou" style={{ display: "inline-flex", marginLeft: 6 }}>
                            custo mudou
                          </span>
                        )}
                      </td>
                      <td>{UNIDADES.find((u) => u.valor === g.unidade)?.nome}</td>
                      <td className="direita">
                        <strong>{reaisFino(g.custoUnitario)}</strong>
                        <span style={{ color: "var(--tinta-3)" }}> /{rotuloUnidade(g.unidade)}</span>
                      </td>
                      <td>{data(g.atualizadoEm)}</td>
                      <td>
                        <div className="acoes-linha">
                          <button
                            type="button"
                            className="botao-icone"
                            aria-label={`Histórico de custo de ${g.nome}`}
                            title="Histórico de custo"
                            onClick={() => {
                              marcarVisto(g);
                              setVistos(lerVistos());
                              setHistorico(g);
                            }}
                          >
                            <History size={17} />
                          </button>
                          {gestor && (
                            <>
                              <button
                                type="button"
                                className="botao-icone"
                                aria-label={`Editar ${g.nome}`}
                                title="Editar"
                                onClick={() => setEditando(g)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="botao-icone perigo"
                                aria-label={`Apagar ${g.nome}`}
                                title="Apagar"
                                onClick={() =>
                                  confirmar({
                                    titulo: `Apagar ${g.nome}?`,
                                    texto:
                                      "O ingrediente sai do cadastro de vez. Se ele estiver em alguma receita ou tiver histórico de custo, o sistema não deixa apagar.",
                                    acao: async () => {
                                      await rotas.apagarIngrediente(g.id);
                                      lista.recarregar();
                                      invalidarResumo();
                                      avisar("Ingrediente apagado");
                                    },
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Gaveta
        titulo={editando === "novo" ? "Novo ingrediente" : `Editar ${editando?.nome || ""}`}
        aberta={Boolean(editando)}
        aoFechar={fecharForm}
      >
        {editando && (
          <FormIngrediente
            key={editando === "novo" ? "novo" : editando.id}
            inicial={editando === "novo" ? null : editando}
            aoFechar={fecharForm}
            aoSalvar={(msg) => {
              fecharForm();
              lista.recarregar();
              invalidarResumo();
              avisar(msg);
            }}
          />
        )}
      </Gaveta>

      <Gaveta titulo={`Histórico: ${historico?.nome || ""}`} aberta={Boolean(historico)} aoFechar={() => setHistorico(null)} larga>
        {historico && <Historico ingrediente={historico} />}
      </Gaveta>
      {elementoConfirmar}
    </div>
  );
}
