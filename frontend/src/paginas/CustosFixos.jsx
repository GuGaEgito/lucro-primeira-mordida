import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { rotas } from "../api/cliente";
import { GavetaParametros } from "../componentes/Salgados";
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
import { lerNumero, pct, reais } from "../util/formato";
import { parametrosProntos, useParametros } from "../util/parametros";
import { invalidarResumo, paramsApi } from "../util/resumo";

// Contas que quase toda loja tem: viram atalhos para cadastrar com um clique.
const SUGESTOES = ["Aluguel", "Luz", "Água", "Gás", "Salários", "Internet"];

function FormCusto({ inicial, nomeInicial = "", aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(inicial?.nome || nomeInicial);
  const [valor, setValor] = useState(inicial ? String(Number(inicial.valorMensal)).replace(".", ",") : "");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const v = lerNumero(valor);
    if (!nome.trim()) return setErro({ message: "Escreva o nome da conta, por exemplo Aluguel." });
    if (!(v >= 0)) return setErro({ message: "Escreva o valor só com números, por exemplo 1500." });
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { nome: nome.trim(), valorMensal: v };
      if (inicial) await rotas.alterarCustoFixo(inicial.id, corpo);
      else await rotas.criarCustoFixo(corpo);
      aoSalvar(inicial ? "Conta atualizada" : "Conta adicionada");
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grade-campos" noValidate>
      <ErroApiAlerta erro={erro} />
      <Campo rotulo="Nome da conta">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={50} placeholder="Aluguel" />
      </Campo>
      <Campo rotulo="Quanto paga por mês">
        <Entrada prefixo="R$" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1500,00" />
      </Campo>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="botao fantasma" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando…" : inicial ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

// Pergunta direta: quanto a loja vende por mês. É o que divide as contas entre os salgados.
function VendasDoMes({ podeEditar, aoAbrirMais }) {
  const [parametros, salvar] = useParametros();
  const [texto, setTexto] = useState(parametros.faturamentoMensal || "");
  const [editando, setEditando] = useState(!parametrosProntos(parametros));
  const [erro, setErro] = useState(null);
  const avisar = useAvisar();

  useEffect(() => {
    setTexto(parametros.faturamentoMensal || "");
    setEditando(!parametrosProntos(parametros));
  }, [parametros]);

  function enviar(e) {
    e.preventDefault();
    const v = lerNumero(texto);
    if (!(v > 0)) return setErro("Escreva quanto a loja vende por mês, só com números, por exemplo 10000.");
    setErro(null);
    salvar({ faturamentoMensal: String(v) });
    invalidarResumo();
    avisar("Vendas do mês salvas");
    setEditando(false);
  }

  if (!editando)
    return (
      <p className="sub">
        A loja vende cerca de <strong className="num">{reais(paramsApi(parametros).faturamentoMensal)}</strong> por mês.{" "}
        {podeEditar && (
          <button type="button" className="link-botao" onClick={() => setEditando(true)}>
            Mudar
          </button>
        )}
      </p>
    );

  if (!podeEditar)
    return <p className="sub">O gestor ainda não informou quanto a loja vende por mês.</p>;

  return (
    <form onSubmit={enviar} className="vendas-mes" noValidate>
      <Campo rotulo="Quanto a loja vende por mês?" ajuda="Um valor aproximado já serve." erro={erro}>
        <Entrada prefixo="R$" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="10000" />
      </Campo>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="botao">
          Salvar
        </button>
        <button type="button" className="link-botao" onClick={aoAbrirMais}>
          Mais opções
        </button>
      </div>
    </form>
  );
}

export function CustosFixos() {
  const { gestor } = useAutenticacao();
  const avisar = useAvisar();
  const [confirmar, elementoConfirmar] = useConfirmar();
  const [parametros] = useParametros();
  const lista = useCarregar(() => rotas.custosFixos(), []);
  const [editando, setEditando] = useState(null); // null | { novo: true, nome } | custo
  const [maisOpcoes, setMaisOpcoes] = useState(false);

  const itens = lista.dados?.itens || [];
  const total = Number(lista.dados?.totalMensal || 0);
  const vendas = parametrosProntos(parametros) ? Number(paramsApi(parametros).faturamentoMensal) : 0;
  const parte = vendas > 0 ? (total / vendas) * 100 : null;
  const jaTem = new Set(itens.map((c) => c.nome.trim().toLowerCase()));
  const sugestoes = SUGESTOES.filter((s) => !jaTem.has(s.toLowerCase()));

  const recarregarTudo = (msg) => {
    setEditando(null);
    lista.recarregar();
    invalidarResumo();
    avisar(msg);
  };

  const novo = (nome = "") => setEditando({ novo: true, nome });

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              <b>Custos fixos</b> do mês
            </h1>
            <p>
              São as contas que a loja paga todo mês, vendendo ou não. Cadastre aqui e o sistema já coloca esse valor no
              preço de cada salgado.
            </p>
          </div>
          {gestor && (
            <button type="button" className="botao" onClick={() => novo()}>
              <Plus size={18} aria-hidden="true" /> Adicionar conta
            </button>
          )}
        </div>

        <div className="duas-colunas">
          <div className="superficie">
            {lista.carregando && !lista.dados ? (
              <Carregando />
            ) : lista.erro ? (
              <div style={{ padding: 16 }}>
                <ErroApiAlerta erro={lista.erro} />
              </div>
            ) : itens.length === 0 ? (
              <Vazio
                titulo="Nenhuma conta cadastrada ainda"
                acao={
                  gestor && (
                    <button type="button" className="botao" onClick={() => novo()}>
                      Adicionar a primeira conta
                    </button>
                  )
                }
              >
                Comece pelas contas maiores, como aluguel, luz e salários.
              </Vazio>
            ) : (
              <ul className="lista-contas num">
                {itens.map((c) => (
                  <li key={c.id}>
                    <strong>{c.nome}</strong>
                    <span className="valor">{reais(c.valorMensal)}</span>
                    {gestor && (
                      <div className="acoes-linha">
                        <button type="button" className="botao-icone" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="botao-icone perigo"
                          aria-label={`Apagar ${c.nome}`}
                          onClick={() =>
                            confirmar({
                              titulo: `Apagar ${c.nome}?`,
                              texto: "A conta sai do total do mês e o preço dos salgados é recalculado.",
                              acao: async () => {
                                await rotas.apagarCustoFixo(c.id);
                                recarregarTudo("Conta apagada");
                              },
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                <li className="total">
                  <strong>Total por mês</strong>
                  <span className="valor">{reais(total)}</span>
                  {gestor && <span />}
                </li>
              </ul>
            )}

            {gestor && sugestoes.length > 0 && !lista.erro && lista.dados && (
              <div className="sugestoes-contas">
                <span>Adicionar rápido:</span>
                {sugestoes.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => novo(s)}>
                    <Plus size={14} aria-hidden="true" /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="superficie bloco">
            <h2>Resumo</h2>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13.5, color: "var(--tinta-2)" }}>Contas fixas por mês</div>
              <div className="resultado-grande num">{reais(total)}</div>
            </div>
            {parte !== null && total > 0 && (
              <p className="sub" style={{ marginTop: 10 }}>
                De cada R$ 100 que a loja vende, <strong className="num">{reais(parte)}</strong> vão para essas contas (
                {pct(parte.toFixed(1))}).
              </p>
            )}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--rejunte)" }}>
              <VendasDoMes podeEditar={gestor} aoAbrirMais={() => setMaisOpcoes(true)} />
            </div>
            {!gestor && (
              <p className="sub" style={{ marginTop: 14, fontSize: 13 }}>
                Só o gestor pode mudar estas contas.
              </p>
            )}
          </aside>
        </div>
      </div>

      <Gaveta
        titulo={editando?.novo ? "Adicionar conta" : `Editar ${editando?.nome || ""}`}
        aberta={Boolean(editando)}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormCusto
            key={editando.novo ? `novo-${editando.nome}` : editando.id}
            inicial={editando.novo ? null : editando}
            nomeInicial={editando.novo ? editando.nome : ""}
            aoFechar={() => setEditando(null)}
            aoSalvar={recarregarTudo}
          />
        )}
      </Gaveta>
      <GavetaParametros aberta={maisOpcoes} aoFechar={() => setMaisOpcoes(false)} />
      {elementoConfirmar}
    </div>
  );
}
