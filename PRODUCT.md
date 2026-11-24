# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite na pasta `frontend/`, rodando em `http://localhost:5173` (origem já liberada no `CORS_ORIGIN` do back). Confirmado pelo usuário. Consome a API REST de `Back/` (Node 22 + Express + Prisma + PostgreSQL) em `http://localhost:3000`.

## Users

- **Gestor** da Casa do Salgado: cadastra ingredientes, produtos (receitas/fichas técnicas), custos fixos e usuários; decide o preço de venda de cada salgado.
- **Funcionário**: consulta ingredientes e produtos e usa os cálculos (preço, margem, simulações). Não cria, altera nem apaga cadastros.
- Usam principalmente no **computador** (confirmado).

## Product Purpose

Sistema interno de precificação e fichas técnicas da Casa do Salgado. A partir da receita de cada salgado, dos custos dos ingredientes e dos custos fixos do mês, mostra quanto custa cada unidade, qual preço sugerir, qual a margem e o lucro, quanto precisa vender para empatar (ponto de equilíbrio) e o efeito de reajustes de ingredientes. Sucesso é o gestor saber, salgado por salgado, se está tendo lucro ou prejuízo e qual preço cobrar.

## Positioning

Precificação feita sobre a receita real de cada salgado (ingrediente por ingrediente, com fator de correção e conversão de unidades), pelo método de markup divisor do SEBRAE, com contas em centavos exatos. Não é um PDV nem uma loja virtual.

## Operating Context

- Rotina da salgaderia: compra de insumos que mudam de preço, receitas com rendimento (ex.: 40 coxinhas), custos fixos mensais (aluguel, energia, gás, salários).
- Login por nome e senha; token vale 8h. `401` volta para o login, `403` significa que o cargo não pode fazer a ação.
- Percentuais de 0 a 100; valores em dinheiro voltam da API como texto e precisam ser formatados em reais (R$ 1,10).

## Capabilities and Constraints

- Rotas: `/api/auth/login`, `/api/auth/eu`, `/api/ingredientes` (+ `/:id/historico`), `/api/produtos` (+ `/:id/precificacao`, `/:id/ativo`), `/api/custos-fixos`, `/api/usuarios`, e 9 cálculos em `/api/calculos/...` (ficha técnica, custos fixos, markup, preço sugerido, análise de preço, ponto de equilíbrio, mix, resultado mensal, reajuste).
- Unidades: KG, G, L, ML, UN (só converte dentro do mesmo grupo).
- Erros no formato `{ codigo, erro, detalhes? }`.
- Ainda não há logo (decisão adiada pelo usuário).

## Brand Commitments

- Nome exibido: **A Casa do Salgado**.
- Referência de estrutura e acabamento indicada pelo usuário: elevaremarket.com (barra de aviso, menu, banner de abertura, atalhos em círculo, faixas de cards, seção de "padrão", rodapé), adaptada às funções do sistema.
- O usuário aceitou uma paleta rosada/terracota e uma fonte de título com serifa, pedindo também uma identidade própria que remeta a salgados.
- Logo: a definir depois. Não inventar um logotipo definitivo.

## Evidence on Hand

- Nenhum dado real de vendas, clientes ou cardápio foi fornecido. Exemplos de demonstração (coxinha, esfiha etc.) vêm do README do back e devem ser tratados como dados de exemplo.
- Sem fotos próprias.

## Product Principles

1. Lucro ou prejuízo de cada salgado tem que estar claro de relance.
2. Dinheiro sempre em reais formatados, nunca o texto cru da API.
3. O funcionário vê o que pode usar; ações de gestor só aparecem para o gestor.
4. Toda conta mostra de onde veio (custo, percentuais, rendimento).

## Accessibility & Inclusion

Uso em computador por pessoas sem formação técnica: textos em português simples, contraste legível e navegação por teclado.
