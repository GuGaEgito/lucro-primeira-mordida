// Documentação da API (OpenAPI 3). Abra http://localhost:3000/api/docs com o servidor rodando.

const numero = {
  oneOf: [{ type: "number" }, { type: "string", pattern: "^-?\\d+(\\.\\d+)?$" }],
  description: 'Número ou texto numérico com ponto decimal (ex.: 1.50 ou "1.50")',
};
const decimal = { type: "string", description: 'Valor decimal como texto (ex.: "1.10")' };
const unidade = { type: "string", enum: ["KG", "G", "L", "ML", "UN"] };

function corpo(schema, exemplo) {
  return { required: true, content: { "application/json": { schema, example: exemplo } } };
}

function respostas(schema) {
  return {
    200: { description: "Resultado do cálculo", content: { "application/json": { schema } } },
    400: { $ref: "#/components/responses/DadosInvalidos" },
    422: { $ref: "#/components/responses/ErroCalculo" },
  };
}

function objetoDecimais(campos) {
  return { type: "object", properties: Object.fromEntries(campos.map((c) => [c, decimal])) };
}

const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });

const fichaExemplo = {
  rendimento: 40,
  itens: [
    {
      ingredienteId: 1,
      nome: "Farinha",
      custoUnitario: "5.00",
      unidadeCadastro: "KG",
      quantidade: 500,
      unidadeReceita: "G",
    },
    {
      ingredienteId: 2,
      nome: "Frango",
      custoUnitario: "20.00",
      unidadeCadastro: "KG",
      quantidade: 800,
      unidadeReceita: "G",
      fatorCorrecao: "1.25",
    },
  ],
};
const percentuaisExemplo = { custoFixo: 20, despesasVariaveis: 10, lucro: 15 };
const mixExemplo = {
  custosFixosMensais: 3000,
  percentualDespesasVariaveis: 10,
  itens: [
    { nome: "Coxinha", precoVenda: "5.00", custoUnitario: "1.50", quantidadeVendida: 300 },
    { nome: "Esfiha", precoVenda: "8.00", custoUnitario: "3.00", quantidadeVendida: 100 },
  ],
};

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "A Casa do Salgado - API",
    version: "1.0.0",
    description:
      "Cálculos de custo, preço, margem, ponto de equilíbrio e simulações. Todas as rotas de cálculo são POST com JSON e não gravam nada no banco. Percentuais são informados como número de 0 a 100 (10 = 10%). Valores decimais voltam como texto para não perder centavos.",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [{ name: "Cálculos" }, { name: "Sistema" }],
  paths: {
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Verifica se a API está no ar",
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { example: { status: "ok" } } },
          },
        },
      },
    },
    "/api/calculos/ficha-tecnica": {
      post: {
        tags: ["Cálculos"],
        summary: "Custo da receita e de cada salgado",
        requestBody: corpo(ref("FichaTecnica"), fichaExemplo),
        responses: respostas({
          type: "object",
          properties: {
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ingredienteId: { type: "integer" },
                  nome: { type: "string" },
                  quantidadeBruta: decimal,
                  custo: decimal,
                },
              },
            },
            custoTotalReceita: decimal,
            custoPorUnidade: decimal,
          },
        }),
      },
    },
    "/api/calculos/custos-fixos": {
      post: {
        tags: ["Cálculos"],
        summary: "Total de custos fixos, peso no faturamento e valor por unidade",
        requestBody: corpo(
          {
            type: "object",
            required: ["custos"],
            properties: {
              custos: {
                type: "array",
                items: {
                  type: "object",
                  required: ["nome", "valorMensal"],
                  properties: { nome: { type: "string" }, valorMensal: numero },
                },
              },
              faturamentoMensal: numero,
              producaoMensal: numero,
            },
          },
          {
            custos: [
              { nome: "Aluguel", valorMensal: 1500 },
              { nome: "Energia", valorMensal: 450 },
            ],
            faturamentoMensal: 10000,
            producaoMensal: 4000,
          },
        ),
        responses: respostas({
          type: "object",
          properties: {
            total: decimal,
            percentualSobreFaturamento: { ...decimal, nullable: true },
            porUnidade: { ...decimal, nullable: true },
          },
        }),
      },
    },
    "/api/calculos/markup": {
      post: {
        tags: ["Cálculos"],
        summary: "Markup divisor e multiplicador",
        requestBody: corpo(ref("PercentuaisPreco"), percentuaisExemplo),
        responses: respostas(objetoDecimais(["divisor", "multiplicador"])),
      },
    },
    "/api/calculos/preco-sugerido": {
      post: {
        tags: ["Cálculos"],
        summary: "Preço sugerido = custo / markup divisor",
        requestBody: corpo(
          {
            type: "object",
            required: ["custoUnitario", "percentuais"],
            properties: { custoUnitario: numero, percentuais: ref("PercentuaisPreco") },
          },
          { custoUnitario: "0.6025", percentuais: percentuaisExemplo },
        ),
        responses: respostas(
          objetoDecimais(["divisor", "multiplicador", "custoUnitario", "precoSugerido"]),
        ),
      },
    },
    "/api/calculos/analise-preco": {
      post: {
        tags: ["Cálculos"],
        summary: "Margem, lucro por unidade e CMV de um preço",
        requestBody: corpo(
          {
            type: "object",
            required: ["precoVenda", "custoUnitario", "percentuais"],
            properties: {
              precoVenda: numero,
              custoUnitario: numero,
              percentuais: {
                type: "object",
                required: ["custoFixo", "despesasVariaveis"],
                properties: { custoFixo: numero, despesasVariaveis: numero },
              },
            },
          },
          {
            precoVenda: "1.10",
            custoUnitario: "0.6025",
            percentuais: { custoFixo: 20, despesasVariaveis: 10 },
          },
        ),
        responses: respostas(
          objetoDecimais([
            "precoVenda",
            "custoUnitario",
            "despesasVariaveis",
            "custoFixoRateado",
            "margemContribuicao",
            "margemContribuicaoPercentual",
            "lucroUnitario",
            "margemLucroPercentual",
            "cmvPercentual",
          ]),
        ),
      },
    },
    "/api/calculos/ponto-equilibrio": {
      post: {
        tags: ["Cálculos"],
        summary: "Ponto de equilíbrio de um produto",
        requestBody: corpo(
          {
            type: "object",
            required: ["custosFixosMensais", "percentualDespesasVariaveis", "produto"],
            properties: {
              custosFixosMensais: numero,
              percentualDespesasVariaveis: numero,
              produto: ref("ProdutoVenda"),
            },
          },
          {
            custosFixosMensais: 3000,
            percentualDespesasVariaveis: 10,
            produto: { nome: "Coxinha", precoVenda: "5.00", custoUnitario: "1.50" },
          },
        ),
        responses: respostas(
          objetoDecimais(["margemContribuicaoUnitaria", "quantidade", "receita"]),
        ),
      },
    },
    "/api/calculos/ponto-equilibrio/mix": {
      post: {
        tags: ["Cálculos"],
        summary: "Ponto de equilíbrio de vários produtos (mix de vendas)",
        requestBody: corpo(ref("Mix"), mixExemplo),
        responses: respostas({
          type: "object",
          properties: {
            margemContribuicaoMedia: decimal,
            quantidadeTotal: decimal,
            receita: decimal,
            porProduto: {
              type: "array",
              items: {
                type: "object",
                properties: { nome: { type: "string" }, quantidade: decimal },
              },
            },
          },
        }),
      },
    },
    "/api/calculos/simulacoes/resultado-mensal": {
      post: {
        tags: ["Cálculos"],
        summary: "Simula receita, custos e lucro do mês",
        requestBody: corpo(ref("Mix"), mixExemplo),
        responses: respostas(
          objetoDecimais([
            "receita",
            "custoProdutos",
            "despesasVariaveis",
            "margemContribuicao",
            "custosFixos",
            "lucro",
            "margemLucroPercentual",
          ]),
        ),
      },
    },
    "/api/calculos/simulacoes/reajuste": {
      post: {
        tags: ["Cálculos"],
        summary: "Efeito de reajuste de ingredientes no custo e no preço sugerido",
        requestBody: corpo(
          {
            type: "object",
            required: ["ficha", "reajustes"],
            properties: {
              ficha: ref("FichaTecnica"),
              reajustes: {
                type: "array",
                items: {
                  type: "object",
                  required: ["ingredienteId", "percentual"],
                  properties: { ingredienteId: { type: "integer" }, percentual: numero },
                },
              },
              percentuais: ref("PercentuaisPreco"),
            },
          },
          {
            ficha: fichaExemplo,
            reajustes: [{ ingredienteId: 2, percentual: 10 }],
            percentuais: percentuaisExemplo,
          },
        ),
        responses: respostas(
          objetoDecimais([
            "custoPorUnidadeAntes",
            "custoPorUnidadeDepois",
            "variacaoPercentual",
            "precoSugeridoAntes",
            "precoSugeridoDepois",
          ]),
        ),
      },
    },
  },
  components: {
    schemas: {
      FichaTecnica: {
        type: "object",
        required: ["rendimento", "itens"],
        properties: {
          rendimento: { ...numero, description: "Quantos salgados a receita rende" },
          itens: {
            type: "array",
            items: {
              type: "object",
              required: [
                "ingredienteId",
                "custoUnitario",
                "unidadeCadastro",
                "quantidade",
                "unidadeReceita",
              ],
              properties: {
                ingredienteId: { type: "integer" },
                nome: { type: "string" },
                custoUnitario: { ...numero, description: "Custo por 1 unidade do cadastro" },
                unidadeCadastro: unidade,
                quantidade: { ...numero, description: "Quantidade usada (peso líquido)" },
                unidadeReceita: unidade,
                fatorCorrecao: {
                  ...numero,
                  description: "Peso bruto / peso líquido (mínimo 1, padrão 1)",
                },
              },
            },
          },
        },
      },
      PercentuaisPreco: {
        type: "object",
        required: ["custoFixo", "despesasVariaveis", "lucro"],
        properties: { custoFixo: numero, despesasVariaveis: numero, lucro: numero },
      },
      ProdutoVenda: {
        type: "object",
        required: ["nome", "precoVenda", "custoUnitario"],
        properties: { nome: { type: "string" }, precoVenda: numero, custoUnitario: numero },
      },
      Mix: {
        type: "object",
        required: ["custosFixosMensais", "percentualDespesasVariaveis", "itens"],
        properties: {
          custosFixosMensais: numero,
          percentualDespesasVariaveis: numero,
          itens: {
            type: "array",
            items: {
              type: "object",
              required: ["nome", "precoVenda", "custoUnitario", "quantidadeVendida"],
              properties: {
                nome: { type: "string" },
                precoVenda: numero,
                custoUnitario: numero,
                quantidadeVendida: numero,
              },
            },
          },
        },
      },
      Erro: {
        type: "object",
        required: ["codigo", "erro"],
        properties: {
          codigo: {
            type: "string",
            enum: [
              "DADOS_INVALIDOS",
              "JSON_INVALIDO",
              "CORPO_MUITO_GRANDE",
              "ERRO_CALCULO",
              "ROTA_NAO_ENCONTRADA",
              "ERRO_INTERNO",
            ],
            description: "Código fixo para o front tratar o erro",
          },
          erro: { type: "string", description: "Mensagem para mostrar ao usuário" },
          detalhes: {
            type: "array",
            description: "Só em DADOS_INVALIDOS: o campo com problema e o motivo",
            items: {
              type: "object",
              properties: { campo: { type: "string" }, mensagem: { type: "string" } },
            },
          },
        },
      },
    },
    responses: {
      DadosInvalidos: {
        description: "Corpo da requisição inválido (campo faltando ou com formato errado)",
        content: {
          "application/json": {
            schema: ref("Erro"),
            example: {
              codigo: "DADOS_INVALIDOS",
              erro: "Dados inválidos",
              detalhes: [{ campo: "rendimento", mensagem: "Invalid input" }],
            },
          },
        },
      },
      ErroCalculo: {
        description: "Os dados são válidos, mas o cálculo não é possível (ex.: rendimento zero)",
        content: {
          "application/json": {
            schema: ref("Erro"),
            example: {
              codigo: "ERRO_CALCULO",
              erro: "Rendimento da receita deve ser maior que zero",
            },
          },
        },
      },
    },
  },
};

module.exports = { openapi };
