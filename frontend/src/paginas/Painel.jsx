import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAutenticacao } from "../auth/Autenticacao";
import { CardSalgado, Faixa, GavetaParametros } from "../componentes/Salgados";
import { Carregando, ErroApiAlerta, Vazio } from "../componentes/ui";
import { useResumo } from "../util/resumo";

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

// Painel enxuto: a saudação e a vitrine dos salgados do cardápio.
export function Painel() {
  const { usuario, gestor } = useAutenticacao();
  const [busca, setBusca] = useSearchParams();
  const { dados, erro, carregando, parametros } = useResumo();

  const itens = useMemo(
    () =>
      (dados?.itens || [])
        .filter((i) => i.produto.ativo)
        .sort((a, b) => PESO[a.situacao] - PESO[b.situacao] || margem(a) - margem(b)),
    [dados],
  );

  // A gaveta "Dados do mês" continua abrindo pelos links do aviso do topo e do rodapé.
  const abrirParametros = busca.get("parametros") === "1";
  const fecharParametros = () => setBusca({}, { replace: true });

  return (
    <>
      <section className="abertura abertura-simples">
        <div className="conteiner">
          <h1>
            {saudacao()}, {usuario?.nome}.
          </h1>
        </div>
      </section>

      {carregando && !dados ? (
        <div className="conteiner" style={{ padding: "32px 24px" }}>
          <Carregando texto="Montando a vitrine…" />
        </div>
      ) : erro ? (
        <div className="conteiner" style={{ padding: "32px 24px" }}>
          <ErroApiAlerta erro={erro} />
        </div>
      ) : itens.length === 0 ? (
        <div className="conteiner" style={{ padding: "32px 24px" }}>
          <div className="superficie">
            <Vazio
              titulo="A vitrine está vazia"
              acao={
                gestor && (
                  <Link to="/produtos/novo" className="botao">
                    Cadastrar o primeiro salgado
                  </Link>
                )
              }
            >
              Quando houver salgados no cardápio, eles aparecem aqui.
            </Vazio>
          </div>
        </div>
      ) : (
        <Faixa
          titulo="Vitrine"
          destaque="dos salgados"
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

      <GavetaParametros aberta={abrirParametros} aoFechar={fecharParametros} />
    </>
  );
}
