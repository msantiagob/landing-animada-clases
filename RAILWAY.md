# Despliegue en Railway

## 1. Crear el servicio

Railway detecta `railway.json` y construye con el `Dockerfile`.

## 2. Volumen persistente (OBLIGATORIO)

Sin esto se pierden todos los leads en cada deploy, porque el sistema de
archivos del contenedor se reemplaza junto con la imagen.

- Mount path: `/app/data`

## 3. Variables de entorno

| Variable | Obligatoria | Valor |
|---|---|---|
| `JWT_SECRET` | Sí | `openssl rand -hex 32` (mínimo 32 caracteres) |
| `DATABASE_PATH` | Sí | `/app/data/database.sqlite` |
| `NODE_ENV` | Sí | `production` |
| `PORT` | No | Railway la inyecta |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | No | Notificaciones por email |
| `SMTP_FROM` | No | Remitente de los avisos |
| `CONTACT_NOTIFICATION_EMAIL` | No | Dónde llegan los leads |

Sin SMTP el sitio funciona igual: los leads se guardan en la base y solo se
omite el aviso por correo.

## 4. Crear el usuario administrador

Una sola vez, desde la consola del servicio en Railway:

```bash
ADMIN_EMAIL=vos@sonmyd.com ADMIN_PASSWORD='una-password-larga-y-random' node scripts/create-admin.mjs
```

No existe registro público. El mismo comando sirve para cambiar la contraseña.

## 5. Healthcheck

Ya configurado en `railway.json` apuntando a `/api/health`, que verifica el
proceso y la conexión a la base.

## Notas de operación

- **Una sola réplica.** El rate limit vive en memoria del proceso y SQLite
  escribe en un único volumen. Escalar a varias réplicas rompe ambas cosas.
- **Backup.** El archivo está en `/app/data/database.sqlite`. Copialo
  periódicamente desde la consola del servicio.

## 6. Después del despliegue: puesta en marcha del SEO

El sitio no aparece en Google por existir. Estos cuatro pasos son manuales y
son la Fase 0 del plan de SEO: sin ellos, todo el contenido publicado es
invisible para el buscador.

### 6.1 Dominio principal: sonmyd.co

**Decisión tomada**: `sonmyd.co` es el dominio principal, no `sonmyd.com`.

El motivo es que `sonmyd.co` ya está indexado y tiene autoridad acumulada.
Empezar de cero en otro dominio habría significado tirar esa antigüedad a la
basura y competir contra uno mismo desde dos dominios, que es la forma más
cara de la canibalización de keywords.

> **Atención antes del corte**: hoy `sonmyd.co` sirve OTRO sitio, desplegado en
> Netlify desde el repositorio `msantiagob/landing-animada-clases` (proyecto
> `venerable-druid-0b7175`). Apuntar el dominio a Railway REEMPLAZA ese sitio.
> Ese sitio tiene páginas que este no tiene (`/agendar`, `/servicios`, y las
> versiones en inglés bajo `/en/`). Antes de cortar hay que decidir qué pasa
> con esas URLs: si no se redirigen, cada una pasa a devolver 404 y se pierde
> el posicionamiento que ya tenían.

`sonmyd.co` tiene que resolver al servicio de Railway. Verificalo con:

```bash
dig +short sonmyd.co A
```

Si no devuelve nada, el dominio no apunta a ningún lado y ningún rastreador
puede llegar. En Railway se agrega el dominio personalizado desde Settings >
Domains, y el registro se crea en tu proveedor de DNS.

### 6.2 Desconectar el auto-deploy de Netlify

El repositorio todavía está conectado al proyecto `portfolio-sonmyd` de
Netlify, que construye en cada push a `develop` y publica un sitio que
responde 404 en todas las rutas. El proyecto usa el adapter de **node**
(`astro.config.ts`), no el de Netlify: lo que genera no es un sitio estático
servible.

Un despliegue "ready" en verde sirviendo 404 es peor que ningún despliegue,
porque oculta el problema. Desconectá el repositorio desde el panel de Netlify
o eliminá el proyecto.

### 6.3 Google Search Console

1. Dar de alta la propiedad `https://sonmyd.co`.
2. Copiar el token de verificación (método "Etiqueta HTML").
3. Pegarlo en `src/config.yaml` → `site.googleSiteVerificationId`.
4. Desplegar y verificar.
5. Enviar `https://sonmyd.co/sitemap-index.xml`.

> El valor que traía la plantilla (`orcPxI47GSa-...`) era el de onwidget y
> nunca iba a verificar este dominio. El campo quedó vacío a propósito.

### 6.4 Comprobación posterior

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/clases-de-ia
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/api/health
```

Los tres tienen que devolver `200`. Si la raíz responde 404, el despliegue
está sirviendo el directorio equivocado.
