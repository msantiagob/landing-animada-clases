---
publishDate: 2026-10-01T00:00:00Z
title: 'Qué es n8n y para qué sirve: guía para automatizar procesos con IA'
excerpt: 'Qué es n8n, cómo funciona y cuándo conviene: nodos, webhooks, licencia fair-code, self-hosting con Docker, n8n Cloud, agentes de IA y un flujo paso a paso.'
image: ~/assets/images/seo/blog-que-es-n8n.jpg
category: Automatización
tags:
  - n8n
  - automatización
  - workflows
  - self-hosting
  - agentes de ia
author: Santiago Bedoya
metadata:
  title: 'Qué es n8n: guía para automatizar con flujos e IA'
  ignoreTitleTemplate: true
  description: 'Descubre qué es n8n, cómo funciona y para qué sirve: nodos, webhooks, licencia fair-code, self-hosting con Docker, n8n Cloud, agentes de IA y casos de uso.'
---

**n8n es una plataforma de automatización de flujos de trabajo (_workflow automation_) que conecta aplicaciones, APIs y modelos de IA mediante nodos en un editor visual.** Puedes instalarla en tu propio servidor o usarla como servicio en la nube (n8n Cloud), y combinar bloques visuales con código JavaScript o Python cuando la lógica lo pide. Su nombre se pronuncia «n-eight-n» y abrevia _nodemation_: node + automation. En esta guía vemos qué es n8n, cómo funciona y cuándo te conviene.

Si vienes de herramientas como Zapier o Make, la diferencia de fondo es esta: n8n te da más control sobre dónde corre, cuánto cuesta cuando el volumen crece y hasta dónde puedes llevar un flujo. A cambio, te pide un poco más de criterio técnico.

## Cómo funciona n8n: nodos, triggers y ejecuciones

Un **workflow** (flujo) es un conjunto de nodos conectados que se ejecutan en orden. Con cuatro conceptos lo entiendes:

- **Trigger (disparador).** El nodo que inicia el flujo: un _webhook_ que recibe una petición HTTP, un _Schedule Trigger_ que corre cada cierto tiempo, el evento de una app (llegó un correo, se creó una fila) o un mensaje de chat.
- **Nodos.** Cada uno hace una sola cosa: leer una hoja de Google Sheets, enviar un correo, filtrar con un IF, llamar cualquier API con el nodo HTTP Request o transformar datos con el nodo Code.
- **Items y JSON.** Entre nodo y nodo viaja una lista de _items_ en formato JSON. Cada nodo recibe items, los procesa y devuelve items. Con expresiones como `{{ $json.email }}` tomas un campo del paso anterior. Entender esto es la clave para aprender n8n.
- **Credenciales.** Las claves de API y los accesos OAuth se guardan cifrados y se reutilizan entre flujos, sin pegar contraseñas en cada nodo.

Cada vez que un flujo corre queda registrada una **ejecución** con los datos que entraron y salieron de cada nodo. Es la mejor herramienta de depuración de n8n: abres la ejecución fallida, ves en qué nodo se rompió y con qué datos. Dos detalles confunden al principio:

- El _webhook_ tiene dos URLs: la de **prueba**, que escucha mientras tienes el editor abierto, y la de **producción**, que solo responde cuando el flujo está publicado (en versiones anteriores se decía «activado»).
- En n8n Cloud, solo las ejecuciones de producción cuentan para la cuota del plan; las pruebas manuales no.

## La licencia de n8n: qué significa «fair-code»

n8n no es _open source_ en el sentido estricto de la Open Source Initiative. Su código es público y se distribuye bajo la **Sustainable Use License**, una licencia de tipo **fair-code**. En la práctica:

- **Puedes** instalarla gratis en tu servidor y usarla para los procesos internos de tu empresa.
- **Puedes** modificar el código para tu propio uso.
- **No puedes** venderla como servicio a terceros ni redistribuirla con fines comerciales.
- Funciones avanzadas, como SSO o la integración con Git, están en planes de pago bajo otra licencia (la _Enterprise License_).

Para una empresa que automatiza sus propios procesos, la licencia no estorba. Si planeas ofrecer n8n a otros como parte de un producto, lee el texto completo antes de construir nada.

## n8n Cloud o self-hosting con Docker

Es la primera decisión que tomarás:

| Aspecto                     | n8n Cloud                      | Autoalojado (self-hosted)                                   |
| --------------------------- | ------------------------------ | ----------------------------------------------------------- |
| Quién lo mantiene           | n8n                            | Tú o tu proveedor                                           |
| Arranque                    | Minutos, sin servidor          | Requiere servidor y administración                          |
| Cobro                       | Por ejecuciones, según el plan | Sin cuota por la edición Community; pagas servidor y tiempo |
| Control de datos            | Infraestructura de n8n         | Tu servidor                                                 |
| Actualizaciones y respaldos | Los gestiona n8n               | Los gestionas tú                                            |

En Cloud, el cobro se calcula por **ejecuciones**: una corrida completa del flujo cuenta como una, sin importar cuántos nodos tenga. Revisa la [página de precios de n8n](https://n8n.io/pricing/), porque los planes y límites cambian.

Para probar n8n en tu computador necesitas Docker. Este arranque está basado en la guía oficial, con la zona horaria de Colombia:

```bash
docker volume create n8n_data

docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="America/Bogota" \
  -e TZ="America/Bogota" \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

Abre `http://localhost:5678` y crea tu cuenta de propietario. El volumen `n8n_data` conserva tus flujos y credenciales; sin él, todo se pierde al borrar el contenedor.

Para producción, un contenedor suelto no alcanza. Lo mínimo:

- **PostgreSQL** en lugar de la base SQLite que n8n usa por defecto.
- **HTTPS** con un proxy inverso (Caddy o Nginx) y un dominio propio.
- Una **`N8N_ENCRYPTION_KEY` fija y respaldada**: con ella n8n cifra las credenciales, y si la pierdes tendrás que reconectarlas todas.
- **Respaldos** de la base de datos y de esa clave, con una restauración probada.
- **Retención de ejecuciones** ajustada (`EXECUTIONS_DATA_PRUNE` y `EXECUTIONS_DATA_MAX_AGE`), porque cada ejecución guarda datos de tus clientes.
- **Modo cola** (_queue mode_, con Redis y trabajadores) si el volumen crece.

Si no sabes qué servidor elegir, empieza por [qué es un VPS y cuándo lo necesitas](/blog/que-es-un-vps-y-cuando-lo-necesitas). Y si prefieres delegarlo, en nuestra [automatización con n8n](/automatizacion-con-n8n) diseñamos, implementamos y mantenemos tus flujos en tu propio servidor.

## Agentes de IA y nodo Code: donde n8n se despega

**Nodos de IA.** n8n incluye un nodo _AI Agent_ al que conectas un modelo de lenguaje (OpenAI, Anthropic, Google, Mistral o uno local con Ollama), memoria de conversación y herramientas: otros flujos, llamadas HTTP, Google Calendar, una base de datos. El agente decide qué herramienta usar para cumplir la tarea. También hay nodos para clasificar texto, extraer datos estructurados y consultar bases vectoriales, y soporte para MCP (Model Context Protocol), como cliente y como servidor.

Una advertencia: un agente con demasiadas herramientas y sin límites es impredecible. Dale pocas herramientas, instrucciones concretas y confirmación humana para lo irreversible (borrar datos, escribirle a un cliente).

**Nodo Code.** Cuando los nodos visuales no alcanzan, escribes JavaScript o Python dentro del flujo. Este ejemplo limpia correos y marca teléfonos colombianos:

```js
// Code node → "Run Once for All Items"
return $input.all().map((item) => ({
  json: {
    ...item.json,
    email: String(item.json.email).trim().toLowerCase(),
    esColombia: String(item.json.telefono).replace(/\D/g, '').startsWith('57'),
  },
}));
```

Un matiz: en n8n Cloud el nodo Code no permite importar librerías externas de Python y solo unos pocos módulos de JavaScript; en una instalación propia puedes habilitar más por configuración.

## Casos de uso de n8n en una empresa

Cinco automatizaciones típicas, sin nada exótico:

1. **Captación de leads.** Un formulario web o un anuncio de Meta dispara el flujo: valida el contacto, lo guarda en el CRM o en Google Sheets y avisa al equipo al instante.
2. **Atención por WhatsApp.** Los mensajes entrantes llegan por _webhook_, un modelo clasifica la intención y el flujo responde o crea un ticket para una persona.
3. **Reportes automáticos.** Cada lunes consulta las ventas en tu base de datos, calcula totales y envía un resumen por correo o Slack.
4. **Cobros y recordatorios.** Detecta facturas vencidas y envía un recordatorio por correo, respetando los horarios que regula la Ley 2300 de 2023.
5. **Monitoreo.** Revisa cada cinco minutos que tu sitio o tu API respondan y avisa por Telegram si algo falla.

## Un primer flujo paso a paso: del formulario al CRM con aviso

Este flujo guarda cada contacto de tu sitio web y avisa al equipo:

1. **Webhook (trigger).** Método `POST`, ruta `/nuevo-lead`. Recibe `nombre`, `correo`, `telefono` y `mensaje` desde el formulario.
2. **Edit Fields.** Renombra y limpia los campos (por ejemplo, el correo en minúsculas).
3. **IF.** Si el correo no tiene formato válido o el mensaje viene vacío, el flujo termina ahí.
4. **Google Sheets: Append Row.** Guarda el lead en una hoja (o usa el nodo de tu CRM).
5. **Nodo de IA (opcional).** Con un Basic LLM Chain pides una clasificación (_compra_, _soporte_, _otro_) y un resumen de una línea.
6. **Telegram, Slack o Gmail.** Avisa al equipo con el resumen.
7. **Respond to Webhook.** Responde `{"ok": true}` al formulario.

Prueba con la URL de **prueba** y revisa la ejecución nodo por nodo. Cuando todo salga bien, publica el flujo y cambia el formulario a la URL de **producción**. Añade además un _error workflow_ (nodo Error Trigger) que te avise si algo falla.

Si quieres construir flujos como este con acompañamiento, en el [curso de n8n](/curso-de-n8n) los armamos paso a paso sobre los procesos reales de tu trabajo, desde el primer webhook hasta los agentes de IA.

## Cuándo n8n no es la mejor opción

- Si el proceso es **muy simple y de bajo volumen** y nadie quiere tocar nada técnico, una herramienta más sencilla te ahorra tiempo.
- Si nadie va a **mantener el servidor**, el costo oculto del self-hosting se vuelve real.
- Si la lógica es **tan compleja** que el lienzo parece un plano eléctrico, quizá necesites código propio. Para decidirlo, lee [Zapier, Make o código propio](/blog/zapier-make-o-codigo-propio). Y para comparar las plataformas una por una, mira [n8n vs Zapier vs Make](/blog/n8n-vs-zapier-vs-make).

## Preguntas frecuentes

### ¿n8n es gratis?

La edición autoalojada (Community) no tiene costo de licencia para uso interno, pero pagas el servidor y el tiempo de mantenimiento. n8n Cloud es de pago y se cobra por ejecuciones. Verifica los planes vigentes en la página oficial.

### ¿Necesito saber programar para usar n8n?

No para flujos básicos: se arman arrastrando nodos. Aun así, entender JSON, APIs y expresiones marca la diferencia, y el nodo Code te saca de apuros cuando la lógica se complica.

### ¿n8n es de código abierto?

Es _fair-code_: el código es visible y puedes usarlo gratis en tu negocio, pero la Sustainable Use License limita venderlo o redistribuirlo comercialmente. No cumple la definición estricta de _open source_.

### ¿n8n funciona con WhatsApp?

Sí, mediante la API oficial de WhatsApp Business Platform de Meta, con nodos y webhooks. No sirve la app común: necesitas un número habilitado en la API.

## Conclusión

n8n es una buena apuesta cuando quieres automatizar con control: licencia gratuita para uso interno, cobro por ejecución completa, código cuando hace falta y agentes de IA con tus propias herramientas. Empieza con un flujo pequeño y útil, mídelo y crece desde ahí.

---

_¿Quieres aprenderlo con un profesor? Mira el [curso de n8n](/curso-de-n8n) o escríbenos por [WhatsApp](https://wa.me/573106041144). Si prefieres que lo implementemos por ti, conoce nuestra [automatización con n8n](/automatizacion-con-n8n)._
