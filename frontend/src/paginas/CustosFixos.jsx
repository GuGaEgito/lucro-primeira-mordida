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
import { data, lerNumero, pct, reais, reaisFino } from "../util/formato";
import { parametrosProntos, useParametros } from "../util/parametros";
import { invalidarResumo, paramsApi } from "../util/resumo";

function FormCusto({ inicial, aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [valor, setValor] = useState(inicial ? String(Number(inicial.valorMensal)).replace(".", ",") : "");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const v = lerNumero(valor);
    if (!nome.trim()) return setErro({ message: "Dê um nome ao custo, por exemplo Aluguel." });
    if (!(v >= 0)) return setErro({ message: "Informe o valor do mês com números, por exemplo 1500." });
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { nome: nome.trim(), valorMensal: v };
      if (inicial) await rotas.alterarCustoFixo(inicial.id, corpo);
      else await rotas.criarCustoFixo(corpo);
      aoSalvar(inicial ? "Custo fixo atualizado" : "Custo fixo cadastrado");
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grade-campos" noValidate>
      <ErroApiAlerta erro={erro} />
      <Campo rotulo="Nome">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={50} placeholder="Aluguel" />
      </Campo>
      <Campo rotulo="Valor por mês">
        <Entrada prefixo="R$" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1500,00" />
      </Campo>
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

export function CustosFixos() {
  const { gestor } = useAutenticacao();
  const avisar = useAvisar();
  const [confirmar, elementoConfirmar] = useConfirmar();
  const [parametros] = useParametros();
  const lista = useCarregar(() => rotas.custosFixos(), []);
  const [editando, setEditando] = useState(null);
  const [parametrosAbertos, setParametrosAbertos] = useState(false);
  const [producao, setProducao] = useState("");
  const [peso, setPeso] = useState(null);

  const itens = lista.dados?.itens || [];
  const total = Number(lista.dados?.totalMensal || 0);

  useEffect(() => {
    if (!lista.dados || itens.length === 0) {
      setPeso(null);
      return;
    }
    const prod = lerNumero(producao);
    const corpo = {
      custos: itens.map((c) => ({ nome: c.nome, valorMensal: c.valorMensal })),
      ...(parametrosProntos(parametros) && { faturamentoMensal: paramsApi(parametros).faturamentoMensal }),
      ...(prod > 0 && { producaoMensal: prod }),
    };
    let vivo = true;
    const t = setTimeout(() => {
      rotas
        .calc("custos-fixos", corpo)
        .then((r) => vivo && setPeso(r))
        .catch(() => vivo && setPeso(null));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.dados, producao, parametros]);

  const recarregarTudo = (msg) => {
    setEditando(null);
    lista.recarregar();
    invalidarResumo();
    avisar(msg);
  };

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              <b>Custos fixos</b> do mês
            </h1>
            <p>O que a loja paga todo mês, vendendo ou não: aluguel, energia, gás, salários. Entra no preço de cada salgado.</p>
          </div>
          {gestor && (
            <button type="button" className="botao" onClick={() => setEditando("novo")}>
              <Plus size={18} aria-hidden="true" /> Novo custo
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
                titulo="Nenhum custo fixo"
                acao={
                  gestor && (
                    <button type="button" className="botao" onClick={() => setEditando("novo")}>
                      Cadastrar o primeiro
                    </button>
                  )
                }
              >
                Sem custos fixos, o preço sugerido fica mais baixo do que deveria.
              </Vazio>
            ) : (
              <div className="tabela-envolve">
                <table className="tabela num">
                  <thead>
                    <tr>
                      <th>Custo</th>
                      <th className="direita">Por mês</th>
                      <th style={{ width: "30%" }}>Parte do total</th>
                      <th>Atualizado</th>
                      {gestor && (
                        <th>
                          <span className="oculto">Ações</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((c) => {
                      const parte = total > 0 ? (Number(c.valorMensal) / total) * 100 : 0;
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.nome}</strong>
                          </td>
                          <td className="direita">{reais(c.valorMensal)}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1, height: 10, background: "var(--rejunte)", borderRadius: 3, padding: 2 }}>
                                <div style={{ width: `${parte}%`, height: "100%", background: "var(--parte-fixo)", borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 12.5, minWidth: 44, textAlign: "right" }}>{pct(parte.toFixed(1))}</span>
                            </div>
                          </td>
                          <td>{data(c.atualizadoEm)}</td>
                          {gestor && (
                            <td>
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
                                      texto: "O custo sai da conta do mês e os preços sugeridos de todos os salgados mudam.",
                                      acao: async () => {
                                        await rotas.apagarCustoFixo(c.id);
                                        recarregarTudo("Custo fixo apagado");
                                      },
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total do mês</td>
                      <td className="direita">{reais(total)}</td>
                      <td colSpan={gestor ? 3 : 2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <aside className="superficie bloco">
            <h2>O peso no preço</h2>
            <p className="sub">Quanto os custos fixos representam do que a loja vende.</p>
            <dl className="lista-valores num" style={{ marginTop: 16 }}>
              <div className="total">
                <dt>Total por mês</dt>
                <dd>{reais(total)}</dd>
              </div>
              <div>
                <dt>Sobre o faturamento</dt>
                <dd>
                  {peso?.percentualSobreFaturamento != null ? (
                    pct(peso.percentualSobreFaturamento)
                  ) : (
                    <button
                      type="button"
                      onClick={() => setParametrosAbertos(true)}
                      style={{ all: "unset", cursor: "pointer", color: "var(--tijolo)", textDecoration: "underline" }}
                    >
                      Informar faturamento
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt>Por salgado produzido</dt>
                <dd>{peso?.porUnidade != null ? reaisFino(peso.porUnidade) : "—"}</dd>
              </div>
            </dl>
            <div style={{ marginTop: 16 }}>
              <Campo rotulo="Salgados produzidos no mês" ajuda="Opcional: para ver o custo fixo por unidade.">
                <Entrada inputMode="numeric" sufixo="un" value={producao} onChange={(e) => setProducao(e.target.value)} placeholder="4000" />
              </Campo>
            </div>
            {parametrosProntos(parametros) && (
              <p className="sub" style={{ marginTop: 14 }}>
                Faturamento usado: <strong className="num">{reais(paramsApi(parametros).faturamentoMensal)}</strong>.{" "}
                <button
                  type="button"
                  onClick={() => setParametrosAbertos(true)}
                  style={{ all: "unset", cursor: "pointer", color: "var(--tijolo)", textDecoration: "underline" }}
                >
                  Mudar
                </button>
              </p>
            )}
          </aside>
        </div>
      </div>

      <Gaveta
        titulo={editando === "novo" ? "Novo custo fixo" : `Editar ${editando?.nome || ""}`}
        aberta={Boolean(editando)}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormCusto
            key={editando === "novo" ? "novo" : editando.id}
            inicial={editando === "novo" ? null : editando}
            aoFechar={() => setEditando(null)}
            aoSalvar={recarregarTudo}
          />
        )}
      </Gaveta>
      <GavetaParametros aberta={parametrosAbertos} aoFechar={() => setParametrosAbertos(false)} />
      {elementoConfirmar}
    </div>
  );
}
