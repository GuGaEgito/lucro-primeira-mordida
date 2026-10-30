# O que o back-end faz hoje

Retrato do código da `main` em `Back/` em 29/10/2026 (commit a7af662, depois do PR #5). Nesse dia os testes rodaram: 28 de 28 passam.

## Resumo em uma frase

Hoje o back é uma **calculadora pela internet**: o front manda os números em JSON, o back faz a conta e devolve o resultado. Ele **não lê nem grava nada no banco de dados**. O banco existe (tabelas criadas pelo Prisma), mas nenhuma rota usa ele ainda.

## Como ele roda

- Node.js 22+, JavaScript puro (CommonJS), Express 4. Não tem etapa de build.
- `npm run dev` liga o servidor e reinicia sozinho quando você salva um arquivo. `npm start` liga sem reiniciar. `npm test` roda os testes.
- Porta padrão 3000 (variável `PORT`).
- CORS: a variável `CORS_ORIGIN` diz quais endereços do front podem chamar a API (ex.: `http://localhost:5173`). Se ficar vazia, qualquer site pode chamar (só para desenvolvimento).
- Aceita corpo JSON de até 100 KB.
- Ao parar (Ctrl+C ou Docker), termina as requisições em andamento antes de desligar, com limite de 10 segundos.
- Contas com dinheiro usam a biblioteca `decimal.js`, que não perde centavos como o `number` do JavaScript. Por isso os valores voltam como texto, por exemplo `"1.10"`.

## Rotas de apoio

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/health` | Responde `{ "status": "ok" }`. Serve para saber se o servidor está de pé. |
| GET | `/api/docs` | Página do Swagger com todas as rotas, onde dá para testar no navegador. |
| GET | `/api/openapi.json` | A mesma documentação em JSON, para o front importar no Insomnia/Postman. |

## Rotas de cálculo

Todas são `POST`, começam com `/api/calculos`, recebem JSON e devolvem JSON. Números podem ir como número (`1.5`) ou texto (`"1.50"`), sempre com ponto. Percentuais vão como número inteiro de porcentagem: `8` quer dizer 8%.

### 1. POST /api/calculos/ficha-tecnica

**Para que serve:** quanto custa fazer a receita inteira e cada salgado.

**Entrada:** `rendimento` (quantos salgados a receita rende) e `itens`, uma lista onde cada ingrediente tem `ingredienteId`, `nome` (opcional), `custoUnitario` (preço de 1 unidade do cadastro, ex.: R$ 5 o kg), `unidadeCadastro`, `quantidade` usada na receita, `unidadeReceita` e `fatorCorrecao` (opcional, padrão 1). Unidades aceitas: KG, G, L, ML, UN.

**Saída:** cada item com `quantidadeBruta` e `custo`, mais `custoTotalReceita` e `custoPorUnidade`.

**Contas:**

- quantidade bruta = quantidade × fator de correção, convertida para a unidade do cadastro (ex.: 500 g vira 0,5 kg)
- custo do item = quantidade bruta × custo unitário
- custo total = soma dos itens
- custo por salgado = custo total ÷ rendimento (4 casas decimais)

O fator de correção cobre perdas no preparo (casca, aparas). Ele precisa ser 1 ou mais. Não dá para converter entre grupos diferentes (kg para litro, por exemplo): isso gera erro.

### 2. POST /api/calculos/custos-fixos

**Para que serve:** somar os custos fixos do mês e ver quanto pesam.

**Entrada:** `custos` (lista de `{ nome, valorMensal }`, ex.: aluguel, energia), e opcionalmente `faturamentoMensal` e `producaoMensal`.

**Saída:** `total`, `percentualSobreFaturamento` e `porUnidade` (os dois últimos voltam `null` se você não mandou o dado).

**Contas:**

- total = soma dos custos
- % sobre o faturamento = total ÷ faturamento × 100
- por salgado = total ÷ salgados produzidos no mês

### 3. POST /api/calculos/markup

**Para que serve:** o índice que transforma custo em preço, no método do SEBRAE.

**Entrada:** `custoFixo`, `despesasVariaveis` e `lucro`, todos em % do preço de venda. Despesas variáveis são o que acompanha cada venda: imposto (Simples), taxa de cartão, comissão, entrega.

**Saída:** `divisor` e `multiplicador`.

**Contas:**

- markup divisor = 1 − (custo fixo % + despesas variáveis % + lucro %) ÷ 100
- markup multiplicador = 1 ÷ divisor

Cada percentual tem que ficar entre 0 e 99,99, e a soma dos três tem que ser menor que 100%.

**Exemplo:** 15% + 10% + 20% = 45%. Divisor = 0,55. Multiplicador ≈ 1,818.

### 4. POST /api/calculos/preco-sugerido

**Para que serve:** o preço de venda sugerido para um salgado.

**Entrada:** `custoUnitario` (custo do salgado, que sai da rota 1) e `percentuais` (os mesmos três da rota 3).

**Saída:** `divisor`, `multiplicador`, `custoUnitario` e `precoSugerido`.

**Conta:** preço sugerido = custo do salgado ÷ markup divisor.

**Exemplo:** custo R$ 1,10 e divisor 0,55 dá R$ 2,00.

### 5. POST /api/calculos/analise-preco

**Para que serve:** pegar um preço que já existe (ou que o gestor quer usar) e mostrar o que ele realmente deixa de lucro.

**Entrada:** `precoVenda`, `custoUnitario` e `percentuais` só com `custoFixo` e `despesasVariaveis` (aqui não vai lucro, porque o lucro é o que a rota calcula).

**Saída e contas:**

- `despesasVariaveis` = preço × % despesas variáveis
- `custoFixoRateado` = preço × % custo fixo
- `margemContribuicao` = preço − custo do salgado − despesas variáveis (e `margemContribuicaoPercentual` = margem ÷ preço × 100)
- `lucroUnitario` = margem de contribuição − custo fixo rateado (e `margemLucroPercentual` = lucro ÷ preço × 100)
- `cmvPercentual` (food cost) = custo do salgado ÷ preço × 100

Se o lucro sair negativo, a rota **não** dá erro: ela devolve o número negativo. Quem interpreta é o front.

### 6. POST /api/calculos/ponto-equilibrio

**Para que serve:** quantos salgados de **um** tipo precisam ser vendidos no mês para não ter prejuízo.

**Entrada:** `custosFixosMensais`, `percentualDespesasVariaveis` e `produto` (`{ nome, precoVenda, custoUnitario }`).

**Saída:** `margemContribuicaoUnitaria`, `quantidade` e `receita`.

**Contas:**

- margem de contribuição unitária = preço − custo − preço × % despesas variáveis
- quantidade = custos fixos ÷ margem (arredondada para cima)
- receita = quantidade × preço

Se a margem for zero ou negativa, dá erro, porque nesse caso nenhuma quantidade empata.

### 7. POST /api/calculos/ponto-equilibrio/mix

**Para que serve:** o mesmo ponto de equilíbrio, mas com **vários** salgados, cada um pesando conforme quanto vende.

**Entrada:** `custosFixosMensais`, `percentualDespesasVariaveis` e `itens` (cada um com `nome`, `precoVenda`, `custoUnitario` e `quantidadeVendida` no mês).

**Saída:** `margemContribuicaoMedia`, `quantidadeTotal`, `receita` e `porProduto` (quantos de cada salgado).

**Contas:**

- margem média = soma(margem de cada salgado × quantidade vendida) ÷ soma das quantidades
- quantidade total = custos fixos ÷ margem média
- quantidade de cada salgado = quantidade total × (vendas dele ÷ vendas totais), arredondada para cima
- receita = custos fixos ÷ (margem total ÷ receita total)

### 8. POST /api/calculos/simulacoes/resultado-mensal

**Para que serve:** "e se eu vender tantos de cada salgado este mês, quanto sobra?"

**Entrada:** a mesma da rota 7.

**Saída e contas:**

- `receita` = soma(preço × quantidade)
- `custoProdutos` = soma(custo × quantidade)
- `despesasVariaveis` = receita × %
- `margemContribuicao` = receita − custo dos produtos − despesas variáveis
- `lucro` = margem de contribuição − custos fixos
- `margemLucroPercentual` = lucro ÷ receita × 100

### 9. POST /api/calculos/simulacoes/reajuste

**Para que serve:** "e se a farinha subir 10%?"

**Entrada:** `ficha` (igual à rota 1), `reajustes` (lista de `{ ingredienteId, percentual }`, onde 10 = subiu 10% e −5 = caiu 5%) e, opcionalmente, `percentuais` do markup.

**Saída:** `custoPorUnidadeAntes`, `custoPorUnidadeDepois`, `variacaoPercentual` e, se mandou os percentuais, `precoSugeridoAntes` e `precoSugeridoDepois`.

**Contas:** novo custo do ingrediente = custo × (1 + % ÷ 100). Depois recalcula a ficha (rota 1) e o preço sugerido (rota 4) com o custo novo.

## Arredondamento

- Valores em dinheiro: 2 casas, arredondando o meio para cima (ex.: 2,345 vira 2,35). Isso só acontece no resultado final, nunca no meio da conta.
- Custo por salgado e custo fixo por salgado: 4 casas, igual ao banco.
- Markup: 6 casas. Percentuais de análise: 2 casas.
- Quantidades de ponto de equilíbrio: sempre arredondadas para cima (não dá para vender meio salgado).

## Tratamento de erros

Toda resposta de erro tem o mesmo formato:

```json
{ "codigo": "DADOS_INVALIDOS", "erro": "Dados inválidos", "detalhes": [ { "campo": "rendimento", "mensagem": "..." } ] }
```

O front decide o que fazer olhando o `codigo` e mostra a frase de `erro` para o usuário. O campo `detalhes` só aparece em erro de validação.

| Código | Status HTTP | Quando acontece |
| --- | --- | --- |
| `DADOS_INVALIDOS` | 400 | Faltou campo, tipo errado, número com vírgula, unidade que não existe. A validação é feita com a biblioteca Zod. |
| `JSON_INVALIDO` | 400 | O corpo enviado não é um JSON válido. |
| `CORPO_MUITO_GRANDE` | 413 | Corpo maior que 100 KB. |
| `ERRO_CALCULO` | 422 | Os dados vieram certos, mas a conta não faz sentido: rendimento zero, valor negativo, percentuais somando 100% ou mais, margem negativa no ponto de equilíbrio, conversão de kg para litro. |
| `ROTA_NAO_ENCONTRADA` | 404 | Endereço que não existe. |
| `ERRO_INTERNO` | 500 | Qualquer outro problema. O detalhe só aparece no console do servidor. |

## O que o banco tem

PostgreSQL, descrito no `prisma/schema.prisma` e criado por duas migrations. Todas as datas são gravadas com fuso horário.

| Tabela | Colunas principais | Para que serve |
| --- | --- | --- |
| `usuario` | nome, cargo (GESTOR ou FUNCIONARIO), senha (hash), ativo, criado_em | Quem usa o sistema. |
| `ingredientes` | nome (único), unidade (KG, G, L, ML, UN), custo_unitario (4 casas), atualizado_em | Os insumos e quanto custam. |
| `produtos` | nome, ingredientes_id, preco_venda, ativo, atualizado_em | Os salgados à venda. |
| `custo_fixo` | nome (único), valor_mensal, atualizado_em | Aluguel, energia, gás, salários. |
| `historico_custo_insumo` | insumo_id, custo_anterior, custo_novo, usuario_id, alterado_em | Registro de cada mudança de preço de ingrediente e de quem mudou. |

O banco também bloqueia valores negativos em custo, preço e valor mensal (regras CHECK) e tem índices para buscar o histórico rápido.

**Atenção:** `produtos` tem só **um** campo `ingredientes_id`. Isso quer dizer que, do jeito que está, um salgado só consegue se ligar a **um** ingrediente. Uma coxinha com farinha, frango e óleo não cabe nesse desenho.

## O que ainda NÃO faz

1. **Nenhuma rota usa o banco.** Não existe rota para cadastrar, listar, editar ou apagar ingredientes, produtos, custos fixos ou usuários. Hoje o front teria que mandar todos os números em cada cálculo.
2. **Falta a tabela produto x ingrediente** (a ficha técnica salva). Sem ela não dá para guardar a receita de cada salgado com quantidade, unidade e fator de correção. Também falta guardar o rendimento da receita.
3. **Falta a avaliação "rentável ou não".** A análise de preço devolve os números (margem, lucro, CMV), mas não diz "este salgado dá lucro", "está no limite" ou "dá prejuízo".
4. ~~O histórico de custo não é preenchido.~~ Feito em 30/10: o `PUT /api/ingredientes/:id` grava a mudança de custo com o usuário logado.
5. ~~Não tem login nem permissão.~~ Feito em 30/10: login com JWT (`POST /api/auth/login`), FUNCIONARIO só consulta e calcula, GESTOR cria, altera e apaga. Veja "Login e permissões" no `Back/README.md`.
6. **Falta o adaptador do Prisma 7.** Quando as rotas forem usar o banco, vai ser preciso instalar o `@prisma/adapter-pg` (o Prisma 7 exige).
7. A pasta `src/modules/ingredientes/` está vazia, só reservada.

## Testes

`npm test` roda 28 testes em dois arquivos: `tests/calculos.test.js` testa as fórmulas e `tests/api.test.js` chama as rotas de verdade (com supertest) e confere respostas e erros.
