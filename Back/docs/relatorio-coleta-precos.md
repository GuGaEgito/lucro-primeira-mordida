# Relatório: coleta de preços (Savegnago e Atacadão)

Data: 24/11/2026. Situação: coleta manual funcionando; ver a mudança de rumo no fim do texto.

## Como funciona

1. O script `scripts/coletar-precos.js` percorre os mercados e os termos, com 2 segundos entre as consultas.
2. O conector `src/modules/mercados/conectores/vtex.js` consulta a API de catálogo do site, sem login, chave ou IA:
   `GET {dominio}/api/catalog_system/pub/products/search?ft={termo}&_from=0&_to=9`
3. A resposta é validada com zod. Item sem estoque ou com preço zero é descartado.
4. `mercados.calculo.js` lê o tamanho no nome ("17kg") e calcula o preço-base com `Decimal`:
   R$ 202,30 ÷ 17 kg = R$ 11,90/kg.
5. Com `--salvar`, cada item vira uma linha em `dados/precos.jsonl`, com data e hora (arquivo fora do Git).

Cuidados: o programa se identifica como `consulta-precos/1.0`; 403 e 429 não são contornados nem repetidos; só os domínios de `mercados.config.js` são consultados; na dúvida sobre o tamanho, não há preço-base.

## Como rodar (na pasta `Back/`)

    node scripts/coletar-precos.js --salvar
    node scripts/coletar-precos.js "farinha de trigo" "oleo de soja"

## Resultado da coleta real

| Termo | Savegnago: itens | Atacadão: itens |
|---|---|---|
| farinha de trigo | 10 | 3 |
| peito de frango | 10 | 10 |
| oleo de soja | 3 | 0 (os 4 conferidos vieram com preço e estoque zero) |
| queijo mussarela | 5 | 10 |
| **Total** | **28** | **23** |

Dos 51 itens, 43 têm preço-base e 8 (Atacadão) são vendidos por quilo, com a base pendente.

Exemplos, com produtos semelhantes mas não idênticos:

| Produto | Savegnago | Atacadão |
|---|---|---|
| Filé de peito Seara 1 kg | R$ 24,90 (bandeja) e R$ 25,50 | R$ 18,90 (congelado) |
| Peito desfiado Vapza 400 g | R$ 29,90 | R$ 32,90 |
| Farinha de trigo, menor preço por kg | R$ 3,65 (Farina 1 kg) | R$ 2,80 (Nita pizza 5 kg) |

## Problema encontrado e corrigido

O Savegnago respondia HTTP 400 a espaços codificados como `+`. O conector passou a usar `%20`, e há um teste para isso.

## Testes

66 testes passaram, 15 deles novos (`tests/mercados.test.js`), e o lint passou. Os testes novos não acessam a internet.

## Limitações

- **Loja:** o preço de São Carlos não foi confirmado. No Atacadão, 4 produtos tiveram o mesmo preço nos CEPs de São Carlos, São Paulo e Manaus. O Savegnago abre com retirada em Sertãozinho. Apresentar como "preço online de referência".
- **Permissão:** o `robots.txt` não mostra bloqueio à API, mas os termos de uso não foram confirmados. Pedir autorização antes do uso público.
- **Produto certo:** a busca traz itens errados (sopa e empanado em "peito de frango"). Falta a IA sugerir e o gestor confirmar.
- **Venda por quilo:** falta confirmar se o preço é por kg ou pela fração mínima.
- **Termos:** os sites alternam "muçarela" e "mussarela"; o termo muda o resultado.
- **Histórico:** só existe uma coleta; ainda não dá para medir inflação.

## Próximos passos

Mudança de rumo (24/11/2026): a consulta passou a ser feita na hora, sem gravar no banco, pela tela
"Verificação de insumos" (`GET /api/produtos/:id/verificacao-insumos`). Sem histórico, o alerta de
inflação fica fora. As escolhas de produto seguem uma regra de palavras, sem IA, e podem ser trocadas
na tela.
