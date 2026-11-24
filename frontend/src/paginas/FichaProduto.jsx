import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { rotas } from "../api/cliente";
import { FileiraTijolos, partesDaAnalise, partesDoSugerido } from "../componentes/FileiraTijolos";
import { GavetaParametros } from "../componentes/Salgados";
import {
  Alerta,
  Campo,
  Carregando,
  Entrada,
  ErroApiAlerta,
  Selo,
  useAvisar,
  useCarregar,
  useConfirmar,
} from "../componentes/ui";
import { lerNumero, pct, reais, reaisFino, rotuloUnidade, unidadesCompativeis } from "../util/formato";
import { parametrosProntos, useParametros } from "../util/parametros";
import { invalidarResumo, paramsApi } from "../util/resumo";

const linhaVazia = () => ({ chave: Math.random().toString(36).slice(2), ingredienteId: "", quantidade: "", unidadeReceita: "" });

function paraTexto(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

export function FichaProduto({ novo = false }) {
  const { id } = useParams();
  const { gestor } = useAutenticacao();
  const navegar = useNavigate();
  const avisar = useAvisar();
  const [confirmar, elementoConfirmar] = useConfirmar();
  const [parametros] = useParametros();
  const [parametrosAbertos, setParametrosAbertos] = useState(false);

  const ingredientes = useCarregar(() => rotas.ingredientes(), []);
  const custosFixos = useCarregar(() => rotas.custosFixos(), []);
  const produto = useCarregar(() => (novo ? Promise.resolve(null) : rotas.produto(id)), [id, novo]);

  const [form, setForm] = useState({ nome: "", rendimento: "", precoVenda: "", ativo: true });
  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [calculo, setCalculo] = useState({ ficha: null, sugerido: null, analise: null, pctFixo: null, erro: null });

  // Preenche o formulário com o produto carregado.
  useEffect(() => {
    const p = produto.dados;
    if (!p) return;
    setForm({
      nome: p.nome,
      rendimento: paraTexto(Number(p.rendimento)),
      precoVenda: p.precoVenda === null ? "" : paraTexto(Number(p.precoVenda).toFixed(2)),
      ativo: p.ativo,
    });
    setLinhas(
      p.ingredientes.length
        ? p.ingredientes.map((i) => ({
            chave: String(i.id),
            ingredienteId: String(i.ingredienteId),
            quantidade: paraTexto(Number(i.quantidade)),
            unidadeReceita: i.unidadeReceita,
          }))
        : [linhaVazia()],
    );
  }, [produto.dados]);

  const porId = useMemo(() => {
    const m = new Map();
    (ingredientes.dados || []).forEach((g) => m.set(String(g.id), g));
    return m;
  }, [ingredientes.dados]);

  const linhasValidas = useMemo(
    () =>
      linhas
        .map((l) => ({ ...l, ing: porId.get(l.ingredienteId), q: lerNumero(l.quantidade) }))
        .filter((l) => l.ing && l.q > 0 && l.unidadeReceita),
    [linhas, porId],
  );

  const rendimento = lerNumero(form.rendimento);
  const precoVenda = lerNumero(form.precoVenda);

  // Recalcula ao vivo (com uma pausa curta) usando as rotas de cálculo do back.
  useEffect(() => {
    if (!(rendimento > 0) || linhasValidas.length === 0) {
      setCalculo({ ficha: null, sugerido: null, analise: null, pctFixo: null, erro: null });
      return;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const ficha = await rotas.calc("ficha-tecnica", {
          rendimento,
          itens: linhasValidas.map((l) => ({
            ingredienteId: l.ing.id,
            nome: l.ing.nome,
            custoUnitario: l.ing.custoUnitario,
            unidadeCadastro: l.ing.unidade,
            quantidade: l.q,
            unidadeReceita: l.unidadeReceita,
          })),
        });
        let sugerido = null;
        let analise = null;
        let pctFixo = null;
        if (parametrosProntos(parametros) && custosFixos.dados) {
          const p = paramsApi(parametros);
          const cf = await rotas.calc("custos-fixos", {
            custos: custosFixos.dados.itens.map((c) => ({ nome: c.nome, valorMensal: c.valorMensal })),
            faturamentoMensal: p.faturamentoMensal,
          });
          pctFixo = cf.percentualSobreFaturamento;
          const percentuais = { custoFixo: pctFixo, despesasVariaveis: p.despesasVariaveis, lucro: p.lucro };
          sugerido = await rotas.calc("preco-sugerido", { custoUnitario: ficha.custoPorUnidade, percentuais }).catch((e) => ({ erro: e }));
          if (precoVenda > 0)
            analise = await rotas.calc("analise-preco", { precoVenda, custoUnitario: ficha.custoPorUnidade, percentuais });
        }
        if (vivo) setCalculo({ ficha, sugerido, analise, pctFixo, erro: null });
      } catch (erro) {
        if (vivo) setCalculo((c) => ({ ...c, erro }));
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [linhasValidas, rendimento, precoVenda, parametros, custosFixos.dados]);

  const custoItem = (ingredienteId) => calculo.ficha?.itens?.find((i) => i.ingredienteId === Number(ingredienteId))?.custo;

  const partes = calculo.analise
    ? partesDaAnalise(calculo.analise)
    : calculo.sugerido && !calculo.sugerido.erro
      ? partesDoSugerido(calculo.sugerido, calculo.ficha?.custoPorUnidade, calculo.pctFixo, parametros.despesasVariaveis, parametros.lucro)
      : null;

  const mudar = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mudarLinha = (chave, campo, valor) =>
    setLinhas((ls) =>
      ls.map((l) => {
        if (l.chave !== chave) return l;
        const nova = { ...l, [campo]: valor };
        if (campo === "ingredienteId") {
          const ing = porId.get(valor);
          nova.unidadeReceita = ing ? (ing.unidade === "KG" ? "G" : ing.unidade === "L" ? "ML" : ing.unidade) : "";
        }
        return nova;
      }),
    );

  const usados = new Set(linhas.map((l) => l.ingredienteId).filter(Boolean));

  async function salvar(e) {
    e.preventDefault();
    setErroSalvar(null);
    const problemas = [];
    if (!form.nome.trim()) problemas.push("Dê um nome ao salgado.");
    if (!(rendimento > 0)) problemas.push("O rendimento precisa ser maior que zero.");
    if (form.precoVenda.trim() && !(precoVenda >= 0)) problemas.push("O preço de venda está num formato inválido.");
    const incompletas = linhas.filter((l) => (l.ingredienteId || l.quantidade) && !linhasValidas.find((v) => v.chave === l.chave));
    if (incompletas.length) problemas.push("Há ingrediente sem quantidade (ou quantidade sem ingrediente) na receita.");
    if (problemas.length) {
      setErroSalvar({ message: "Confira a ficha antes de salvar", detalhes: problemas.map((m) => ({ mensagem: m })) });
      return;
    }
    const corpo = {
      nome: form.nome.trim(),
      rendimento,
      ativo: form.ativo,
      precoVenda: form.precoVenda.trim() ? Number(precoVenda.toFixed(2)) : novo ? undefined : null,
      ingredientes: linhasValidas.map((l) => ({ ingredienteId: l.ing.id, quantidade: l.q, unidadeReceita: l.unidadeReceita })),
    };
    setSalvando(true);
    try {
      const salvo = novo ? await rotas.criarProduto(corpo) : await rotas.alterarProduto(id, corpo);
      invalidarResumo();
      avisar(novo ? "Salgado cadastrado" : "Ficha técnica salva");
      if (novo) navegar(`/produtos/${salvo.id}`, { replace: true });
      else produto.recarregar();
    } catch (err) {
      setErroSalvar(err);
    } finally {
      setSalvando(false);
    }
  }

  if (!novo && produto.carregando && !produto.dados) return <Carregando texto="Abrindo a ficha…" />;
  if (!novo && produto.erro)
    return (
      <div className="pagina">
        <div className="conteiner">
          <ErroApiAlerta erro={produto.erro} />
          <p style={{ marginTop: 16 }}>
            <Link to="/produtos">Voltar para os salgados</Link>
          </p>
        </div>
      </div>
    );

  const somenteLeitura = !gestor;
  const situacao = !form.ativo
    ? "INATIVO"
    : calculo.analise?.situacao || (linhasValidas.length === 0 ? "SEM_RECEITA" : "SEM_PRECO");
  const sugerido = calculo.sugerido && !calculo.sugerido.erro ? calculo.sugerido.precoSugerido : null;

  return (
    <div className="pagina">
      <form className="conteiner" onSubmit={salvar} noValidate>
        <p style={{ marginBottom: 14 }}>
          <Link to="/produtos" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <ArrowLeft size={16} aria-hidden="true" /> Salgados
          </Link>
        </p>
        <div className="topo-pagina">
          <div>
            <h1>{novo ? "Novo salgado" : form.nome || "Ficha técnica"}</h1>
            <p>
              {somenteLeitura
                ? "Você pode consultar a receita e o preço. Só o gestor altera a ficha."
                : "Monte a receita, informe quanto ela rende e veja o preço se formar ao lado."}
            </p>
          </div>
          {!somenteLeitura && (
            <div className="acoes">
              {!novo && (
                <button
                  type="button"
                  className="botao fantasma"
                  onClick={() =>
                    confirmar({
                      titulo: `Apagar ${form.nome}?`,
                      texto: "A ficha técnica some de vez, junto com a receita. Se quiser só tirar do cardápio, desmarque “No cardápio” e salve.",
                      botao: "Apagar salgado",
                      acao: async () => {
                        await rotas.apagarProduto(id);
                        invalidarResumo();
                        avisar("Salgado apagado");
                        navegar("/produtos", { replace: true });
                      },
                    })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" /> Apagar
                </button>
              )}
              <button type="submit" className="botao" disabled={salvando}>
                {salvando ? "Salvando…" : novo ? "Cadastrar salgado" : "Salvar ficha"}
              </button>
            </div>
          )}
        </div>

        {erroSalvar && (
          <div style={{ marginBottom: 18 }}>
            <ErroApiAlerta erro={erroSalvar} />
          </div>
        )}

        <div className="duas-colunas">
          <div>
            <section className="superficie bloco">
              <div className="bloco-topo">
                <div>
                  <h2>O salgado</h2>
                </div>
              </div>
              <div className="grade-campos tres">
                <Campo rotulo="Nome">
                  <Entrada value={form.nome} onChange={mudar("nome")} maxLength={50} disabled={somenteLeitura} placeholder="Coxinha de frango" />
                </Campo>
                <Campo rotulo="A receita rende" ajuda="Quantos salgados saem dela.">
                  <Entrada sufixo="un" inputMode="decimal" value={form.rendimento} onChange={mudar("rendimento")} disabled={somenteLeitura} placeholder="40" />
                </Campo>
                <Campo rotulo="Preço de venda" ajuda="Deixe vazio para ver só o sugerido.">
                  <Entrada prefixo="R$" inputMode="decimal" value={form.precoVenda} onChange={mudar("precoVenda")} disabled={somenteLeitura} placeholder="0,00" />
                </Campo>
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  disabled={somenteLeitura}
                  style={{ width: 18, height: 18, accentColor: "var(--tijolo)" }}
                />
                No cardápio (desmarque para tirar de venda sem apagar a ficha)
              </label>
            </section>

            <section className="superficie bloco">
              <div className="bloco-topo">
                <div>
                  <h2>Receita</h2>
                  <p className="sub">Quanto de cada ingrediente vai em uma receita inteira.</p>
                </div>
                {calculo.ficha && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12.5, color: "var(--tinta-3)" }}>Custo da receita</div>
                    <strong className="num" style={{ fontSize: 20 }}>
                      {reais(calculo.ficha.custoTotalReceita)}
                    </strong>
                  </div>
                )}
              </div>

              {ingredientes.carregando && !ingredientes.dados ? (
                <Carregando texto="Buscando ingredientes…" />
              ) : (ingredientes.dados || []).length === 0 ? (
                <Alerta tipo="atencao" titulo="Ainda não há ingredientes">
                  Cadastre os ingredientes primeiro, com o preço que você paga por eles.{" "}
                  <Link to="/ingredientes">Ir para ingredientes</Link>
                </Alerta>
              ) : (
                <div className="linhas-receita">
                  {linhas.map((l, idx) => {
                    const ing = porId.get(l.ingredienteId);
                    const custo = custoItem(l.ingredienteId);
                    return (
                      <div className="linha-receita" key={l.chave}>
                        <Campo rotulo={idx === 0 ? "Ingrediente" : <span className="oculto">Ingrediente</span>}>
                          <select
                            className="entrada"
                            value={l.ingredienteId}
                            onChange={(e) => mudarLinha(l.chave, "ingredienteId", e.target.value)}
                            disabled={somenteLeitura}
                          >
                            <option value="">Escolha…</option>
                            {(ingredientes.dados || []).map((g) => (
                              <option key={g.id} value={g.id} disabled={usados.has(String(g.id)) && String(g.id) !== l.ingredienteId}>
                                {g.nome} ({reaisFino(g.custoUnitario)}/{rotuloUnidade(g.unidade)})
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo rotulo={idx === 0 ? "Quantidade" : <span className="oculto">Quantidade</span>}>
                          <Entrada
                            inputMode="decimal"
                            value={l.quantidade}
                            onChange={(e) => mudarLinha(l.chave, "quantidade", e.target.value)}
                            disabled={somenteLeitura}
                            placeholder="500"
                          />
                        </Campo>
                        <Campo rotulo={idx === 0 ? "Unidade" : <span className="oculto">Unidade</span>}>
                          <select
                            className="entrada"
                            value={l.unidadeReceita}
                            onChange={(e) => mudarLinha(l.chave, "unidadeReceita", e.target.value)}
                            disabled={somenteLeitura || !ing}
                          >
                            {!ing && <option value="">—</option>}
                            {ing &&
                              unidadesCompativeis(ing.unidade).map((u) => (
                                <option key={u} value={u}>
                                  {rotuloUnidade(u)}
                                </option>
                              ))}
                          </select>
                        </Campo>
                        <div className="custo-linha num" aria-label="Custo deste ingrediente na receita">
                          {custo !== undefined ? reais(custo) : "—"}
                        </div>
                        {!somenteLeitura ? (
                          <button
                            type="button"
                            className="botao-icone perigo"
                            aria-label="Tirar este ingrediente"
                            onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.chave !== l.chave) : [linhaVazia()]))}
                            style={{ marginBottom: 4 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    );
                  })}
                  {!somenteLeitura && (
                    <div>
                      <button type="button" className="botao fantasma pequeno" onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}>
                        <Plus size={16} aria-hidden="true" /> Adicionar ingrediente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside>
            <section className="superficie bloco" aria-live="polite">
              <div className="bloco-topo">
                <h2>O preço</h2>
                <Selo situacao={situacao} />
              </div>

              {calculo.erro && <ErroApiAlerta erro={calculo.erro} />}

              {!calculo.ficha ? (
                <p className="sub">Informe o rendimento e pelo menos um ingrediente com quantidade para calcular.</p>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>Custo de cada salgado</div>
                  <div className="resultado-grande num">{reaisFino(calculo.ficha.custoPorUnidade)}</div>

                  {!parametrosProntos(parametros) ? (
                    <div style={{ marginTop: 16 }}>
                      <Alerta tipo="atencao" titulo="Falta o faturamento do mês">
                        Para sugerir um preço, o sistema precisa saber quanto a loja fatura.{" "}
                        <button type="button" className="botao pequeno" onClick={() => setParametrosAbertos(true)}>
                          Informar
                        </button>
                      </Alerta>
                    </div>
                  ) : (
                    <>
                      <div style={{ margin: "22px 0 6px" }}>
                        <FileiraTijolos
                          partes={partes}
                          grande
                          rotuloPreco={partes ? (calculo.analise ? "preço de venda" : "preço sugerido") : undefined}
                        />
                      </div>
                      {calculo.analise?.mensagem && <p className="sub" style={{ marginTop: 10 }}>{calculo.analise.mensagem}</p>}
                      {calculo.sugerido?.erro && <ErroApiAlerta erro={calculo.sugerido.erro} />}
                      <dl className="lista-valores num">
                        <div>
                          <dt>Preço sugerido</dt>
                          <dd>{sugerido ? reais(sugerido) : "—"}</dd>
                        </div>
                        {calculo.analise && (
                          <>
                            <div>
                              <dt>Preço de venda</dt>
                              <dd>{reais(calculo.analise.precoVenda)}</dd>
                            </div>
                            <div>
                              <dt>Margem de contribuição</dt>
                              <dd>
                                {reais(calculo.analise.margemContribuicao)} ({pct(calculo.analise.margemContribuicaoPercentual)})
                              </dd>
                            </div>
                            <div className={Number(calculo.analise.lucroUnitario) < 0 ? "ruim" : "bom"}>
                              <dt>Lucro por salgado</dt>
                              <dd>
                                {reais(calculo.analise.lucroUnitario)} ({pct(calculo.analise.margemLucroPercentual)})
                              </dd>
                            </div>
                            <div>
                              <dt>CMV (custo ÷ preço)</dt>
                              <dd>{pct(calculo.analise.cmvPercentual)}</dd>
                            </div>
                          </>
                        )}
                        <div>
                          <dt>Custo fixo sobre o faturamento</dt>
                          <dd>{pct(calculo.pctFixo)}</dd>
                        </div>
                      </dl>
                      {!somenteLeitura && sugerido && Number(sugerido) !== precoVenda && (
                        <button
                          type="button"
                          className="botao secundario pequeno"
                          style={{ marginTop: 14 }}
                          onClick={() => setForm((f) => ({ ...f, precoVenda: paraTexto(Number(sugerido).toFixed(2)) }))}
                        >
                          Usar o preço sugerido ({reais(sugerido)})
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
            <p className="sub" style={{ fontSize: 13, color: "var(--tinta-3)", marginTop: 12 }}>
              Os números mudam enquanto você edita. A ficha só é gravada quando você salva.{" "}
              <button
                type="button"
                onClick={() => setParametrosAbertos(true)}
                style={{ all: "unset", cursor: "pointer", color: "var(--tijolo)", textDecoration: "underline" }}
              >
                Dados do mês
              </button>
            </p>
          </aside>
        </div>
      </form>
      {elementoConfirmar}
      <GavetaParametros aberta={parametrosAbertos} aoFechar={() => setParametrosAbertos(false)} />
    </div>
  );
}
