import { useCallback, useEffect, useState } from "react";

// Faturamento do mês, % de despesas variáveis e % de lucro desejado não ficam no banco.
// O gestor preenche uma vez e o navegador guarda para os próximos cálculos.
const CHAVE = "casa-do-salgado:parametros";
const PADRAO = { faturamentoMensal: "", despesasVariaveis: "10", lucro: "15" };
const ouvintes = new Set();

function ler() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return { ...PADRAO, ...(salvo || {}) };
  } catch {
    return { ...PADRAO };
  }
}

let atual = ler();

export function useParametros() {
  const [valor, setValor] = useState(atual);

  useEffect(() => {
    ouvintes.add(setValor);
    return () => ouvintes.delete(setValor);
  }, []);

  const salvar = useCallback((novo) => {
    atual = { ...atual, ...novo };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(atual));
    } catch {
      /* sem armazenamento: vale só nesta aba */
    }
    ouvintes.forEach((fn) => fn(atual));
  }, []);

  return [valor, salvar];
}

export function parametrosProntos(p) {
  return Number(String(p.faturamentoMensal).replace(",", ".")) > 0;
}
