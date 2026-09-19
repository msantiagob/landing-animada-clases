# --- Etapa de build -----------------------------------------------------------
# Debian slim en vez de Alpine: better-sqlite3 publica binarios precompilados
# para glibc. En Alpine (musl) tiene que compilar desde el código fuente, lo que
# exige python3 + build-base y hace el build mucho más lento y frágil.
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# --- Etapa de runtime ---------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
# Apunta al volumen persistente de Railway montado en /app/data.
# El valor anterior (/app/database.sqlite) vivía dentro de la imagen: cada
# deploy reemplaza la imagen, así que se perdían todos los leads.
ENV DATABASE_PATH=/app/data/database.sqlite

# gosu baja privilegios en el entrypoint conservando la señal de parada, cosa
# que `su` no hace: con `su` el proceso de Node queda como hijo y no recibe
# SIGTERM en el redeploy, así que el contenedor muere por timeout.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Arranca como root a propósito: el entrypoint ajusta el volumen montado y
# después ejecuta la aplicación como `node`.
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
