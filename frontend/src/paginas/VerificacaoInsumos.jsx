import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { rotas } from "../api/cliente";
import { Alerta, Campo, Carregando, ErroApiAlerta, Vazio, useCarregar } from "../componentes/ui";
import { data, n, pct, reais, rotuloUnidade } from "../util/formato";

const MOTIVOS = {
  VENDIDO_POR_UNIDADE: "Insumo cadastrado por unidade: ainda não dá para comparar.",
  SEM_CUSTO: "Cadastre o custo deste insumo para comparar.",
  NAO_ENCONTRADO: "Nenhum produto parecido encontrado nos mercados.",
  FALHA_NA_BUSCA: "Um dos mercados não respondeu e nada foi encontrado.",
};

const SITUACOES = {
  PAGANDO_MAIS: { classe: "prejuizo", texto: (o) => `Pagando ${pct(Math.abs(n(o.diferencaPercentual)))} mais caro` },
  PAGANDO_MENOS: { classe: "rentavel", texto: (o) => `Pagando ${pct(Math.abs(n(o.diferencaPercentual)))} mais barato` },
  IGUAL: { classe: "neutro", texto: () => "Praticamente o mesmo preço" },
};

const chave = (o) => `${o.mercadoId}:${o.skuId}`;

function Insumo({ insumo }) {
  const [escolhida, setEscolhida] = useState("");
  const { opcoes } = insumo;
  const opcao = opcoes.find((o) => chave(o) === escolhida) || opcoes[0];
  const unidade = rotuloUnidade(insumo.unidadeBase);

  if (!opcao)
    return (
      <tr>
        <td className="nome-celula">
          <strong>{insumo.nome}</strong>
        </td>
        <td className="direita num">{insumo.precoPago ? `${reais(insumo.precoPago)}/${unidade}` : "—"}</td>
        <td colSpan={2}>{MOTIVOS[insumo.motivo]}</td>
      </tr>
    );

  const situacao = SITUACOES[opcao.situacao];
  const valor = Math.abs(n(opcao.diferenca));
  const naReceita = Math.abs(n(opcao.diferencaReceita));
  return (
    <tr>
      <td className="nome-celula">
        <strong>{insumo.nome}</strong>
      </td>
      <td className="direita num">
        {reais(insumo.precoPago)}/{unidade}
      </td>
      <td className="nome-celula">
        <strong className="num">
          {reais(opcao.precoBase)}/{unidade} no {opcao.mercado}
        </strong>
        <span>
          {opcao.link ? (
            <a href={opcao.link} target="_blank" rel="noreferrer">
              {opcao.produto}
            </a>
          ) : (
            opcao.produto
          )}{" "}
          ({reais(opcao.preco)})
        </span>
        {opcoes.length > 1 && (
          <select
            className="entrada"
            aria-label={`Produto comparado com ${insumo.nome}`}
            value={chave(opcao)}
            onChange={(e) => setEscolhida(e.target.value)}
          >
            {opcoes.map((o) => (
              <option key={chave(o)} value={chave(o)}>
                {o.mercado}: {o.produto}, {reais(o.precoBase)}/{unidade}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="nome-celula">
        <span className={`selo ${situacao.classe}`}>{situacao.texto(opcao)}</span>
        {opcao.situacao !== "IGUAL" && (
          <span>
            {reais(valor)} por {unidade}, {reais(naReceita)} por receita
          </span>
        )}
      </td>
    </tr>
  );
}

export function VerificacaoInsumos() {
  const [busca, setBusca] = useSearchParams();
  const produtoId = busca.get("produto") || "";
  const produtos = useCarregar(() => rotas.produtos(), []);
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: false });
  const pedido = useRef(0);

  // Trocar de salgado limpa o resultado e ignora a resposta de uma busca antiga.
  useEffect(() => {
    pedido.current++;
    setEstado({ dados: null, erro: null, carregando: false });
  }, [produtoId]);

  async function verificar(e) {
    e.preventDefault();
    const atual = ++pedido.current;
    setEstado({ dados: null, erro: null, carregando: true });
    try {
      const dados = await rotas.verificarInsumos(produtoId);
      if (atual === pedido.current) setEstado({ dados, erro: null, carregando: false });
    } catch (erro) {
      if (atual === pedido.current) setEstado({ dados: null, erro, carregando: false });
    }
  }

  const { dados, erro, carregando } = estado;
  const comErro = dados?.mercados.filter((m) => m.erro) || [];

  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="topo-pagina">
          <div>
            <h1>
              Verificação <b>de insumos</b>
            </h1>
            <p>Escolha um salgado e veja se você está pagando caro em cada insumo da receita.</p>
          </div>
        </div>

        <ErroApiAlerta erro={produtos.erro} />
        {produtos.carregando && <Carregando />}
        {produtos.dados?.length === 0 && (
          <Vazio titulo="Nenhum salgado cadastrado">
            Cadastre um salgado com receita em <Link to="/produtos">Salgados</Link>.
          </Vazio>
        )}
        {produtos.dados?.length > 0 && (
          <form className="verificacao-form" onSubmit={verificar}>
            <Campo rotulo="Salgado">
              <select
                className="entrada"
                required
                value={produtoId}
                onChange={(e) => setBusca(e.target.value ? { produto: e.target.value } : {})}
              >
                <option value="">Escolha…</option>
                {produtos.dados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <button type="submit" className="botao" disabled={!produtoId || carregando}>
              <Search size={18} aria-hidden="true" /> Verificar preços
            </button>
          </form>
        )}

        <ErroApiAlerta erro={erro} />
        {carregando && <Carregando texto="Consultando Savegnago e Atacadão… pode levar alguns segundos." />}
        {dados && (
          <>
            {comErro.length > 0 && (
              <Alerta tipo="atencao" titulo="Consulta incompleta">
                {comErro.map((m) => m.erro).join(". ")}
              </Alerta>
            )}
            <div className="tabela-envolve">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th className="direita">Você paga</th>
                    <th>Preço no mercado</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.insumos.map((i) => (
                    <Insumo key={i.ingredienteId} insumo={i} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="verificacao-nota">
              Consultado em {data(dados.consultadoEm)}. Preços online de referência: podem ser diferentes na loja de São
              Carlos. Confira se o produto comparado é o que você usa e, se não for, escolha outro na lista.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
