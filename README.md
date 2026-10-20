# Lucro Primeira Mordida

## Como rodar o banco de dados (Docker + Prisma)

Tempo estimado: 10 minutos. Siga na ordem, sem pular passos.

### O que instalar antes (uma vez só)

- **Docker Desktop** – https://www.docker.com/products/docker-desktop
- **Node.js (versão LTS)** – https://nodejs.org
- **Git** – https://git-scm.com

---

### Passo a passo

**1. Baixe o projeto**
```
git clone https://github.com/GuGaEgito/lucro-primeira-mordida.git
cd lucro-primeira-mordida
```

**2. Abra o Docker Desktop** e espere ele ficar com o status **"Engine running"** (ícone verde, canto inferior esquerdo). Sem isso nada funciona.

**3. Crie o arquivo `.env` da raiz**
```
copy .env.example .env
```
Abra o `.env` e troque **apenas** `POSTGRES_PASSWORD` por uma senha sua (só letras e números) e o `JWT_SECRET` por qualquer texto longo. Não mexa em mais nada.

**4. Suba o banco de dados**
```
docker compose up -d --build db
```
Na primeira vez demora alguns minutos (baixa o PostgreSQL). Depois confira:
```
docker compose ps
```
Na coluna STATUS deve aparecer **healthy** (se aparecer "starting", espere uns 10 segundos e rode de novo).

**5. Configure o Prisma**
```
cd backend
copy .env.example .env
```
Abra o `backend/.env` e troque `COLE_AQUI_A_SENHA` pela **mesma senha** que você colocou no passo 3.

**6. Instale as dependências e crie as tabelas** (ainda dentro da pasta `backend`)
```
npm install
npx prisma migrate deploy --config prisma7.config.ts
```
Deve terminar com a mensagem `All migrations have been successfully applied`.

**7. Confirme que deu certo** (volte para a raiz)
```
cd ..
docker compose exec db psql -U salgado -d casa_do_salgado -c "\dt"
```
Devem aparecer **6 tabelas**: `_prisma_migrations`, `custo_fixo`, `historico_custo_insumo`, `ingredientes`, `produtos` e `usuario`.

Pronto, o banco está rodando.

---

### Comandos do dia a dia

| O que fazer | Comando (na raiz do projeto) |
|---|---|
| Ligar o banco | `docker compose up -d db` |
| Desligar o banco (mantém os dados) | `docker compose stop` |
| Ver se está rodando | `docker compose ps` |
| Ver mensagens de erro do banco | `docker compose logs db` |
| **Apagar tudo e recomeçar do zero** | `docker compose down -v` e depois repetir os passos 4 e 6 |

> Depois de um `git pull` que traga mudanças no banco (pasta `backend/prisma/migrations`), rode de novo, dentro de `backend`: `npx prisma migrate deploy --config prisma7.config.ts`

---

### Problemas comuns

**"The variable is not set. Defaulting to a blank string"**
Falta o arquivo `.env` na raiz, ou ele está com o nome errado. No Windows o Bloco de Notas pode salvar como `.env.txt`. Rode `dir /a` e confira se existe `.env` (sem `.txt`). Refaça o passo 3.

**"error during connect" / "cannot connect to the Docker daemon" / "pipe docker_engine"**
O Docker Desktop está fechado ou ainda iniciando. Abra o programa e espere o "Engine running". Se ele nem abre, ative a virtualização na BIOS e o WSL 2 (o próprio Docker Desktop costuma mostrar o aviso).

**"ports are not available ... 5433" / "bind: acesso proibido"**
Outro programa (geralmente um PostgreSQL instalado no Windows) já usa essa porta. Abra o `.env` da raiz e mude `DB_PORT=5433` para `DB_PORT=5434`. Depois **mude o mesmo número no `DATABASE_URL` do `backend/.env`** e rode:
```
docker compose down
docker compose up -d --build db
```

**Erro `P1000: Authentication failed`**
A senha do `backend/.env` é diferente da senha do `.env` da raiz. Deixe as duas iguais. Se você trocou a senha da raiz depois de já ter subido o banco, o banco guardou a antiga: rode `docker compose down -v`, suba de novo (passo 4) e refaça o passo 6.

**Erro `P1001: Can't reach database server`**
O banco não está ligado ou a porta está diferente. Rode `docker compose ps` (precisa estar `healthy`) e confira se a porta do `backend/.env` é a mesma do `DB_PORT` da raiz.

**`Cannot find module 'dotenv'`**
Dentro da pasta `backend`, rode `npm install` e tente de novo. Se continuar, rode `npm install dotenv`.

**`No migration found in prisma/migrations`**
A pasta `backend/prisma/migrations` não veio no download. Rode `git pull` e confira se ela existe.

**O banco subiu, mas a lista de tabelas está vazia**
O passo 6 não foi executado ou falhou. Rode-o de novo e leia a mensagem que aparece.

**Nada resolveu**
Rode `docker compose down -v`, apague o `backend/.env`, e refaça tudo a partir do passo 3. Se ainda assim falhar, mande no grupo o texto completo do erro.