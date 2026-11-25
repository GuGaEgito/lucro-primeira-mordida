const { z } = require("zod");
const { calcularPrecoBase, extrairEmbalagem } = require("../mercados.calculo");

const TEMPO_LIMITE_MS = 20000;

const respostaSchema = z.array(
  z.object({
    productId: z.string(),
    productName: z.string(),
    link: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string(),
        nameComplete: z.string().optional(),
        measurementUnit: z.string().nullish(),
        unitMultiplier: z.number().nullish(),
        sellers: z.array(
          z.object({
            sellerId: z.string(),
            sellerDefault: z.boolean().optional(),
            commertialOffer: z.object({ Price: z.number(), AvailableQuantity: z.number() }),
          }),
        ),
      }),
    ),
  }),
);

class ErroMercado extends Error {
  constructor(mensagem, status = null) {
    super(mensagem);
    this.name = "ErroMercado";
    this.status = status;
  }
}

function normalizarItem(produto, item, mercado, coletadoEm) {
  const vendedor = item.sellers.find((s) => s.sellerDefault) ?? item.sellers[0];
  const oferta = vendedor?.commertialOffer;
  // Produto sem estoque pode vir com preço 0 ou desatualizado: não vale como preço.
  if (!oferta || oferta.Price <= 0 || oferta.AvailableQuantity <= 0) return null;

  const nome = item.nameComplete || produto.productName;
  const vendaPorUnidade =
    (item.measurementUnit ?? "un").toLowerCase() === "un" && (item.unitMultiplier ?? 1) === 1;
  const embalagem = vendaPorUnidade ? extrairEmbalagem(nome) : null;
  const base = embalagem ? calcularPrecoBase(oferta.Price, embalagem) : null;
  let motivoSemBase = null;
  if (!vendaPorUnidade) motivoSemBase = "VENDA_FRACIONADA";
  else if (!embalagem) motivoSemBase = "TAMANHO_NAO_IDENTIFICADO";

  return {
    mercadoId: mercado.id,
    produtoId: produto.productId,
    skuId: item.itemId,
    vendedorId: vendedor.sellerId,
    nome,
    link: produto.link ?? null,
    preco: String(oferta.Price),
    embalagem: embalagem
      ? { quantidade: embalagem.quantidade.toString(), unidade: embalagem.unidade }
      : null,
    precoBase: base?.valor.toString() ?? null,
    unidadeBase: base?.unidadeBase ?? null,
    motivoSemBase,
    origem: "SITE",
    coletadoEm,
  };
}

// Busca na API pública de catálogo da VTEX. `buscar` permite trocar o fetch nos testes.
async function buscarProdutos(mercado, termo, { limite = 10, buscar = fetch } = {}) {
  const url = new URL("/api/catalog_system/pub/products/search", mercado.dominio);
  // encodeURIComponent: o Savegnago recusa espaço codificado como "+" (HTTP 400).
  url.search = `ft=${encodeURIComponent(termo)}&_from=0&_to=${limite - 1}`;

  let resposta;
  try {
    resposta = await buscar(url, {
      headers: { Accept: "application/json", "User-Agent": "consulta-precos/1.0" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    throw new ErroMercado(`${mercado.nome} não respondeu: ${erro.message}`);
  }
  // Bloqueio (403/429) não é contornado nem repetido: a coleta registra o erro e segue.
  if (!resposta.ok) {
    throw new ErroMercado(`${mercado.nome} respondeu HTTP ${resposta.status}`, resposta.status);
  }

  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    throw new ErroMercado(`${mercado.nome} não devolveu JSON`, resposta.status);
  }
  const validado = respostaSchema.safeParse(corpo);
  if (!validado.success) {
    throw new ErroMercado(`${mercado.nome} mudou o formato da resposta`, resposta.status);
  }

  const coletadoEm = new Date().toISOString();
  return validado.data.flatMap((produto) =>
    produto.items
      .map((item) => normalizarItem(produto, item, mercado, coletadoEm))
      .filter((item) => item !== null),
  );
}

module.exports = { ErroMercado, buscarProdutos };
