import { z } from "zod";

// Números chegam como number (1.5) ou string ("1.50"). Strings evitam perda de centavos no JSON.
export const numero = z.union([
  z.number().finite(),
  z.string().regex(/^-?\d+(\.\d+)?$/, "número inválido, use ponto como separador decimal"),
]);

export const unidadeMedida = z.enum(["KG", "G", "L", "ML", "UN"]);

export const percentuaisPreco = z.object({
  custoFixo: numero,
  despesasVariaveis: numero,
  lucro: numero,
});

export const produtoVenda = z.object({
  nome: z.string().min(1),
  precoVenda: numero,
  custoUnitario: numero,
});

export const itemMix = produtoVenda.extend({ quantidadeVendida: numero });

export const fichaTecnica = z.object({
  rendimento: numero,
  itens: z
    .array(
      z.object({
        ingredienteId: z.number().int(),
        nome: z.string().optional(),
        custoUnitario: numero,
        unidadeCadastro: unidadeMedida,
        quantidade: numero,
        unidadeReceita: unidadeMedida,
        fatorCorrecao: numero.optional(),
      }),
    )
    .min(1),
});
