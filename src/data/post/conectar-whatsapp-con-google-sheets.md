---
publishDate: 2026-08-20T00:00:00Z
title: 'Cómo conectar WhatsApp con Google Sheets (y cuándo no deberías)'
excerpt: 'Llevar cada consulta de WhatsApp a una hoja de cálculo es la automatización más pedida. Te muestro las tres formas de hacerlo y los límites de cada una.'
image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=2070&q=80'
category: Automatización
tags:
  - whatsapp
  - google sheets
  - automatización
  - integraciones
author: Santiago Bedoya
metadata:
  title: 'Cómo conectar WhatsApp con Google Sheets: 3 formas | Sonmyd'
  ignoreTitleTemplate: true
  description: 'Tres formas de conectar WhatsApp con Google Sheets: plataformas sin código, Apps Script y desarrollo propio. Ventajas, límites y cuándo conviene cada una.'
---

Es uno de los pedidos de [automatización de procesos](/automatizaciones) más comunes: "quiero que cada consulta que entra por WhatsApp caiga sola en una hoja de cálculo". Tiene todo el sentido del mundo —es el primer paso para dejar de perder contactos— y hay tres formas de lograrlo, con costos y límites muy distintos.

Antes de elegir, hay un requisito del que no se escapa.

## El requisito: necesitas la API oficial

Para que un sistema lea automáticamente tus mensajes de WhatsApp, WhatsApp tiene que exponerlos. Y solo los expone a través de la **WhatsApp Business API**.

La app de WhatsApp Business no tiene forma oficial de hacerlo. Las herramientas que prometen conectarla simulan un teléfono, violan los términos de Meta y terminan con el número bloqueado. Si tu operación vive de WhatsApp, ese riesgo no vale el ahorro.

Si todavía no tienes la API, ese es tu primer paso, no la hoja de cálculo. La [habilitación de la WhatsApp Business API](/whatsapp-business-api) incluye la verificación con Meta, el número y las plantillas. Y ten presente que la API tiene costos propios, sea cual sea la opción que elijas: Meta cobra por mensaje de plantilla, según su categoría, y el proveedor técnico cobra aparte. El desglose está en [cuánto cuesta la WhatsApp Business API](/blog/cuanto-cuesta-whatsapp-business-api).

## Opción 1: plataforma sin código

Herramientas tipo Make, Zapier o [n8n](/blog/que-es-n8n). Conectas la API de WhatsApp por un lado y Google Sheets por el otro, y armas el flujo arrastrando bloques.

**Cómo funciona.** Cuando llega un mensaje, tu proveedor de la API dispara un webhook. La plataforma lo recibe, extrae los campos que te interesan y agrega una fila.

**A favor**: se arma en una tarde sin programar, se modifica visualmente, tiene reintentos y registro de errores incluidos.

**En contra**: se factura por operación y el precio escala con el volumen; la lógica compleja se vuelve un espagueti visual difícil de mantener; y dependes de un servicio más que puede caerse o cambiar precios.

**Conviene cuando** el volumen es moderado, la lógica es simple y quieres resultado esta semana. Si dudas entre una plataforma y programar, mira [cómo elegir entre Zapier, Make o código propio](/blog/zapier-make-o-codigo-propio).

## Opción 2: Google Apps Script

Apps Script es JavaScript que corre dentro de Google, gratis, con acceso nativo a Sheets. Publicas una función como aplicación web, le pasas esa URL a tu proveedor de WhatsApp como webhook y escribes las filas directamente.

**A favor**: no hay costo por operación, vive en la misma cuenta de Google donde está la hoja de cálculo y no suma un proveedor externo.

**En contra**: hay que escribir código; los límites de cuota de Google son reales; el manejo de errores te lo armas tú; y depurar Apps Script es incómodo.

**Conviene cuando** el volumen es bajo o medio, alguien del equipo se anima a tocar código y quieres costo cero de operación.

## Opción 3: desarrollo propio

Un servicio tuyo recibe el webhook, procesa y escribe en Sheets con la API de Google.

**A favor**: control total, lógica sin límites, costo por operación nulo, y puedes escribir en Sheets **y** en tu CRM **y** en tu base de datos en el mismo paso.

**En contra**: hay que desarrollarlo y hospedarlo. Es la opción con mayor costo inicial.

**Conviene cuando** el volumen es alto, la lógica es de negocio de verdad o la hoja de cálculo es solo uno de varios destinos.

## Y ahora la parte incómoda: cuándo NO deberías

Aquí va el consejo que menos nos conviene económicamente y que igual damos siempre.

**Google Sheets no es una base de datos.** Es una hoja de cálculo excelente que mucha gente usa como sistema, y hasta cierto punto funciona. Después deja de funcionar, y suele ser de golpe:

- **Se pone lenta** más allá de unas decenas de miles de filas con fórmulas.
- **Escrituras concurrentes** desde varias fuentes producen resultados raros.
- **No hay integridad**: cualquiera borra una fila sin dejar rastro.
- **No hay control de acceso por fila.** Si compartes la hoja, se ve todo.
- **Y eso último importa**: los datos de contacto de tus clientes son datos personales. Una hoja de cálculo compartida con "cualquiera con el enlace" es una filtración esperando su turno.

**Sheets sí es la herramienta correcta** cuando el volumen es acotado, lo que quieres es visibilidad rápida para gente no técnica, o estás validando el proceso antes de invertir en algo serio.

**Pasa a una base de datos o a un CRM** cuando el volumen crece, cuando varias personas escriben a la vez, cuando necesitas historial de cambios o cuando los datos son sensibles. Un CRM además te da seguimiento, asignación y métricas, que es probablemente lo que querías cuando pediste la hoja de cálculo.

## El orden correcto

1. Habilita la **API oficial**.
2. Define **qué dato necesitas** de cada conversación. Suele ser menos de lo que crees.
3. Arranca con la opción **más simple** que te sirva.
4. Mide y **migra cuando duela**, no antes.

Automatizar sobre la herramienta equivocada no es un error fatal. Diseñar todo tu proceso alrededor de ella sí lo es.

---

_¿Quieres conectar WhatsApp con tus sistemas sin caer en estos errores? Mira [cómo abordamos las automatizaciones](/automatizaciones), o empieza por [habilitar la API oficial](/whatsapp-business-api)._
