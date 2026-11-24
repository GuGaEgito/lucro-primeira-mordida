import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { rotas } from "../api/cliente";
import { FileiraTijolos, partesDaAnalise, partesDoSugerido } from "../componentes/FileiraTijolos";
import { CALCULOS } from "../componentes/Layout";
import { GavetaParametros } from "../componentes/Salgados";
import { Alerta, Campo, Entrada, ErroApiAlerta, Selo, useCarregar } from "../componentes/ui";
import { lerNumero, numero, pct, reais, reaisFino } from "../util/formato";
import { parametrosProntos, useParametros } from "../util/parametros";
import { paramsApi, useResumo } from "../util/resumo";

const ABAS = CALCULOS.flatMap((g) => g.itens).filter((c) => !c.rota);

// Calcula ao digitar, com uma pausa curta, e guarda o último resultado e erro.
function useCalculo(nome, corpo, pronto) {
  const [estado, setEstado] = useState({ resultado: null, erro: null });
  const chave = JSON.stringify(corpo);
  useEffect(() => {
    if (!pronto) {
      setEstado({ resultado: null, erro: null });
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      rotas
        .calc(nome, corpo)
        .then((resultado) => vivo && setEstado({ resultado, erro: null }))
        .catch((erro) => vivo && setEstado({ resultado: null, erro }));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, chave, pronto]);
  return estado;
}

// % de custo fixo = custos fixos do mês ÷ faturamento.
function usePctFixo(parametros, custos) {
  const [valor, setValor] = useState(null);
  useEffect(() => {
    if (!custos || !parametrosProntos(parametros)) return setValor(null);
    rotas
      .calc("custos-fixos", {
        custos: custos.itens.map((c) => ({ nome: c.nome, valorMensal: c.valorMensal })),
        faturamentoMensal: paramsApi(parametros).faturamentoMensal,
      })
      .then((r) => setValor(r.percentualSobreFaturamento))
      .catch(() => setValor(null));
  }, [parametros, custos]);
  return valor;
}

const texto = (v) => (v === null || v === undefined || v === "" ? "" : String(v).replace(".", ","));
const ok = (...vs) => vs.every((v) => Number.isFinite(lerNumero(v)));

function Percentuais({ valores, setValores, comLucro = true, rotuloLucro = "Lucro desejado" }) {
  const m = (k) => (e) => setValores((v) => ({ ...v, [k]: e.target.value }));
  return (
    <div className={`grade-campos ${comLucro ? "tres" : "duas"}`}>
      <Campo rotulo="Custo fixo">
        <Entrada sufixo="%" inputMode="decimal" value={valores.custoFixo} onChange={m("custoFixo")} />
      </Campo>
      <Campo rotulo="Despesas variáveis">
        <Entrada sufixo="%" inputMode="decimal" value={valores.despesasVariaveis} onChange={m("despesasVariaveis")} />
      </Campo>
      {comLucro && (
        <Campo rotulo={rotuloLucro}>
          <Entrada sufixo="%" inputMode="decimal" value={valores.lucro} onChange={m("lucro")} />
        </Campo>
      )}
    </div>
  );
}

function EscolherProduto({ itens, valor, aoEscolher, rotulo = "Puxar de um salgado" }) {
  const comCusto = itens.filter((i) => i.precificacao?.fichaTecnica);
  if (comCusto.length === 0) return null;
  return (
    <Campo rotulo={rotulo} ajuda="Preenche o custo (e o preço, se houver) com os dados da ficha.">
      <select className="entrada" value={valor || ""} onChange={(e) => aoEscolher(itens.find((i) => String(i.produto.id) === e.target.value))}>
        <option value="">Digitar os valores à mão</option>
        {comCusto.map((i) => (
          <option key={i.produto.id} value={i.produto.id}>
            {i.produto.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

const pctsApi = (v) => ({
  custoFixo: lerNumero(v.custoFixo),
  despesasVariaveis: lerNumero(v.despesasVariaveis),
  lucro: lerNumero(v.lucro),
});

// ---------- Preço sugerido ----------

function PrecoSugerido({ base, itens }) {
  const [produtoId, setProdutoId] = useState("");
  const [custo, setCusto] = useState("");
  const [p, setP] = useState(base);
  useEffect(() => setP(base), [base]);
  const pronto = ok(custo, p.custoFixo, p.despesasVariaveis, p.lucro);
  const { resultado, erro } = useCalculo("preco-sugerido", { custoUnitario: lerNumero(custo), percentuais: pctsApi(p) }, pronto);
  const partes = resultado ? partesDoSugerido(resultado, custo && lerNumero(custo), p.custoFixo && lerNumero(p.custoFixo), lerNumero(p.despesasVariaveis), lerNumero(p.lucro)) : null;

  return (
    <div className="calc-layout">
      <section className="superficie bloco grade-campos">
        <div>
          <h2>Preço sugerido</h2>
          <p className="sub">Do custo de um salgado e das metas, o preço que cobre tudo e deixa o lucro desejado.</p>
        </div>
        <EscolherProduto
          itens={itens}
          valor={produtoId}
          aoEscolher={(i) => {
            setProdutoId(i ? String(i.produto.id) : "");
            if (i) setCusto(texto(i.precificacao.fichaTecnica.custoPorUnidade));
          }}
        />
        <Campo rotulo="Custo de um salgado">
          <Entrada prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,6025" />
        </Campo>
        <Percentuais valores={p} setValores={setP} />
      </section>
      <section className="superficie bloco" aria-live="polite">
        <h2>Resultado</h2>
        <ErroApiAlerta erro={erro} />
        {!resultado ? (
          <p className="sub">Preencha o custo e os percentuais.</p>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--tinta-3)", marginTop: 12 }}>Preço sugerido</div>
            <div className="resultado-grande num">{reais(resultado.precoSugerido)}</div>
            <div style={{ margin: "20px 0 4px" }}>
              <FileiraTijolos partes={partes} grande />
            </div>
            <dl className="lista-valores num">
              <div>
                <dt>Markup divisor</dt>
                <dd>{numero(resultado.divisor)}</dd>
              </div>
              <div>
                <dt>Markup multiplicador</dt>
                <dd>{numero(resultado.multiplicador)}×</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

// ---------- Conferir um preço ----------

function AnalisePreco({ base, itens, produtoInicial }) {
  const [produtoId, setProdutoId] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [p, setP] = useState(base);
  useEffect(() => setP(base), [base]);

  const escolher = (i) => {
    setProdutoId(i ? String(i.produto.id) : "");
    if (!i) return;
    setCusto(texto(i.precificacao.fichaTecnica.custoPorUnidade));
    if (i.produto.precoVenda) setPreco(texto(Number(i.produto.precoVenda).toFixed(2)));
  };

  useEffect(() => {
    if (!produtoInicial || produtoId) return;
    const i = itens.find((x) => String(x.produto.id) === String(produtoInicial));
    if (i?.precificacao) escolher(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoInicial, itens]);

  const pronto = ok(preco, custo, p.custoFixo, p.despesasVariaveis);
  const corpo = {
    precoVenda: lerNumero(preco),
    custoUnitario: lerNumero(custo),
    percentuais: { custoFixo: lerNumero(p.custoFixo), despesasVariaveis: lerNumero(p.despesasVariaveis), ...(ok(p.lucro) && { lucro: lerNumero(p.lucro) }) },
  };
  const { resultado, erro } = useCalculo("analise-preco", corpo, pronto);

  return (
    <div className="calc-layout">
      <section className="superficie bloco grade-campos">
        <div>
          <h2>Conferir um preço</h2>
          <p className="sub">Escolheu um preço diferente do sugerido? Veja quanto ele deixa de margem e de lucro.</p>
        </div>
        <EscolherProduto itens={itens} valor={produtoId} aoEscolher={escolher} />
        <div className="grade-campos duas">
          <Campo rotulo="Preço de venda">
            <Entrada prefixo="R$" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="1,10" />
          </Campo>
          <Campo rotulo="Custo de um salgado">
            <Entrada prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,6025" />
          </Campo>
        </div>
        <Percentuais valores={p} setValores={setP} rotuloLucro="Meta de lucro" />
      </section>
      <section className="superficie bloco" aria-live="polite">
        <div className="bloco-topo">
          <h2>Resultado</h2>
          {resultado && <Selo situacao={resultado.situacao} />}
        </div>
        <ErroApiAlerta erro={erro} />
        {!resultado ? (
          <p className="sub">Preencha o preço, o custo e os percentuais.</p>
        ) : (
          <>
            <FileiraTijolos partes={partesDaAnalise(resultado)} grande />
            <p className="sub" style={{ marginTop: 12 }}>
              {resultado.mensagem}
            </p>
            <dl className="lista-valores num">
              <div>
                <dt>Despesas variáveis</dt>
                <dd>{reais(resultado.despesasVariaveis)}</dd>
              </div>
              <div>
                <dt>Custo fixo rateado</dt>
                <dd>{reais(resultado.custoFixoRateado)}</dd>
              </div>
              <div>
                <dt>Margem de contribuição</dt>
                <dd>
                  {reais(resultado.margemContribuicao)} ({pct(resultado.margemContribuicaoPercentual)})
                </dd>
              </div>
              <div className={Number(resultado.lucroUnitario) < 0 ? "ruim" : "bom"}>
                <dt>Lucro por salgado</dt>
                <dd>
                  {reais(resultado.lucroUnitario)} ({pct(resultado.margemLucroPercentual)})
                </dd>
              </div>
              <div>
                <dt>CMV (custo ÷ preço)</dt>
                <dd>{pct(resultado.cmvPercentual)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

// ---------- Markup ----------

function Markup({ base }) {
  const [p, setP] = useState(base);
  useEffect(() => setP(base), [base]);
  const pronto = ok(p.custoFixo, p.despesasVariaveis, p.lucro);
  const { resultado, erro } = useCalculo("markup", pctsApi(p), pronto);
  const soma = ["custoFixo", "despesasVariaveis", "lucro"].reduce((s, k) => s + (lerNumero(p[k]) || 0), 0);
  return (
    <div className="calc-layout">
      <section className="superficie bloco grade-campos">
        <div>
          <h2>Markup</h2>
          <p className="sub">O número que transforma custo em preço. Divida o custo pelo divisor, ou multiplique pelo multiplicador.</p>
        </div>
        <Percentuais valores={p} setValores={setP} />
      </section>
      <section className="superficie bloco" aria-live="polite">
        <h2>Resultado</h2>
        <ErroApiAlerta erro={erro} />
        {resultado && (
          <>
            <dl className="lista-valores num" style={{ marginTop: 14 }}>
              <div>
                <dt>Soma dos percentuais</dt>
                <dd>{pct(soma)}</dd>
              </div>
              <div className="total">
                <dt>Markup divisor</dt>
                <dd>{numero(resultado.divisor)}</dd>
              </div>
              <div className="total">
                <dt>Markup multiplicador</dt>
                <dd>{numero(resultado.multiplicador)}×</dd>
              </div>
            </dl>
            <p className="formula">
              Um salgado que custa <b>R$ 1,00</b> sai por <b>{reais(1 / Number(resultado.divisor))}</b>.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ---------- Resultado do mês e ponto de equilíbrio (mesmo formulário) ----------

function VendasDoMes({ foco, itens, custos, parametros }) {
  const [fixos, setFixos] = useState("");
  const [despesas, setDespesas] = useState(texto(parametros.despesasVariaveis));
  const [linhas, setLinhas] = useState([]);

  useEffect(() => {
    if (custos && fixos === "") setFixos(texto(custos.totalMensal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custos]);

  useEffect(() => {
    // Preenche uma vez só, quando os salgados chegam (e não apaga o que já foi digitado).
    if (linhas.some((l) => l.nome || l.preco || l.qtd)) return;
    const doCardapio = itens.filter((i) => i.produto.ativo && i.produto.precoVenda && i.precificacao?.fichaTecnica);
    setLinhas(
      doCardapio.length
        ? doCardapio.map((i) => ({
            chave: String(i.produto.id),
            nome: i.produto.nome,
            preco: texto(Number(i.produto.precoVenda).toFixed(2)),
            custo: texto(i.precificacao.fichaTecnica.custoPorUnidade),
            qtd: "",
          }))
        : [{ chave: "1", nome: "", preco: "", custo: "", qtd: "" }],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens]);

  const validas = linhas.filter((l) => l.nome.trim() && ok(l.preco, l.custo, l.qtd));
  const corpo = {
    custosFixosMensais: lerNumero(fixos),
    percentualDespesasVariaveis: lerNumero(despesas),
    itens: validas.map((l) => ({ nome: l.nome.trim(), precoVenda: lerNumero(l.preco), custoUnitario: lerNumero(l.custo), quantidadeVendida: lerNumero(l.qtd) })),
  };
  const pronto = ok(fixos, despesas) && validas.length > 0;
  const mes = useCalculo("simulacoes/resultado-mensal", corpo, pronto);
  const eq = useCalculo("ponto-equilibrio/mix", corpo, pronto);
  const mudar = (chave, k, v) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [k]: v } : l)));

  const r = mes.resultado;
  const lucro = r ? Number(r.lucro) : 0;

  const blocoMes = (
    <section className="superficie bloco" aria-live="polite" key="mes">
      <div className="bloco-topo">
        <h2>Resultado do mês</h2>
        {r && <Selo situacao={lucro < 0 ? "PREJUIZO" : lucro === 0 ? "ABAIXO_DA_META" : "RENTAVEL"} />}
      </div>
      <ErroApiAlerta erro={mes.erro} />
      {!r ? (
        <p className="sub">Informe quantos de cada salgado você vende no mês.</p>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>{lucro < 0 ? "Prejuízo no mês" : "Lucro no mês"}</div>
          <div className="resultado-grande num" style={{ color: lucro < 0 ? "var(--prejuizo)" : "var(--azulejo)" }}>
            {reais(r.lucro)}
          </div>
          <dl className="lista-valores num">
            <div>
              <dt>Receita</dt>
              <dd>{reais(r.receita)}</dd>
            </div>
            <div>
              <dt>Custo dos salgados</dt>
              <dd>{reais(r.custoProdutos)}</dd>
            </div>
            <div>
              <dt>Despesas variáveis</dt>
              <dd>{reais(r.despesasVariaveis)}</dd>
            </div>
            <div>
              <dt>Margem de contribuição</dt>
              <dd>{reais(r.margemContribuicao)}</dd>
            </div>
            <div>
              <dt>Custos fixos</dt>
              <dd>{reais(r.custosFixos)}</dd>
            </div>
            <div className={lucro < 0 ? "ruim total" : "bom total"}>
              <dt>Margem de lucro</dt>
              <dd>{pct(r.margemLucroPercentual)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );

  const e = eq.resultado;
  const blocoEq = (
    <section className="superficie bloco" aria-live="polite" key="eq">
      <h2>Ponto de equilíbrio</h2>
      <p className="sub">Quanto vender no mês para não ter nem lucro nem prejuízo, mantendo a mesma proporção entre os salgados.</p>
      <ErroApiAlerta erro={eq.erro} />
      {e && (
        <>
          <div style={{ display: "flex", gap: 28, marginTop: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>Salgados no mês</div>
              <div className="resultado-grande num">{numero(e.quantidadeTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>Faturamento mínimo</div>
              <div className="resultado-grande num">{reais(e.receita)}</div>
            </div>
          </div>
          <dl className="lista-valores num">
            {e.porProduto.map((x) => (
              <div key={x.nome}>
                <dt>{x.nome}</dt>
                <dd>{numero(x.quantidade)} un</dd>
              </div>
            ))}
            <div>
              <dt>Margem média por salgado</dt>
              <dd>{reais(e.margemContribuicaoMedia)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );

  return (
    <div className="calc-layout">
      <section className="superficie bloco grade-campos">
        <div>
          <h2>Vendas do mês</h2>
          <p className="sub">Já vem preenchido com os salgados do cardápio que têm preço. Ajuste as quantidades vendidas.</p>
        </div>
        <div className="grade-campos duas">
          <Campo rotulo="Custos fixos do mês">
            <Entrada prefixo="R$" inputMode="decimal" value={fixos} onChange={(ev) => setFixos(ev.target.value)} />
          </Campo>
          <Campo rotulo="Despesas variáveis">
            <Entrada sufixo="%" inputMode="decimal" value={despesas} onChange={(ev) => setDespesas(ev.target.value)} />
          </Campo>
        </div>
        <div className="itens-mix">
          <div className="item-mix cabeca-mix">
            <span>Salgado</span>
            <span>Preço</span>
            <span>Custo</span>
            <span>Vendidos</span>
            <span />
          </div>
          {linhas.map((l) => (
            <div className="item-mix" key={l.chave}>
              <input className="entrada" aria-label="Salgado" value={l.nome} onChange={(ev) => mudar(l.chave, "nome", ev.target.value)} placeholder="Coxinha" />
              <input className="entrada num" aria-label={`Preço de ${l.nome}`} inputMode="decimal" value={l.preco} onChange={(ev) => mudar(l.chave, "preco", ev.target.value)} placeholder="5,00" />
              <input className="entrada num" aria-label={`Custo de ${l.nome}`} inputMode="decimal" value={l.custo} onChange={(ev) => mudar(l.chave, "custo", ev.target.value)} placeholder="1,50" />
              <input className="entrada num" aria-label={`Quantidade vendida de ${l.nome}`} inputMode="numeric" value={l.qtd} onChange={(ev) => mudar(l.chave, "qtd", ev.target.value)} placeholder="300" />
              <button
                type="button"
                className="botao-icone perigo"
                aria-label={`Tirar ${l.nome || "linha"}`}
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                disabled={linhas.length === 1}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="botao fantasma pequeno"
              onClick={() => setLinhas((ls) => [...ls, { chave: Math.random().toString(36).slice(2), nome: "", preco: "", custo: "", qtd: "" }])}
            >
              <Plus size={16} aria-hidden="true" /> Adicionar salgado
            </button>
          </div>
        </div>
      </section>
      <div style={{ display: "grid", gap: 20 }}>{foco === "equilibrio" ? [blocoEq, blocoMes] : [blocoMes, blocoEq]}</div>
    </div>
  );
}

// ---------- Reajuste de ingredientes ----------

function Reajuste({ itens, base }) {
  const comReceita = itens.filter((i) => i.produto.ingredientes.length > 0);
  const [produtoId, setProdutoId] = useState("");
  const [reajustes, setReajustes] = useState({});
  const [p, setP] = useState(base);
  useEffect(() => setP(base), [base]);
  const item = comReceita.find((i) => String(i.produto.id) === produtoId);

  useEffect(() => {
    if (!produtoId && comReceita[0]) setProdutoId(String(comReceita[0].produto.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comReceita.length]);

  const lista = Object.entries(reajustes)
    .filter(([, v]) => ok(v) && lerNumero(v) !== 0)
    .map(([id, v]) => ({ ingredienteId: Number(id), percentual: lerNumero(v) }));
  const pcts = ok(p.custoFixo, p.despesasVariaveis, p.lucro) ? pctsApi(p) : undefined;
  const corpo = item && {
    ficha: {
      rendimento: Number(item.produto.rendimento),
      itens: item.produto.ingredientes.map((x) => ({
        ingredienteId: x.ingrediente.id,
        nome: x.ingrediente.nome,
        custoUnitario: x.ingrediente.custoUnitario,
        unidadeCadastro: x.ingrediente.unidade,
        quantidade: x.quantidade,
        unidadeReceita: x.unidadeReceita,
      })),
    },
    reajustes: lista,
    ...(pcts && { percentuais: pcts }),
  };
  const { resultado, erro } = useCalculo("simulacoes/reajuste", corpo, Boolean(item) && lista.length > 0);

  // As duas fileiras na mesma escala, para comparar antes e depois.
  const fileiras = useMemo(() => {
    if (!resultado?.precoSugeridoAntes || !pcts) return null;
    const mk = (preco, custo) => ({
      preco: Number(preco),
      ingredientes: Number(custo),
      fixo: (Number(preco) * pcts.custoFixo) / 100,
      despesas: (Number(preco) * pcts.despesasVariaveis) / 100,
      lucro: (Number(preco) * pcts.lucro) / 100,
    });
    return { antes: mk(resultado.precoSugeridoAntes, resultado.custoPorUnidadeAntes), depois: mk(resultado.precoSugeridoDepois, resultado.custoPorUnidadeDepois) };
  }, [resultado, pcts]);
  const maior = fileiras ? Math.max(fileiras.antes.preco, fileiras.depois.preco) : 1;

  if (comReceita.length === 0)
    return (
      <Alerta tipo="atencao" titulo="Nenhum salgado com receita">
        Monte a receita de pelo menos um salgado para simular reajustes. <Link to="/produtos">Ir para os salgados</Link>
      </Alerta>
    );

  return (
    <div className="calc-layout">
      <section className="superficie bloco grade-campos">
        <div>
          <h2>Reajuste de ingredientes</h2>
          <p className="sub">E se a farinha subir 10%? Informe o reajuste de cada ingrediente (use negativo se baixou).</p>
        </div>
        <Campo rotulo="Salgado">
          <select
            className="entrada"
            value={produtoId}
            onChange={(e) => {
              setProdutoId(e.target.value);
              setReajustes({});
            }}
          >
            {comReceita.map((i) => (
              <option key={i.produto.id} value={i.produto.id}>
                {i.produto.nome}
              </option>
            ))}
          </select>
        </Campo>
        {item && (
          <div className="grade-campos duas">
            {item.produto.ingredientes.map((x) => (
              <Campo key={x.ingrediente.id} rotulo={x.ingrediente.nome} ajuda={`Hoje: ${reaisFino(x.ingrediente.custoUnitario)}`}>
                <Entrada
                  sufixo="%"
                  inputMode="decimal"
                  value={reajustes[x.ingrediente.id] || ""}
                  onChange={(e) => setReajustes((r) => ({ ...r, [x.ingrediente.id]: e.target.value }))}
                  placeholder="0"
                />
              </Campo>
            ))}
          </div>
        )}
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Percentuais para o preço sugerido</summary>
          <div style={{ marginTop: 12 }}>
            <Percentuais valores={p} setValores={setP} />
          </div>
        </details>
      </section>
      <section className="superficie bloco" aria-live="polite">
        <h2>Efeito no custo</h2>
        <ErroApiAlerta erro={erro} />
        {!resultado ? (
          <p className="sub">Informe o reajuste de pelo menos um ingrediente.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 28, marginTop: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>Custo por salgado</div>
                <div className="resultado-grande num">{reaisFino(resultado.custoPorUnidadeDepois)}</div>
                <div className="num" style={{ fontSize: 13.5, color: "var(--tinta-2)" }}>
                  era {reaisFino(resultado.custoPorUnidadeAntes)} ({Number(resultado.variacaoPercentual) > 0 ? "+" : ""}
                  {pct(resultado.variacaoPercentual)})
                </div>
              </div>
              {resultado.precoSugeridoDepois && (
                <div>
                  <div style={{ fontSize: 13, color: "var(--tinta-3)" }}>Preço sugerido</div>
                  <div className="resultado-grande num">{reais(resultado.precoSugeridoDepois)}</div>
                  <div className="num" style={{ fontSize: 13.5, color: "var(--tinta-2)" }}>
                    era {reais(resultado.precoSugeridoAntes)}
                  </div>
                </div>
              )}
            </div>
            {fileiras && (
              <div style={{ display: "grid", gap: 18, marginTop: 22 }}>
                <div>
                  <div style={{ fontSize: 13, color: "var(--tinta-2)", marginBottom: 6 }}>Antes</div>
                  <div style={{ width: `${(fileiras.antes.preco / maior) * 100}%` }}>
                    <FileiraTijolos partes={fileiras.antes} legenda={false} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--tinta-2)", marginBottom: 6 }}>Depois do reajuste</div>
                  <div style={{ width: `${(fileiras.depois.preco / maior) * 100}%` }}>
                    <FileiraTijolos partes={fileiras.depois} legenda={false} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ---------- Página ----------

export function Calculos() {
  const [busca, setBusca] = useSearchParams();
  const atual = ABAS.find((a) => a.id === busca.get("c"))?.id || "preco";
  const [parametros] = useParametros();
  const [parametrosAbertos, setParametrosAbertos] = useState(false);
  const { dados } = useResumo();
  const custos = useCarregar(() => rotas.custosFixos(), []);
  const pctFixo = usePctFixo(parametros, custos.dados);
  const itens = dados?.itens || [];

  const base = useMemo(
    () => ({
      custoFixo: texto(pctFixo ?? ""),
      despesasVariaveis: texto(parametros.despesasVariaveis),
      lucro: texto(parametros.lucro),
    }),
    [pctFixo, parametros],
  );

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              <b>Cálculos</b> da casa
            </h1>
            <p>Simule sem medo: nada aqui é gravado. Os percentuais já vêm com os dados do mês.</p>
          </div>
          <button type="button" className="botao fantasma" onClick={() => setParametrosAbertos(true)}>
            Dados do mês
          </button>
        </div>
        <div className="abas" role="tablist" aria-label="Tipo de cálculo" style={{ marginBottom: 22 }}>
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={atual === a.id} onClick={() => setBusca({ c: a.id })}>
              {a.nome}
            </button>
          ))}
        </div>

        {!parametrosProntos(parametros) && ["preco", "analise", "reajuste"].includes(atual) && (
          <div style={{ marginBottom: 18 }}>
            <Alerta tipo="atencao">
              Sem o faturamento do mês, o custo fixo % fica em branco. Preencha à mão ou{" "}
              <button
                type="button"
                onClick={() => setParametrosAbertos(true)}
                style={{ all: "unset", cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
              >
                informe o faturamento
              </button>
              .
            </Alerta>
          </div>
        )}

        {atual === "preco" && <PrecoSugerido base={base} itens={itens} />}
        {atual === "analise" && <AnalisePreco base={base} itens={itens} produtoInicial={busca.get("produto")} />}
        {atual === "markup" && <Markup base={base} />}
        {(atual === "mes" || atual === "equilibrio") && (
          <VendasDoMes key="vendas" foco={atual} itens={itens} custos={custos.dados} parametros={parametros} />
        )}
        {atual === "reajuste" && <Reajuste itens={itens} base={base} />}
      </div>
      <GavetaParametros aberta={parametrosAbertos} aoFechar={() => setParametrosAbertos(false)} />
    </div>
  );
}
