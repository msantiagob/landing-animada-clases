#!/bin/bash

# Script de construcción para producción
set -e

echo "🏗️  Construyendo aplicación para producción..."

# Verificar que estamos en el directorio correcto
if [ ! -f "astro.config.ts" ]; then
    echo "❌ Error: No se encontró astro.config.ts"
    echo "Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Limpiar builds anteriores
echo "🧹 Limpiando builds anteriores..."
rm -rf dist/
rm -rf node_modules/.astro/

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci --production=false

# Verificar configuración
echo "🔧 Verificando configuración..."
if [ ! -f ".env.production" ]; then
    echo "❌ Error: No se encontró .env.production"
    echo "Copia .env.production.example y configura las variables"
    exit 1
fi

# Ejecutar checks
echo "🔍 Ejecutando checks..."
npm run check:astro || {
    echo "❌ Error en check de Astro"
    exit 1
}

npm run check:eslint || {
    echo "⚠️  Advertencia: Errores de ESLint encontrados"
    echo "Ejecuta 'npm run fix:eslint' para corregir automáticamente"
}

npm run check:prettier || {
    echo "⚠️  Advertencia: Errores de formato encontrados"
    echo "Ejecuta 'npm run fix:prettier' para corregir automáticamente"
}

# Construir la aplicación
echo "🚀 Construyendo aplicación..."
NODE_ENV=production npm run build

# Verificar que la construcción fue exitosa
if [ ! -d "dist" ]; then
    echo "❌ Error: La construcción falló"
    exit 1
fi

# Mostrar información de la construcción
echo "✅ Construcción completada exitosamente"
echo ""
echo "📊 Información de la construcción:"
echo "   - Directorio: ./dist/"
echo "   - Tamaño: $(du -sh dist/ | cut -f1)"
echo "   - Archivos: $(find dist/ -type f | wc -l)"
echo ""
echo "🚀 Para ejecutar en producción:"
echo "   node ./dist/server/entry.mjs"
echo ""
echo "🐳 Para desplegar con Docker:"
echo "   ./deploy.sh"