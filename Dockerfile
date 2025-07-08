# Dockerfile para aplicación AstroWind en producción
FROM node:20-alpine AS base

# Instalar dependencias para SQLite
RUN apk add --no-cache sqlite

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias (incluyendo dev dependencies para build)
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Limpiar dev dependencies después del build
RUN npm prune --production

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S astro -u 1001

# Crear directorio para base de datos con permisos
RUN mkdir -p /app/data && chown -R astro:nodejs /app/data

# Cambiar a usuario no-root
USER astro

# Exponer puerto
EXPOSE 3000

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/database.sqlite

# Comando de inicio
CMD ["node", "./dist/server/entry.mjs"]
# Comando de inicio
