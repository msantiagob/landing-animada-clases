#!/bin/bash

# Script de despliegue para producción
set -e

echo "🚀 Iniciando despliegue en producción..."

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p data ssl

# Verificar variables de entorno
if [ ! -f ".env.production" ]; then
    echo "❌ Error: No se encontró el archivo .env.production"
    echo "Copia .env.production.example y configura las variables"
    exit 1
fi

# Cargar variables de entorno
export $(cat .env.production | grep -v '^#' | xargs)

# Validar JWT_SECRET
if [ "$JWT_SECRET" == "your-super-secret-production-jwt-key-change-this-immediately" ]; then
    echo "❌ Error: Debes cambiar JWT_SECRET en .env.production"
    exit 1
fi

# Generar certificados SSL auto-firmados si no existen
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo "🔒 Generando certificados SSL auto-firmados..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=ES/ST=Madrid/L=Madrid/O=Sonmyd/CN=localhost"
    echo "⚠️  IMPORTANTE: Usar certificados válidos en producción real"
fi

# Construir la imagen
echo "🏗️  Construyendo imagen Docker..."
docker-compose build --no-cache

# Detener servicios existentes
echo "🛑 Deteniendo servicios existentes..."
docker-compose down

# Iniciar servicios
echo "🌟 Iniciando servicios..."
docker-compose up -d

# Verificar que los servicios estén corriendo
echo "🔍 Verificando servicios..."
sleep 10

if docker-compose ps | grep -q "Up"; then
    echo "✅ Servicios iniciados correctamente"
    echo ""
    echo "📊 Estado de los servicios:"
    docker-compose ps
    echo ""
    echo "🌐 Aplicación disponible en:"
    echo "   - HTTP:  http://localhost"
    echo "   - HTTPS: https://localhost"
    echo "   - Admin: https://localhost/admin/login"
    echo ""
    echo "📋 Para ver los logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Para detener:"
    echo "   docker-compose down"
else
    echo "❌ Error: Los servicios no se iniciaron correctamente"
    echo "Ver logs con: docker-compose logs"
    exit 1
fi