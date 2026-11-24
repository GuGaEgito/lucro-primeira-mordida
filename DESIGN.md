# Design: A Casa do Salgado

Mundo: **padaria de bairro antiga**. Parede de tijolo terracota, reboco rosado, balcão claro, dourado de massa frita e verde de azulejo. Tela de trabalho (Operate): primeiro a tarefa, depois o mundo.

Fonte da verdade: `frontend/src/estilos/app.css` (tokens em `:root`).

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--tijolo` | `#9e4630` | Cabeçalho, botão principal, títulos de destaque |
| `--tijolo-escuro` | `#7a3322` | Hover do botão principal |
| `--reboco` | `#f6e9e4` | Fundo da página |
| `--reboco-fundo` | `#efdcd5` | Abertura do painel, abas |
| `--balcao` | `#fffbf8` | Superfícies (cards, tabelas, gavetas) |
| `--rejunte` / `--rejunte-forte` | `#e6d3cb` / `#d2b8ad` | Linhas, bordas, argamassa da fileira |
| `--dourado` | `#d99a2b` | Faixa sob o cabeçalho, foco, despesas |
| `--azulejo` | `#2e6b55` | Lucro, "dá lucro" |
| `--prejuizo` | `#b3261e` | Prejuízo, erros |
| `--tinta` / `--tinta-2` / `--tinta-3` | `#3b2420` / `#6b4d45` / `#8b6d64` | Texto principal, secundário, auxiliar |
| `--forno` | `#2a1915` | Barra de aviso e rodapé |

Partes do preço (fileira de tijolos): ingredientes `#b85a3e`, custo fixo `#e3a895`, despesas `#d99a2b`, lucro `#2e6b55`, falta (prejuízo) listrado vermelho.

## Tipografia

- **Títulos:** Young Serif 400 (letreiro antigo), com a segunda linha em `--tijolo` ("Os salgados / da vitrine").
- **Texto e números:** Public Sans (variável). Dinheiro sempre com `tabular-nums`; resultados grandes em Public Sans 650, nunca na serifa (os números antigos da serifa desalinham centavos).

## Assinatura: a fileira de tijolos

`FileiraTijolos.jsx`. O preço de um salgado vira uma fileira: cada tijolo é uma parte do preço, com largura proporcional. Quando os custos passam do preço, a fileira passa da linha do preço e o excesso fica listrado em vermelho ("Falta R$ x"). Aparece no card de cada salgado, na vitrine do painel, na ficha técnica, nos cálculos e no login (exemplo). No reajuste, antes e depois ficam na mesma escala.

## Estrutura (inspirada na Elevare)

Barra de aviso escura → cabeçalho de tijolo com submenu largo de cálculos → abertura em duas colunas (título + contagem / vitrine) → atalhos em círculo → faixas que rolam para o lado com setas → seção "O padrão da Casa" → rodapé escuro em quatro colunas. Formulários abrem numa gaveta à direita (como o carrinho da referência).

## Componentes

- Botões em pílula: principal (tijolo), secundário (contorno), fantasma, perigo.
- Selos: dá lucro (azulejo), abaixo da meta (dourado), prejuízo (vermelho), neutro.
- Campos com prefixo `R$` e sufixos `%` / `un`; campos desabilitados ficam no tom do reboco.
- Raio 10px nas superfícies, 6px nos campos. Sombra suave com deslocamento.
- Movimento: só o assentamento dos tijolos (0,7s, ease-out exponencial) e a entrada da gaveta; respeita `prefers-reduced-motion`.
