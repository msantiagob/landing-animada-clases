# Despliegue en Producción - AstroWind

## 📋 Resumen

Este proyecto está configurado para despliegue en producción con:
- **Docker** para containerización
- **Nginx** como proxy reverso
- **SSL/HTTPS** con certificados auto-firmados
- **Rate limiting** para seguridad
- **Health checks** para monitoreo
- **Landing pages** completamente funcionales

## 🚀 Despliegue Rápido

### 1. Configuración Inicial

```bash
# Clonar el proyecto
git clone <tu-repositorio>
cd astrowind

# Configurar variables de entorno
cp .env.production.example .env.production
```

### 2. Editar .env.production

```bash
# IMPORTANTE: Cambiar estas variables
JWT_SECRET=tu-jwt-secret-muy-seguro-aqui
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

### 3. Ejecutar Despliegue

```bash
# Hacer ejecutable el script
chmod +x deploy.sh

# Ejecutar despliegue
./deploy.sh
```

La aplicación estará disponible en:
- **HTTP**: http://localhost
- **HTTPS**: https://localhost
- **Admin**: https://localhost/admin/login

## 🔧 Comandos Disponibles

### Construcción Manual

```bash
# Construir para producción
./build-production.sh

# Ejecutar directamente
node ./dist/server/entry.mjs
```

### Gestión de Servicios

```bash
# Ver estado de servicios
docker-compose ps

# Ver logs
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Actualizar y reiniciar
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Monitoreo

### Health Check

```bash
# Verificar estado de la aplicación
curl http://localhost:3000/api/health

# Respuesta esperada:
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

### Logs

```bash
# Logs de la aplicación
docker-compose logs astrowind-app

# Logs de Nginx
docker-compose logs astrowind-nginx

# Logs en tiempo real
docker-compose logs -f
```

## 🔒 Seguridad

### Certificados SSL

Los certificados se generan automáticamente como auto-firmados. Para producción real:

```bash
# Obtener certificados de Let's Encrypt
certbot certonly --webroot -w /var/www/html -d tu-dominio.com

# Copiar certificados
cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem ssl/key.pem

# Reiniciar Nginx
docker-compose restart astrowind-nginx
```

### Rate Limiting

Configurado en nginx.conf:
- **API**: 10 req/s con burst de 20
- **Admin**: 5 req/s con burst de 10

### Variables de Entorno Seguras

```bash
# Generar JWT secret seguro
openssl rand -hex 32

# Actualizar en .env.production
JWT_SECRET=tu-nuevo-secret-generado
```

## 🗄️ Base de Datos

### Backup

```bash
# Crear backup
cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)

# Restaurar backup
cp data/database.sqlite.backup.20240120_103000 data/database.sqlite
docker-compose restart astrowind-app
```

### Migraciones

Las tablas se crean automáticamente al iniciar la aplicación.

## 🌐 Configuración de Dominio

### Nginx para Dominio Real

Editar `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... resto de configuración
}
```

### DNS

Configurar registros DNS:
- **A Record**: `tu-dominio.com` → `IP-DEL-SERVIDOR`
- **CNAME**: `www.tu-dominio.com` → `tu-dominio.com`

## 📱 Funcionalidades Incluidas

### Landing Pages
- ✅ Crear/editar/eliminar landing pages
- ✅ Múltiples plantillas disponibles
- ✅ Vista previa funcional
- ✅ SEO optimizado
- ✅ Analytics integrado

### Admin Panel
- ✅ Dashboard con estadísticas
- ✅ Gestión de formularios
- ✅ Gestión de citas
- ✅ Gestión de blog
- ✅ Gestión de emails

### Seguridad
- ✅ Autenticación JWT
- ✅ Rate limiting
- ✅ SSL/HTTPS
- ✅ Security headers
- ✅ CORS configurado

## 🔧 Troubleshooting

### Problemas Comunes

**Error: "Database connection failed"**
```bash
# Verificar permisos
ls -la data/
# Debe mostrar: drwxr-xr-x ... astro nodejs

# Recrear base de datos
rm data/database.sqlite
docker-compose restart astrowind-app
```

**Error: "JWT_SECRET not configured"**
```bash
# Verificar .env.production
grep JWT_SECRET .env.production
# Debe ser diferente del valor por defecto
```

**Error: "Port already in use"**
```bash
# Verificar procesos en puerto 3000
lsof -i :3000
# Matar proceso si es necesario
kill -9 <PID>
```

### Logs Útiles

```bash
# Logs de aplicación
docker-compose logs astrowind-app | grep ERROR

# Logs de Nginx
docker-compose logs astrowind-nginx | grep error

# Logs de base de datos
docker-compose exec astrowind-app ls -la data/
```

## 🚀 Despliegue en Servidor

### Requisitos del Servidor

- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **RAM**: 1GB mínimo
- **Storage**: 10GB mínimo

### Pasos en Servidor

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clonar proyecto
git clone <tu-repositorio>
cd astrowind

# Configurar y desplegar
cp .env.production.example .env.production
# Editar .env.production con valores reales
./deploy.sh
```

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs: `docker-compose logs`
2. Verificar configuración: `cat .env.production`
3. Comprobar estado: `docker-compose ps`
4. Health check: `curl http://localhost:3000/api/health`