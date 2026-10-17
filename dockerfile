# Banco de dados - PostgreSQL (mesma major version do provedor em nuvem, se possível)
FROM postgres:16-alpine

# Fuso horário de Brasília (criado_em / atualizado_em / alterado_em)
ENV TZ=America/Sao_Paulo
ENV PGTZ=America/Sao_Paulo
RUN apk add --no-cache tzdata

# Scripts .sql desta pasta rodam em ordem alfabética, UMA ÚNICA VEZ,
# quando o volume de dados está vazio (primeira subida do container).
COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432