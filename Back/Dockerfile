# Imagem do back-end (Node.js + Prisma). Usada pelo docker-compose.yml da raiz.
# A etapa "build" instala tudo (inclusive o Prisma CLI) e gera o Prisma Client;
# a final leva só as dependências de produção, o código e o client gerado.

# ---------- Etapa 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma7.config.js ./
COPY src ./src
COPY scripts ./scripts
# O generate não conecta no banco, mas o prisma7.config.js lê a DATABASE_URL.
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npm run prisma:generate

# ---------- Etapa "migracoes": aplica as migrations no banco e sai ----------
# O docker-compose roda esta etapa antes de subir a API.
FROM build AS migracoes
CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.js"]

# ---------- Etapa "dependencias": tira as dependências de desenvolvimento ----------
FROM build AS dependencias
RUN npm prune --omit=dev

# ---------- Etapa final: a API ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
# Não roda como root dentro do container.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
