import { reais } from "../util/formato";

// A assinatura da Casa: o preço de um salgado desenhado como uma fileira de tijolos.
// Cada tijolo é uma parte do preço, com largura proporcional ao valor.
// Quando os custos passam do preço, a parede passa da linha do preço e o excesso fica listrado em vermelho.

const PARTES = [
  { chave: "ingredientes", nome: "Ingredientes", cor: "var(--parte-ingredientes)" },
  { chave: "fixo", nome: "Custo fixo", cor: "var(--parte-fixo)" },
  { chave: "despesas", nome: "Despesas", cor: "var(--parte-despesas)" },
  { chave: "lucro", nome: "Lucro", cor: "var(--parte-lucro)" },
];

export function FileiraTijolos({ partes, grande = false, legenda = true, rotuloPreco }) {
  if (!partes || !(partes.preco > 0)) {
    return (
      <div className={`fileira${grande ? " grande" : ""}`}>
        <div className="parede" role="img" aria-label="Sem preço para montar a fileira">
          <div className="vao" />
        </div>
        {legenda && (
          <ul className="legenda">
            <li>Cadastre a receita e o preço para ver para onde vai o dinheiro.</li>
          </ul>
        )}
      </div>
    );
  }

  const { preco, ingredientes, fixo, despesas, lucro } = partes;
  const custos = ingredientes + fixo + despesas;
  const prejuizo = lucro < 0;
  const total = Math.max(preco, custos);
  const larg = (v) => `${(Math.max(v, 0) / total) * 100}%`;
  const valores = { ingredientes, fixo, despesas, lucro: Math.max(lucro, 0) };
  const visiveis = PARTES.filter((p) => valores[p.chave] > 0);

  const descricao = prejuizo
    ? `Preço ${reais(preco)}. Os custos somam ${reais(custos)}: faltam ${reais(-lucro)} por salgado.`
    : `Preço ${reais(preco)}: ingredientes ${reais(ingredientes)}, custo fixo ${reais(fixo)}, despesas ${reais(despesas)}, lucro ${reais(lucro)}.`;

  return (
    <div className={`fileira${grande ? " grande" : ""}${prejuizo || rotuloPreco ? " com-preco" : ""}`}>
      <div className="parede" role="img" aria-label={descricao}>
        {visiveis.map((p, i) => (
          <div
            key={p.chave}
            className={`tijolo ${p.chave}`}
            style={{ width: larg(valores[p.chave]), "--i": i }}
            title={`${p.nome}: ${reais(valores[p.chave])}`}
          />
        ))}
        {prejuizo && (
          <div
            className="tijolo falta"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: `calc(${(preco / total) * 100}% + 2px)`,
              right: 3,
              opacity: 0.85,
              "--i": visiveis.length,
              mixBlendMode: "multiply",
            }}
          />
        )}
        {(prejuizo || rotuloPreco) && (
          <span
            className="linha-preco"
            data-rotulo={rotuloPreco || `preço ${reais(preco)}`}
            data-lado={preco / total > 0.8 ? "fim" : preco / total < 0.2 ? "inicio" : undefined}
            style={{ left: `calc(${(preco / total) * 100}% - 1px)` }}
            aria-hidden="true"
          />
        )}
      </div>
      {legenda && (
        <ul className="legenda num">
          {PARTES.filter((p) => p.chave !== "lucro").map((p) => (
            <li key={p.chave}>
              <i style={{ background: p.cor }} />
              {p.nome} <b>{reais(valores[p.chave])}</b>
            </li>
          ))}
          {prejuizo ? (
            <li>
              <i className="tijolo falta" style={{ animation: "none" }} />
              Falta <b style={{ color: "var(--prejuizo)" }}>{reais(-lucro)}</b>
            </li>
          ) : (
            <li>
              <i style={{ background: "var(--parte-lucro)" }} />
              Lucro <b>{reais(lucro)}</b>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Monta as partes a partir da resposta de POST /api/produtos/:id/precificacao.
// Usa o preço cadastrado quando existe; senão, o preço sugerido.
export function partesDaPrecificacao(p, parametros) {
  if (!p) return null;
  const a = p.analisePrecoAtual;
  if (a) {
    return {
      origem: "atual",
      preco: Number(a.precoVenda),
      ingredientes: Number(a.custoUnitario),
      fixo: Number(a.custoFixoRateado),
      despesas: Number(a.despesasVariaveis),
      lucro: Number(a.lucroUnitario),
    };
  }
  return partesDoSugerido(
    p.precoSugerido,
    p.fichaTecnica?.custoPorUnidade,
    p.custosFixos?.percentualSobreFaturamento,
    parametros?.despesasVariaveis,
    parametros?.lucro,
  );
}

export function partesDoSugerido(sugerido, custoUnitario, pctFixo, pctDespesas, pctLucro) {
  if (!sugerido) return null;
  const preco = Number(sugerido.precoSugerido);
  const ingredientes = Number(custoUnitario ?? sugerido.custoUnitario);
  const divisor = Number(sugerido.divisor);
  // Sem os percentuais separados, divide o que sobra pelo markup.
  const restante = preco - ingredientes;
  const fixo = pctFixo !== undefined ? (preco * Number(pctFixo)) / 100 : restante / 3;
  const despesas = pctDespesas !== undefined ? (preco * Number(pctDespesas)) / 100 : restante / 3;
  const lucro = pctLucro !== undefined ? (preco * Number(pctLucro)) / 100 : preco - ingredientes - fixo - despesas;
  return { origem: "sugerido", preco, ingredientes, fixo, despesas, lucro, divisor };
}

// Partes a partir da resposta de POST /api/calculos/analise-preco.
export function partesDaAnalise(a) {
  if (!a) return null;
  return {
    origem: "atual",
    preco: Number(a.precoVenda),
    ingredientes: Number(a.custoUnitario),
    fixo: Number(a.custoFixoRateado),
    despesas: Number(a.despesasVariaveis),
    lucro: Number(a.lucroUnitario),
  };
}
