# Front-end da Casa do Salgado

React + Vite. Conversa com a API da pasta `Back/`.

## Como rodar (desenvolvimento)

1. Ligue o banco e a API (veja o README da raiz). A API precisa estar em `http://localhost:3000`.
2. Nesta pasta:

```
npm install
npm run dev
```

3. Abra `http://localhost:5173` e entre com um usuário criado pelo `npm run criar-gestor` do back.

O Vite repassa tudo que começa com `/api` para `http://localhost:3000`, então não precisa mexer no CORS.
Se a API estiver em outra porta: `VITE_API_PROXY=http://localhost:3001 npm run dev`.

## Pelo Docker

Na raiz: `docker compose up -d --build`. O site fica em `http://localhost:8080` e o nginx repassa `/api` para o container do back.

## Telas

| Rota | O que faz |
|---|---|
| `/entrar` | Login (nome e senha) |
| `/` | Painel: salgados no prejuízo, vitrine do salgado que precisa de atenção, atalhos, faixa dos salgados, ingredientes mexidos por último |
| `/produtos` | Todos os salgados, com filtro por situação (lucro, abaixo da meta, prejuízo, sem preço) |
| `/produtos/novo`, `/produtos/:id` | Ficha técnica: receita, rendimento, preço, e o preço calculado ao vivo |
| `/ingredientes` | Cadastro de ingredientes e histórico de custo |
| `/custos-fixos` | Custos fixos do mês e o peso deles no faturamento |
| `/calculos?c=...` | Preço sugerido, conferir preço, markup, resultado do mês, ponto de equilíbrio, reajuste |
| `/usuarios` | Só gestor: cadastrar, desativar e reativar usuários |

O funcionário vê tudo, mas sem os botões de criar, alterar e apagar (o back também bloqueia).

## Dados do mês

Faturamento mensal, % de despesas variáveis e meta de lucro **não ficam no banco**: o gestor informa em "Dados do mês" e o navegador guarda (`localStorage`). Sem o faturamento, o sistema não consegue calcular o % de custo fixo nem o preço sugerido.

## Pastas

```
src/
├── api/cliente.js           Chamadas à API, token e tratamento do 401
├── auth/Autenticacao.jsx    Quem está logado e o cargo
├── componentes/
│   ├── FileiraTijolos.jsx   O preço desenhado como fileira de tijolos
│   ├── Layout.jsx           Barra de aviso, cabeçalho com submenu, rodapé
│   ├── Salgados.jsx         Card do salgado, faixa com setas, dados do mês
│   └── ui.jsx               Gaveta, campos, alertas, selos, carregando
├── paginas/                 Uma tela por arquivo
├── util/                    Formatação em reais, dados do mês, resumo dos salgados
└── estilos/app.css          Cores, fontes e todos os estilos
```

A identidade visual está descrita em `DESIGN.md`, na raiz.
