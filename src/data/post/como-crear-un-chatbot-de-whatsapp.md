---
publishDate: 2026-10-01T00:00:00Z
title: 'Cómo crear un chatbot de WhatsApp para tu negocio, paso a paso'
excerpt: 'Cómo crear un chatbot de WhatsApp: opciones, reglas de Meta, ventana de 24 horas, plantillas, IA con límites, traspaso a una persona, pruebas y errores comunes.'
image: ~/assets/images/seo/blog-como-crear-un-chatbot-de-whatsapp.jpg
category: WhatsApp
tags:
  - whatsapp
  - chatbot
  - whatsapp business api
  - inteligencia artificial
  - automatización
author: Santiago Bedoya
metadata:
  title: 'Guía: cómo crear un chatbot de WhatsApp paso a paso'
  ignoreTitleTemplate: true
  description: 'Aprende cómo crear un chatbot de WhatsApp para tu negocio: opciones, reglas de Meta, pasos, IA con límites, traspaso a una persona y errores comunes.'
---

**Para crear un chatbot de WhatsApp tienes dos caminos: las automatizaciones básicas de la app WhatsApp Business (saludo, mensaje de ausencia y respuestas rápidas) o un bot real sobre la WhatsApp Business Platform, la API oficial de Meta.** El segundo conecta tu número con un programa que recibe cada mensaje, decide qué responder (con reglas, con IA o con ambas) y puede consultar tu CRM o tu agenda. Los pasos son: definir qué hará el bot, habilitar la API, diseñar el flujo, construirlo, conectarlo a tus sistemas, preparar el traspaso a una persona, probarlo y medirlo.

Aquí vemos cómo crear un chatbot de WhatsApp paso a paso, con las reglas de Meta que condicionan el diseño y los errores que más se repiten.

## Opciones para crear un chatbot de WhatsApp

| Opción                                            | Qué permite                                                | Límites                                                                |
| ------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| App WhatsApp Business                             | Saludo, ausencia, respuestas rápidas, etiquetas y catálogo | No es un bot: sin lógica ni integraciones, pensada para pocas personas |
| Cloud API con un proveedor o plataforma           | Flujos, botones, IA, CRM y varios agentes                  | Requiere habilitar la API; hay costos de proveedor y de mensajes       |
| Cloud API con desarrollo a medida                 | Control total de lógica, integraciones y datos             | Más trabajo inicial y mantenimiento                                    |
| Herramientas no oficiales que simulan un teléfono | Parecen baratas                                            | Incumplen los términos de WhatsApp: pueden bloquear tu número          |

Si tu negocio depende de WhatsApp, descarta la última opción: perder el número es perder el canal y la base de contactos. Para entender la diferencia entre la app y la API, lee [qué es la WhatsApp Business API](/blog/que-es-whatsapp-business-api); y si quieres que la habilitemos por ti, hacemos la [habilitación de WhatsApp Business API](/whatsapp-business-api) con Meta.

## Reglas de Meta que condicionan tu chatbot

Antes de diseñar conversaciones, conoce las reglas, porque definen lo que el bot puede hacer:

- **Opt-in.** Solo puedes escribirle a una persona si te dio su número y aceptó recibir mensajes tuyos por WhatsApp. Una casilla clara en un formulario, un botón «Escríbenos por WhatsApp» o que el cliente te escriba primero son formas habituales. Comprar listas de contactos es la vía más rápida para que te bloqueen.
- **Ventana de 24 horas.** Cuando un cliente te escribe se abre una ventana de 24 horas (se renueva con cada mensaje suyo) en la que respondes con mensajes libres. Fuera de ella solo puedes iniciar la conversación con una **plantilla aprobada** por Meta. Hay ventanas más largas en casos puntuales, como cuando el cliente llega desde un anuncio de clic a WhatsApp.
- **Plantillas.** Se clasifican en marketing, utilidad y autenticación, y Meta las revisa: rechaza las demasiado promocionales, vagas o con variables mal definidas.
- **Precios.** Meta cobra por mensaje según la categoría y el país del destinatario (en 2025 dejó de cobrar por conversación), y cambia tarifas y qué mensajes son gratuitos con cierta frecuencia. Consulta la lista de precios oficial de Meta antes de proyectar costos.
- **Calidad y límites.** Si muchos usuarios bloquean o reportan tus mensajes, Meta puede limitar cuántos envías.
- **IA.** Los términos de Meta prohíben que los proveedores de IA (modelos de lenguaje, plataformas de IA generativa, asistentes de uso general) usen la plataforma cuando esa tecnología es la funcionalidad principal. Un bot de atención de tu propio negocio, con un alcance definido, es otra cosa; aun así, lee los términos vigentes antes de lanzar.

En Colombia aplican además la **Ley 1581 de 2012** (autorización previa para tratar datos personales) y la **Ley 2300 de 2023** (horarios y canales para el contacto comercial y de cobranza). Consulta con tu asesor legal cómo se aplican a tu caso.

## Paso a paso: cómo crear un chatbot de WhatsApp

### 1. Define qué problema resuelve

Empieza pequeño: dos o tres intenciones donde el bot sea claramente mejor que esperar a una persona. Por ejemplo: horarios y ubicación, cotización básica, agendar una cita o estado de un pedido. Escribe también lo que **no** hará (reclamos, pagos, casos sensibles) y pásalo siempre a una persona.

### 2. Habilita la API oficial

En resumen: crea una app en Meta for Developers, asocia una cuenta de WhatsApp Business, verifica tu empresa, registra un número, genera un token y configura el _webhook_ donde llegarán los mensajes. Meta te da un número de prueba para desarrollar sin tocar el definitivo. Un número no puede estar a la vez en la app y en la API, salvo con la función de coexistencia, sujeta a requisitos de Meta. La verificación de la empresa es la parte menos predecible: inicíala el primer día.

### 3. Diseña el flujo conversacional

Dibuja la conversación antes de programar:

- Un saludo que diga qué puede hacer el bot y que es un bot.
- Menús de máximo tres niveles. WhatsApp permite botones de respuesta (hasta 3) y listas (hasta 10 opciones).
- Un camino de error: si no entiende, repregunta una vez y ofrece una persona.
- Una forma de darse de baja, por ejemplo escribir «BAJA».
- Los puntos donde pasa a una persona.

### 4. Construye el bot

Puedes armarlo en una plataforma visual (como n8n o Make) o con código propio. El núcleo es el mismo: recibir el _webhook_, decidir y responder con la API. Un ejemplo mínimo en Node.js:

```js
import express from 'express';

const app = express();
app.use(express.json());

const { VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID } = process.env;

app.get('/webhook', (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN;
  return ok ? res.status(200).send(req.query['hub.challenge']) : res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido y procesa después
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') return;

  await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: message.from,
      type: 'text',
      text: { body: 'Hola, soy el asistente virtual. ¿Quieres agendar o consultar un precio?' },
    }),
  });
});

app.listen(3000);
```

Producción exige tres cosas que este ejemplo omite: validar la firma `X-Hub-Signature-256` de cada petición, guardar el `id` de cada mensaje para no responder dos veces (Meta reintenta si no recibe un 200) y manejar mensajes que no son texto, como audios, imágenes o ubicaciones. Usa además la versión vigente de la Graph API. Y para escribirle primero a un cliente colombiano, el número va en formato internacional: 57 más los 10 dígitos del celular.

Si prefieres no escribir ni mantener esto, nuestro servicio de [desarrollo de bots](/desarrollo-de-bots) lo construye a tu medida, conectado a tus sistemas.

### 5. Integra IA, con límites

La IA permite entender mensajes libres, pero un modelo sin límites inventa. Pon estas barreras:

- **Alcance cerrado.** Instrucciones que acoten el tema y respuestas basadas en tu base de conocimiento (precios, políticas, preguntas frecuentes), no en la memoria del modelo.
- **Sin inventar.** Si la información no está, el bot lo dice y ofrece una persona.
- **Herramientas mínimas.** Que solo pueda consultar disponibilidad o crear una cita, y que confirme antes de ejecutar.
- **Sin datos sensibles.** No pidas números de tarjeta ni contraseñas por chat.
- **Registro y revisión.** Guarda las conversaciones según tu política de datos y revisa las fallidas cada semana.
- **Costos acotados.** Limita el contexto y el número de mensajes por conversación.

Si quieres un asistente que ya trae estas piezas (responde, califica clientes y agenda), mira nuestro [asistente de WhatsApp con IA](/asistente-de-whatsapp).

### 6. Conecta CRM, agenda y hojas de cálculo

Un bot que no escribe en ningún sistema es solo un contestador. Conéctalo para crear o actualizar el contacto en tu CRM, agendar en Google Calendar y registrar cada consulta. Si tu primer paso es llevar los mensajes a una planilla, lee [cómo conectar WhatsApp con Google Sheets](/blog/conectar-whatsapp-con-google-sheets) y sus límites.

### 7. Prepara el traspaso a una persona

Define cuándo cede el bot: el cliente pide un asesor, hay frustración, falla dos veces seguidas o el tema es un reclamo, un pago o algo delicado. Al ceder, marca la conversación como «humano» para que el bot deje de responder, envía un resumen a quien atiende e informa al cliente el horario y el tiempo estimado.

### 8. Prueba antes de abrirlo

Usa el número de prueba y un grupo pequeño de personas reales. Prueba mensajes largos, audios, imágenes y emojis; clientes que escriben varias veces seguidas; preguntas fuera de alcance; intentos de que el bot ignore sus instrucciones; y qué pasa cuando se cierra la ventana de 24 horas.

### 9. Mide y mejora

Mide el tiempo de primera respuesta, el porcentaje de conversaciones resueltas sin una persona, la tasa de traspaso, dónde abandonan los usuarios, las citas o ventas generadas, los bloqueos y el costo por conversación.

## Errores comunes al crear un chatbot de WhatsApp

- **Escribir sin opt-in** o importar contactos comprados.
- **No ofrecer una persona.** Un bot sin salida frustra y provoca bloqueos.
- **Menús laberínticos.** Con más de tres niveles, la gente abandona.
- **Dejar que la IA responda cualquier cosa**, incluso precios o promesas que tu negocio no hizo.
- **Ignorar la ventana de 24 horas** y descubrir que los seguimientos no se entregan sin plantilla.
- **No manejar duplicados ni reintentos** del _webhook_.
- **Usar herramientas no oficiales** y perder el número.

## Preguntas frecuentes

### ¿Se puede crear un chatbot de WhatsApp gratis?

La app WhatsApp Business trae automatizaciones básicas sin costo, pero no es un bot. Uno real sobre la API tiene costos: plataforma o proveedor, servidor, mensajes de plantilla según la lista de Meta y, si usas IA, el consumo del modelo.

### ¿Necesito la WhatsApp Business API?

Para un bot con lógica, integraciones o IA, sí: es la vía oficial. La app sola no alcanza.

### ¿Puedo usar mi número actual?

Normalmente un número vive en la app o en la API, no en ambas. Existe la función de coexistencia para algunos casos, sujeta a requisitos de Meta y de tu proveedor. Confirma con ellos qué ocurre con el historial antes de migrar.

## Conclusión

Un buen chatbot de WhatsApp nace de un alcance pequeño, una API oficial, reglas claras de Meta y una salida siempre disponible hacia una persona. Empieza con dos o tres casos de uso, mídelos y amplía solo cuando el bot los resuelva bien.

---

_¿Quieres un chatbot de WhatsApp funcionando en tu negocio? Conoce el [desarrollo de bots](/desarrollo-de-bots) o escríbenos por [WhatsApp](https://wa.me/573106041144)._
