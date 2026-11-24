import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calculator, ClipboardList, Package, Percent, Scale, TrendingUp } from "lucide-react";
import { useAutenticacao } from "../auth/Autenticacao";
import { rotas } from "../api/cliente";
import { FileiraTijolos, partesDaPrecificacao } from "../componentes/FileiraTijolos";
import { CardSalgado, Faixa, FormParametros, GavetaParametros } from "../componentes/Salgados";
import { Carregando, ErroApiAlerta, Selo, useCarregar } from "../componentes/ui";
import { data, numero, reais, reaisFino, rotuloUnidade } from "../util/formato";
import { contar, useResumo } from "../util/resumo";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Ordem de atenção: prejuízo, abaixo da meta, sem preço, lucro.
const PESO = { PREJUIZO: 0, ABAIXO_DA_META: 1, SEM_PRECO: 2, CONFIGURAR: 3, SEM_RECEITA: 4, ERRO: 5, RENTAVEL: 6 };

function margem(item) {
  return Number(item.precificacao?.analisePrecoAtual?.margemLucroPercentual ?? 999);
}

export function Painel() {
  const { usuario, gestor } = useAutenticacao();
  const [busca, setBusca] = useSearchParams();
  const { dados, erro, carregando, parametros } = useResumo();
  const ingredientes = useCarregar(() => rotas.ingredientes(), []);

  const itens = useMemo(
    () =>
      (dados?.itens || [])
        .filter((i) => i.produto.ativo)
        .sort((a, b) => PESO[a.situacao] - PESO[b.situacao] || margem(a) - margem(b)),
    [dados],
  );
  const c = contar(dados?.itens);
  const foco = itens[0];
  const partesFoco = foco ? partesDaPrecificacao(foco.precificacao, parametros) : null;

  const abrirParametros = busca.get("parametros") === "1";
  const fecharParametros = () => setBusca({}, { replace: true });

  const recentes = useMemo(
    () =>
      [...(ingredientes.dados || [])]
        .sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm))
        .slice(0, 6),
    [ingredientes.dados],
  );

  const resumoTexto = !dados
    ? null
    : c.ativos === 0
      ? "Ainda não há salgados no cardápio. Comece cadastrando os ingredientes e a primeira receita."
      : !dados.prontos
        ? "Falta só um dado para calcular os preços: quanto a loja fatura por mês."
        : c.prejuizo > 0
          ? `${c.prejuizo} de ${c.ativos} salgados não cobrem o próprio custo com o preço de hoje.`
          : `${c.lucro} de ${c.ativos} salgados dão lucro com o preço cadastrado.`;

  return (
    <>
      <section className="abertura">
        <div className="conteiner">
          <div>
            <h1>
              {saudacao()}, {usuario?.nome}.<span>Vamos ao preço de hoje.</span>
            </h1>
            {resumoTexto && <p className="resumo">{resumoTexto}</p>}
            <div className="acoes">
              {gestor ? (
                <Link to="/produtos/novo" className="botao">
                  Nova ficha técnica
                </Link>
              ) : (
                <Link to="/calculos?c=preco" className="botao">
                  Calcular um preço
                </Link>
              )}
              <Link to="/produtos" className="botao secundario">
                Ver os salgados
              </Link>
              <button type="button" className="botao fantasma" onClick={() => setBusca({ parametros: "1" })}>
                Dados do mês
              </button>
            </div>
            {dados?.prontos && c.ativos > 0 && (
              <dl className="contagem num">
                <div>
                  <dt>Dão lucro</dt>
                  <dd className="bom">{c.lucro}</dd>
                </div>
                <div>
                  <dt>Abaixo da meta</dt>
                  <dd>{c.abaixo}</dd>
                </div>
                <div>
                  <dt>No prejuízo</dt>
                  <dd className={c.prejuizo ? "ruim" : ""}>{c.prejuizo}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="vitrine">
            {carregando && !dados ? (
              <Carregando texto="Montando a vitrine…" />
            ) : erro ? (
              <ErroApiAlerta erro={erro} />
            ) : !dados.prontos ? (
              <>
                <h2 style={{ fontSize: 28 }}>Dados do mês</h2>
                <p className="mensagem" style={{ marginBottom: 18 }}>
                  Com o faturamento, o sistema calcula quanto do custo fixo cai em cada salgado.
                </p>
                <FormParametros />
              </>
            ) : !foco ? (
              <>
                <h2 style={{ fontSize: 28 }}>A vitrine está vazia</h2>
                <p className="mensagem">Cadastre um salgado com a receita para ver a fileira de tijolos do preço.</p>
                {gestor && (
                  <div className="rodape-vitrine">
                    <Link to="/produtos/novo" className="botao">
                      Cadastrar o primeiro salgado
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rotulo-vitrine">
                  <span style={{ fontSize: 13, color: "var(--tinta-3)" }}>
                    {foco.situacao === "RENTAVEL" ? "Salgado com a menor margem" : "Precisa de atenção"}
                  </span>
                  <Selo situacao={foco.situacao} />
                </div>
                <h2>{foco.produto.nome}</h2>
                <dl className="valores num">
                  <div>
                    <dt>Custo por unidade</dt>
                    <dd>{reaisFino(foco.precificacao?.fichaTecnica?.custoPorUnidade)}</dd>
                  </div>
                  <div>
                    <dt>Preço de hoje</dt>
                    <dd>{foco.produto.precoVenda ? reais(foco.produto.precoVenda) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Preço sugerido</dt>
                    <dd>{reais(foco.precificacao?.precoSugerido?.precoSugerido)}</dd>
                  </div>
                </dl>
                <FileiraTijolos partes={partesFoco} grande />
                <p className="mensagem">
                  {foco.precificacao?.analisePrecoAtual?.mensagem ||
                    "Ainda sem preço de venda: a fileira mostra o preço sugerido."}
                </p>
                <div className="rodape-vitrine">
                  <Link to={`/produtos/${foco.produto.id}`} className="botao pequeno">
                    Abrir a ficha
                  </Link>
                  <Link to={`/calculos?c=analise&produto=${foco.produto.id}`} className="botao pequeno secundario">
                    Testar outro preço
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="atalhos" aria-labelledby="titulo-atalhos">
        <div className="conteiner">
          <h2 id="titulo-atalhos">Atalhos da casa</h2>
          <p>O que mais se faz por aqui, a um clique.</p>
          <ul>
            <li>
              <Link to={gestor ? "/produtos/novo" : "/produtos"}>
                <span className="circulo">
                  <ClipboardList size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                {gestor ? "Nova ficha técnica" : "Fichas técnicas"}
              </Link>
            </li>
            <li>
              <Link to="/ingredientes">
                <span className="circulo">
                  <Package size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                Ingredientes
              </Link>
            </li>
            <li>
              <Link to="/calculos?c=preco">
                <span className="circulo">
                  <Calculator size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                Preço sugerido
              </Link>
            </li>
            <li>
              <Link to="/calculos?c=mes">
                <span className="circulo">
                  <TrendingUp size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                Resultado do mês
              </Link>
            </li>
            <li>
              <Link to="/calculos?c=equilibrio">
                <span className="circulo">
                  <Scale size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                Ponto de equilíbrio
              </Link>
            </li>
            <li>
              <Link to="/calculos?c=reajuste">
                <span className="circulo">
                  <Percent size={34} strokeWidth={1.6} aria-hidden="true" />
                </span>
                Reajuste
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {itens.length > 0 && (
        <Faixa
          titulo="Os salgados"
          destaque="da vitrine"
          texto="Do que precisa de atenção para o que já dá lucro. Cada fileira está na mesma escala do próprio preço."
          acao={
            <Link to="/produtos" className="botao fantasma pequeno">
              Ver todos
            </Link>
          }
        >
          {itens.map((i) => (
            <CardSalgado key={i.produto.id} item={i} parametros={parametros} />
          ))}
        </Faixa>
      )}

      {recentes.length > 0 && (
        <section className="faixa" aria-labelledby="titulo-mudancas">
          <div className="conteiner">
            <div className="faixa-topo">
              <div>
                <h2 id="titulo-mudancas">
                  Ingredientes<span>mexidos por último</span>
                </h2>
                <p>Quando o custo de um ingrediente muda, o preço de todo salgado que usa ele muda junto.</p>
              </div>
              <Link to="/ingredientes" className="botao fantasma pequeno">
                Ver ingredientes
              </Link>
            </div>
            <ul className="mudancas num">
              {recentes.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.nome}</strong>
                    <span>Atualizado em {data(g.atualizadoEm)}</span>
                  </div>
                  <div className="valor">
                    {reaisFino(g.custoUnitario)}
                    <span style={{ display: "block" }}>por {rotuloUnidade(g.unidade)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="padrao" aria-labelledby="titulo-padrao">
        <div className="conteiner padrao-topo">
          <div>
            <h2 id="titulo-padrao">
              O padrão<span>da Casa</span>
            </h2>
            <div className="formula">
              <b>Preço</b> = custo do salgado ÷ markup divisor. O divisor é 1 − (custo fixo % + despesas % + lucro
              %) ÷ 100.
              {dados?.prontos && (
                <>
                  {" "}
                  Hoje a meta de lucro é <b>{numero(parametros.lucro)}%</b> e as despesas são{" "}
                  <b>{numero(parametros.despesasVariaveis)}%</b>.
                </>
              )}
            </div>
          </div>
          <ul className="lista-padrao">
            <li>
              <h3>
                <i style={{ background: "var(--parte-ingredientes)" }} />
                Ingredientes
              </h3>
              <p>
                Saem da receita: quantidade de cada ingrediente, convertida para a unidade da compra, dividida pelo
                rendimento.
              </p>
            </li>
            <li>
              <h3>
                <i style={{ background: "var(--parte-fixo)" }} />
                Custo fixo
              </h3>
              <p>Aluguel, energia, gás e salários do mês, divididos pelo faturamento e aplicados sobre o preço.</p>
            </li>
            <li>
              <h3>
                <i style={{ background: "var(--parte-despesas)" }} />
                Despesas variáveis
              </h3>
              <p>O que sai a cada venda: taxa da maquininha, embalagem, impostos sobre a venda.</p>
            </li>
            <li>
              <h3>
                <i style={{ background: "var(--parte-lucro)" }} />
                Lucro
              </h3>
              <p>O que sobra depois de tudo. Quando os custos passam do preço, falta tijolo e a fileira fica vermelha.</p>
            </li>
          </ul>
        </div>
      </section>

      <GavetaParametros aberta={abrirParametros} aoFechar={fecharParametros} />
    </>
  );
}
