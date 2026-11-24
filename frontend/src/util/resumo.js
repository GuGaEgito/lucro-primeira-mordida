import { useEffect, useState } from "react";
import { rotas } from "../api/cliente";
import { parametrosProntos, useParametros } from "./parametros";

// Carrega os produtos e a precificação de cada um (custo, preço sugerido, situação).
// Painel, barra de aviso e lista de produtos usam o mesmo resultado.

let cache = null; // { chave, promessa }
const ouvintes = new Set();

export function invalidarResumo() {
  cache = null;
  ouvintes.forEach((fn) => fn((v) => v + 1));
}

function paramsApi(p) {
  return {
    faturamentoMensal: String(p.faturamentoMensal).replace(",", "."),
    despesasVariaveis: String(p.despesasVariaveis || 0).replace(",", "."),
    lucro: String(p.lucro || 0).replace(",", "."),
  };
}

async function carregar(parametros) {
  const produtos = await rotas.produtos(true);
  const prontos = parametrosProntos(parametros);
  const itens = await Promise.all(
    produtos.map(async (produto) => {
      if (produto.ingredientes.length === 0) return { produto, situacao: "SEM_RECEITA" };
      if (!prontos) return { produto, situacao: "CONFIGURAR" };
      try {
        const precificacao = await rotas.precificar(produto.id, paramsApi(parametros));
        const situacao = precificacao.analisePrecoAtual?.situacao || "SEM_PRECO";
        return { produto, precificacao, situacao };
      } catch (erro) {
        return { produto, erro, situacao: "ERRO" };
      }
    }),
  );
  return { itens, prontos };
}

export function useResumo() {
  const [parametros] = useParametros();
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });

  useEffect(() => {
    ouvintes.add(setVersao);
    return () => ouvintes.delete(setVersao);
  }, []);

  useEffect(() => {
    const chave = JSON.stringify(paramsApi(parametros));
    if (!cache || cache.chave !== chave) cache = { chave, promessa: carregar(parametros) };
    let vivo = true;
    const promessa = cache.promessa;
    setEstado((e) => ({ ...e, carregando: true }));
    promessa
      .then((dados) => vivo && setEstado({ dados, erro: null, carregando: false }))
      .catch((erro) => {
        if (cache?.promessa === promessa) cache = null;
        if (vivo) setEstado({ dados: null, erro, carregando: false });
      });
    return () => {
      vivo = false;
    };
  }, [parametros, versao]);

  return { ...estado, parametros, recarregar: invalidarResumo };
}

export function contar(itens = []) {
  const ativos = itens.filter((i) => i.produto.ativo);
  return {
    ativos: ativos.length,
    lucro: ativos.filter((i) => i.situacao === "RENTAVEL").length,
    abaixo: ativos.filter((i) => i.situacao === "ABAIXO_DA_META").length,
    prejuizo: ativos.filter((i) => i.situacao === "PREJUIZO").length,
    semPreco: ativos.filter((i) => ["SEM_PRECO", "SEM_RECEITA"].includes(i.situacao)).length,
  };
}

export { paramsApi };
