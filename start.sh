#!/bin/bash

# Script de inicio para producción
echo "🚀 Iniciando aplicación en producción..."

# Cargar variables de entorno
export NODE_ENV=production
export PORT=${PORT:-3000}

# Verificar que exista la base de datos
if [ ! -f "./database.sqlite" ]; then
    echo "⚠️  Base de datos no encontrada, se creará automáticamente al iniciar"
fi

# Iniciar la aplicación
echo "🌟 Iniciando servidor en puerto $PORT..."
node ./dist/server/entry.mjs