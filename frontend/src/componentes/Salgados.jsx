import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { FileiraTijolos, partesDaPrecificacao } from "./FileiraTijolos";
import { Campo, Entrada, Gaveta, Selo, useAvisar } from "./ui";
import { numero, reais, reaisFino } from "../util/formato";
import { useParametros } from "../util/parametros";
import { invalidarResumo } from "../util/resumo";

// Card do salgado: sempre a mesma mobília (rendimento, custo, preço, lucro e a fileira).
export function CardSalgado({ item, parametros }) {
  const { produto, precificacao, situacao } = item;
  const partes = partesDaPrecificacao(precificacao, parametros);
  const custo = precificacao?.fichaTecnica?.custoPorUnidade;
  const preco = produto.precoVenda;
  const lucro = precificacao?.analisePrecoAtual?.lucroUnitario;
  const sugerido = precificacao?.precoSugerido?.precoSugerido;
  const s = !produto.ativo ? "INATIVO" : situacao;

  return (
    <Link to={`/produtos/${produto.id}`} className={`card-salgado${produto.ativo ? "" : " inativo"}`}>
      <div className="cabeca">
        <div>
          <h3>{produto.nome}</h3>
          <p className="rende">
            Receita rende {numero(produto.rendimento)} {Number(produto.rendimento) === 1 ? "unidade" : "unidades"}
          </p>
        </div>
        <Selo situacao={s} />
      </div>
      <dl className="num">
        <div>
          <dt>Custo/un</dt>
          <dd>{custo ? reaisFino(custo) : "—"}</dd>
        </div>
        <div>
          <dt>Preço</dt>
          <dd>{preco ? reais(preco) : "—"}</dd>
        </div>
        <div>
          <dt>{lucro !== undefined ? "Lucro/un" : "Sugerido"}</dt>
          <dd className={lucro !== undefined ? (Number(lucro) < 0 ? "ruim" : "bom") : ""}>
            {lucro !== undefined ? reais(lucro) : sugerido ? reais(sugerido) : "—"}
          </dd>
        </div>
      </dl>
      <FileiraTijolos partes={partes} legenda={false} />
      <div className="pe">
        <span>
          {situacao === "SEM_RECEITA"
            ? "Falta montar a receita"
            : situacao === "CONFIGURAR"
              ? "Falta o faturamento do mês"
              : partes?.origem === "sugerido"
                ? "Fileira com o preço sugerido"
                : `${numero(produto.ingredientes.length)} ingredientes`}
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </div>
    </Link>
  );
}

// Faixa que rola para o lado, com setas (como as vitrines da referência).
export function Faixa({ titulo, destaque, texto, acao, children, rotulo }) {
  const trilho = useRef(null);
  const [pode, setPode] = useState({ voltar: false, avancar: false });

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    const medir = () =>
      setPode({
        voltar: el.scrollLeft > 4,
        avancar: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      obs.disconnect();
    };
  }, [children]);

  const rolar = (dir) => {
    const el = trilho.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className="faixa" aria-label={rotulo || `${titulo} ${destaque || ""}`}>
      <div className="conteiner">
        <div className="faixa-topo">
          <div>
            <h2>
              {titulo}
              {destaque && <span>{destaque}</span>}
            </h2>
            {texto && <p>{texto}</p>}
          </div>
          <div className="faixa-controles">
            {acao}
            <button type="button" className="seta" onClick={() => rolar(-1)} disabled={!pode.voltar} aria-label="Voltar">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="seta" onClick={() => rolar(1)} disabled={!pode.avancar} aria-label="Avançar">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="trilho" ref={trilho} tabIndex={0}>
          {children}
        </div>
      </div>
    </section>
  );
}

// Dados do mês que o banco não guarda: faturamento, % de despesas variáveis e meta de lucro.
export function FormParametros({ aoSalvar, compacto = false }) {
  const [parametros, salvar] = useParametros();
  const [valores, setValores] = useState(parametros);
  const [erro, setErro] = useState(null);
  const avisar = useAvisar();

  useEffect(() => setValores(parametros), [parametros]);

  function enviar(e) {
    e.preventDefault();
    const fat = Number(String(valores.faturamentoMensal).replace(/\./g, "").replace(",", "."));
    const dv = Number(String(valores.despesasVariaveis).replace(",", "."));
    const lu = Number(String(valores.lucro).replace(",", "."));
    if (!(fat > 0)) return setErro("Informe quanto a loja fatura por mês (maior que zero).");
    if (!(dv >= 0 && dv < 100) || !(lu >= 0 && lu < 100))
      return setErro("Os percentuais vão de 0 a 99.");
    setErro(null);
    salvar({ faturamentoMensal: String(fat), despesasVariaveis: String(dv), lucro: String(lu) });
    invalidarResumo();
    avisar("Dados do mês salvos");
    aoSalvar?.();
  }

  const mudar = (k) => (e) => setValores((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form onSubmit={enviar} className={compacto ? "parametros-loja" : "grade-campos"} noValidate>
      <Campo rotulo="Faturamento do mês" ajuda={compacto ? undefined : "Quanto a loja vende por mês, em média."}>
        <Entrada
          prefixo="R$"
          inputMode="decimal"
          value={valores.faturamentoMensal}
          onChange={mudar("faturamentoMensal")}
          placeholder="10000"
          aria-invalid={Boolean(erro)}
        />
      </Campo>
      <Campo
        rotulo="Despesas variáveis"
        ajuda={compacto ? undefined : "Taxa do cartão, embalagem, impostos sobre a venda."}
      >
        <Entrada sufixo="%" inputMode="decimal" value={valores.despesasVariaveis} onChange={mudar("despesasVariaveis")} />
      </Campo>
      <Campo rotulo="Meta de lucro" ajuda={compacto ? undefined : "Quanto de cada venda deve sobrar como lucro."}>
        <Entrada sufixo="%" inputMode="decimal" value={valores.lucro} onChange={mudar("lucro")} />
      </Campo>
      <div>
        <button type="submit" className="botao">
          Salvar dados do mês
        </button>
      </div>
      {erro && (
        <p className="erro-campo" role="alert" style={{ color: "var(--prejuizo)", gridColumn: "1 / -1" }}>
          {erro}
        </p>
      )}
    </form>
  );
}

export function GavetaParametros({ aberta, aoFechar }) {
  return (
    <Gaveta titulo="Dados do mês" aberta={aberta} aoFechar={aoFechar}>
      <p style={{ color: "var(--tinta-2)" }}>
        Estes números não ficam no banco: ficam guardados neste computador e entram em todos os cálculos de preço.
        O custo fixo em % sai dos custos fixos cadastrados divididos pelo faturamento.
      </p>
      <FormParametros aoSalvar={aoFechar} />
    </Gaveta>
  );
}
