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
