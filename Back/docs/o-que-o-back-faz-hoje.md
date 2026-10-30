# O que o back-end faz hoje

> 📌 **Atualização:** Para o histórico recente e diário de implementação (incluindo as rotas CRUD de ingredientes e produtos), consulte o [Diário de Bordo](./diario-de-bordo.md).

Retrato do código da `main` em `Back/` em 29/10/2026 (commit a7af662, depois do PR #5), atualizado em 30/10/2026 com o login, os tokens e as permissões (seção "Login, tokens e permissões") e com a ficha técnica do Guilherme. Em 30/10 os testes rodaram: 34 de 34 passam.

## Resumo em uma frase

O back é uma **calculadora pela internet** (o front manda os números em JSON, o back faz a conta e devolve o resultado) e, desde 29-30/10, também **cadastra ingredientes, produtos com receita e usuários no banco**. Para usar qualquer rota é preciso **fazer login** e mandar o token; o que cada pessoa pode fazer depende do cargo (GESTOR ou FUNCIONARIO).

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

## Login, tokens e permissões

### Como funciona, passo a passo

1. O usuário manda `POST /api/auth/login` com `{ "nome": "Luiz", "senha": "12345" }`.
2. O back procura o usuário pelo `nome` (que é único no banco), confere se ele está `ativo` e compara a senha digitada com o hash guardado (biblioteca `bcryptjs`). A senha **nunca** fica salva em texto: no banco ela aparece como `$2b$10$...`, com 60 caracteres.
3. Se estiver tudo certo, o back responde `{ "token": "eyJ...", "usuario": { "id": 1, "nome": "Luiz", "cargo": "GESTOR" } }`.
4. O front guarda esse token e manda em **todas** as outras requisições, no cabeçalho `Authorization: Bearer <token>`.
5. Antes de cada rota, o back confere o token (middleware `autenticar`) e, nas rotas de escrita, o cargo (middleware `exigirCargo("GESTOR")`).

### O que tem dentro do token

O token é um **JWT** (biblioteca `jsonwebtoken`) com três partes separadas por ponto: cabeçalho, conteúdo e assinatura. Decodificado, o do Luiz fica assim:

```json
{ "alg": "HS256", "typ": "JWT" }
{ "cargo": "GESTOR", "sub": "1", "iat": 1793403129, "exp": 1793431929 }
```

- `sub` é o id do usuário e `cargo` é o cargo dele. **Não leva nome nem senha.**
- `iat` é quando foi criado e `exp` quando vence. Por padrão o token vale **8 horas** (variável `JWT_EXPIRES_IN`), um turno de trabalho. Depois disso é preciso logar de novo.
- A assinatura é feita com a variável secreta `JWT_SECRET` (fica no `.env`, nunca no git). Qualquer um consegue **ler** o conteúdo do token, mas ninguém consegue **mudar** sem o segredo: se alguém trocar o `cargo` ou o `sub`, a assinatura não bate e o back responde 401.
- O servidor não sobe se `JWT_SECRET` não estiver definida.

### Rotas de login e usuários

| Método | Rota | Quem pode | O que faz |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | qualquer um | Confere nome e senha e devolve o token. |
| GET | `/api/auth/eu` | logado | Devolve `id`, `nome`, `cargo` e `ativo` de quem está logado. O front usa para saber quais botões mostrar. |
| GET | `/api/usuarios` | GESTOR | Lista os usuários (sem a senha). |
| POST | `/api/usuarios` | GESTOR | Cadastra `{ nome, senha, cargo }`. Senha com pelo menos 5 caracteres. Nome repetido → 409 `CONFLITO`. |
| PATCH | `/api/usuarios/:id/ativo` | GESTOR | Ativa ou desativa (`{ "ativo": false }`). Desativado não consegue logar. |

O **primeiro gestor** é criado pelo terminal, dentro de `Back/`: `npm run criar-gestor -- Luiz 12345`.

### Quem pode o quê

| Rota | Sem login | FUNCIONARIO | GESTOR |
| --- | --- | --- | --- |
| `/health`, `/api/docs`, `/api/openapi.json`, `POST /api/auth/login` | sim | sim | sim |
| `GET /api/auth/eu`, `POST /api/calculos/*` | não | sim | sim |
| `GET` de ingredientes e produtos | não | sim | sim |
| `POST`, `PUT`, `PATCH`, `DELETE` de ingredientes e produtos | não | não (403) | sim |
| `/api/usuarios` | não | não (403) | sim |

Ou seja: o funcionário consulta e simula; quem mexe em custo, preço, receita e usuários é o gestor.

### Histórico de custo

Quando o gestor muda o `custoUnitario` de um ingrediente (`PUT /api/ingredientes/:id`), o back grava em `historico_custo_insumo` o custo anterior, o novo e o **id de quem mudou** (tirado do token). O update e o histórico são gravados juntos numa transação: ou entram os dois, ou nenhum.

### Testar no Swagger

Abra `http://localhost:3000/api/docs`, rode `POST /api/auth/login`, copie o `token`, clique em **Authorize** e cole. A partir daí todas as rotas do Swagger vão com o token.

### Limites conhecidos

- Desativar um usuário bloqueia **novos** logins, mas o token que ele já tem continua valendo até vencer (no máximo 8h). Se for preciso cortar na hora, o `autenticar` pode consultar o banco a cada requisição.
- Pelo mesmo motivo, uma mudança de cargo só vale a partir do próximo login.
- Não há rota de logout nem de renovação do token: para "sair", o front apaga o token que guardou.
- Não há limite de tentativas de login.

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
| `NAO_AUTENTICADO` | 401 | Sem token, token alterado ou vencido. O front deve voltar para a tela de login. |
| `CREDENCIAIS_INVALIDAS` | 401 | Login com nome ou senha errados, ou usuário desativado (a mesma mensagem para tudo, para não revelar quais nomes existem). |
| `SEM_PERMISSAO` | 403 | Logado, mas o cargo não pode fazer aquilo (ex.: funcionário tentando criar ingrediente). |
| `NAO_ENCONTRADO` | 404 | Ingrediente, produto ou usuário com aquele id não existe. |
| `CONFLITO` | 409 | Nome repetido, ou ingrediente em uso que não pode ser apagado. |
| `ROTA_NAO_ENCONTRADA` | 404 | Endereço que não existe. |
| `ERRO_INTERNO` | 500 | Qualquer outro problema. O detalhe só aparece no console do servidor. |

## O que o banco tem

PostgreSQL, descrito no `prisma/schema.prisma` e criado por quatro migrations. Todas as datas são gravadas com fuso horário.

| Tabela | Colunas principais | Para que serve |
| --- | --- | --- |
| `usuario` | nome (único, usado no login), cargo (GESTOR ou FUNCIONARIO), senha (hash bcrypt), ativo, criado_em | Quem usa o sistema. |
| `ingredientes` | nome (único), unidade (KG, G, L, ML, UN), custo_unitario (4 casas), atualizado_em | Os insumos e quanto custam. |
| `produtos` | nome, rendimento, preco_venda, ativo, atualizado_em | Os salgados à venda. |
| `produto_ingredientes` | produto_id, ingrediente_id, quantidade, unidade_receita | A receita (ficha técnica) de cada salgado. |
| `custo_fixo` | nome (único), valor_mensal, atualizado_em | Aluguel, energia, gás, salários. |
| `historico_custo_insumo` | insumo_id, custo_anterior, custo_novo, usuario_id, alterado_em | Registro de cada mudança de preço de ingrediente e de quem mudou. |

O banco também bloqueia valores negativos em custo, preço e valor mensal (regras CHECK) e tem índices para buscar o histórico rápido.

Desde 30/10 cada salgado guarda a receita inteira em `produto_ingredientes` (vários ingredientes por produto, com quantidade e unidade), e não mais um único `ingredientes_id`.

## O que ainda NÃO faz

1. **Rotas de custos fixos no banco.** As rotas de `ingredientes`, `produtos` e `usuarios` já foram criadas (ver [Diário de Bordo](./diario-de-bordo.md)), restando ainda os endpoints para custos fixos.
2. ~~Falta a tabela produto x ingrediente.~~ Feito em 30/10 pelo Guilherme: `produto_ingredientes` e o campo `rendimento` (ver [Diário de Bordo](./diario-de-bordo.md)).
3. **Falta a avaliação "rentável ou não".** A análise de preço devolve os números (margem, lucro, CMV), mas não diz "este salgado dá lucro", "está no limite" ou "dá prejuízo".
4. ~~O histórico de custo não é preenchido.~~ Feito em 30/10: o `PUT /api/ingredientes/:id` grava a mudança de custo com o usuário logado.
5. ~~Não tem login nem permissão.~~ Feito em 30/10: login com JWT (`POST /api/auth/login`), FUNCIONARIO só consulta e calcula, GESTOR cria, altera e apaga. Veja "Login e permissões" no `Back/README.md`.
6. ~~**Falta o adaptador do Prisma 7.**~~ Concluído: `@prisma/adapter-pg` instalado e configurado em `src/shared/prisma.js`.
7. A pasta `src/modules/ingredientes/` está vazia, só reservada.

## Testes

`npm test` roda 34 testes em três arquivos: `tests/calculos.test.js` testa as fórmulas, `tests/api.test.js` chama as rotas de verdade (com supertest, já mandando um token) e confere respostas e erros, e `tests/autenticacao.test.js` confere o login sem precisar de banco: sem token (401), token alterado, de outro segredo ou vencido (401), funcionário em rota de gestor (403) e gestor passando.
