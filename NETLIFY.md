# Despliegue en Netlify

## 1. Cómo se despliega

`git push` y Netlify hace el resto:

1. Instala dependencias y ejecuta `npm run build` (`netlify.toml`: Node 22, publica `dist/`).
2. Publica como archivos estáticos las páginas prerenderizadas (el blog) y los assets, y las redirecciones de `src/data/legacy-redirects.ts` como reglas de Netlify (`_redirects`).
3. Publica una función serverless (`Astro SSR`) con el resto del sitio y la API (`/api/*`, `/admin/*`).

La rama de producción es la que tengas configurada en Netlify. Los deploy previews y los branch deploys usan un store de Blobs aparte, atado al deploy (ver sección 4): sus leads de prueba nunca se mezclan con los reales.

## 2. Variables de entorno

Se definen en Netlify: **Project configuration > Environment variables** (o `netlify env:set NOMBRE valor`).

| Variable                     | ¿Obligatoria?    | Para qué sirve                                                                       |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `ADMIN_EMAIL`                | Solo para /admin | Correo del único administrador. No distingue mayúsculas.                             |
| `ADMIN_PASSWORD_HASH`        | Solo para /admin | Hash de su contraseña (sección 3). Nunca la contraseña en texto plano.               |
| `SESSION_SECRET`             | Solo para /admin | Firma las cookies de sesión. Mínimo 32 caracteres: `openssl rand -hex 32`.           |
| `SMTP_HOST`                  | No               | Servidor de correo. Con `SMTP_USER` y `SMTP_PASS` activa los avisos de leads nuevos. |
| `SMTP_PORT`                  | No               | Puerto SMTP (587 por defecto; con 465 usa TLS directo).                              |
| `SMTP_USER` / `SMTP_PASS`    | No               | Credenciales SMTP.                                                                   |
| `SMTP_FROM`                  | No               | Remitente de los avisos (por defecto, `SMTP_USER`).                                  |
| `CONTACT_NOTIFICATION_EMAIL` | No               | Dónde llegan los avisos (por defecto, `SMTP_USER`).                                  |

Notas:

- Marca `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` y `SMTP_PASS` como **Contains secret values**, y deja activo el scope **Functions** (por defecto están todos): la función lee las variables al ejecutarse.
- **Un cambio de variables solo se aplica con un deploy nuevo** (Deploys > Trigger deploy).
- No hace falta configurar nada de Netlify Blobs: Netlify inyecta el acceso en la función. `JWT_SECRET`, `DATABASE_PATH` y `PORT` (de la época de Railway) ya no se usan, y `NODE_ENV` no hace falta definirlo.

## 3. Contraseña del administrador

El hash se genera en tu máquina; la contraseña no se guarda en ningún archivo ni se acepta como argumento (quedaría en el historial del shell):

```bash
npm run hash-password
# Pide la contraseña dos veces, sin mostrarla (mínimo 12 caracteres).
# Imprime SOLO el hash; las instrucciones salen por la salida de errores.

pbpaste | node scripts/hash-password.mjs   # alternativa: la contraseña llega por la entrada estándar
```

Copia la línea completa (`scrypt:32768:8:3:...`) como valor de `ADMIN_PASSWORD_HASH` y haz un deploy. El formato no lleva `$`, así que ni Netlify ni un `.env` lo alteran. Para cambiar la contraseña, genera un hash nuevo y reemplaza el valor.

## 4. Dónde viven los leads

En **Netlify Blobs**, en el store `leads`. Persiste entre deploys y no es parte del repositorio.

| Clave                      | Contenido                                                                     |
| -------------------------- | ----------------------------------------------------------------------------- |
| `contact/<id>`             | Un contacto del formulario.                                                   |
| `appointment/<id>`         | Una cita agendada.                                                            |
| `slot/<yyyy-MM-dd>T<HHmm>` | El horario ocupado y la cita que lo tiene. Una cita cancelada libera el suyo. |

Los `<id>` son de 26 caracteres y ordenables por fecha de creación.

- **Producción:** el store `leads` del sitio.
- **Deploy preview y branch deploy:** un store atado al deploy, que Netlify borra con él.
- **`npm run dev`:** el adaptador emula Blobs en `.netlify/blobs-serve` (ignorado por git). Solo los tests usan memoria.

Para verlos en bruto: Netlify, **Data & Storage > Blobs** (store `leads`), o con la CLI: `netlify blobs:list leads --prefix contact/` y `netlify blobs:get leads contact/<id>`.

La documentación de Netlify Blobs no menciona copias de seguridad ni exportación automática: si necesitas un respaldo de los leads, expórtalos con la CLI.

## 5. Ver los leads en /admin

1. Entra en `/admin/login` con `ADMIN_EMAIL` y tu contraseña.
2. En `/admin/dashboard` están los totales (contactos, sin leer, citas, pendientes) y las tablas de **Contactos** y **Citas**, con un selector para cambiar el estado de cada una. Cancelar una cita libera su horario.
3. La sesión dura 7 días. Cambiar `SESSION_SECRET` cierra todas las sesiones; cambiar `ADMIN_EMAIL` cierra la del administrador anterior.

## 6. El sitio público funciona sin las variables del panel

- Sin `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` o `SESSION_SECRET`: solo `/admin` queda cerrado. El login responde 503 y el log dice qué variable falta (nunca su valor). Formularios, citas, blog y `/api/health` siguen funcionando y guardando leads.
- Sin SMTP: los leads se guardan igual; solo se omite el aviso por correo.
- Si Netlify Blobs falla: los formularios responden 503 en vez de guardar en memoria en silencio, y `/api/health` también.

## 7. Después del primer deploy

```bash
curl -s https://sonmyd.co/api/health      # {"status":"healthy","storage":"netlify-blobs","scope":"site",...}
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/             # 200
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/blog         # 200, sin redirección
curl -s -o /dev/null -w "%{http_code}\n" https://sonmyd.co/blog/        # 301 a /blog
```

`/blog` tiene que dar 200 sin saltos: el sitio usa `build.format: 'file'` para que Netlify sirva `blog.html` en la URL sin barra final, que es la del canonical y el sitemap (`tests/build.format.test.ts` explica por qué). No desactives **Pretty URLs** en Post processing.

### Dominio y Search Console

- `sonmyd.co` es el dominio principal. Añádelo en **Domain management** y comprueba el DNS con `dig +short sonmyd.co`.
- Un dominio solo puede estar en un sitio de Netlify. Si sigue asignado al proyecto anterior (`venerable-druid-0b7175`, repositorio `msantiagob/landing-animada-clases`), quítalo de allí primero. Las URLs de ese sitio (`/agendar`, `/servicios/...`, `/en/...`) ya redirigen con 301 desde `src/data/legacy-redirects.ts`.
- Search Console: da de alta `https://sonmyd.co`, copia el token de la etiqueta HTML en `src/config.yaml` > `site.googleSiteVerificationId`, despliega, verifica y envía `https://sonmyd.co/sitemap-index.xml`.

## Notas de operación

- El límite de envíos de los formularios y del login es **por instancia** de la función: frena a un bot que insiste, pero no es un límite global exacto.
- Una sesión no se puede revocar de forma individual; si se filtra una cookie, cambia `SESSION_SECRET`.
