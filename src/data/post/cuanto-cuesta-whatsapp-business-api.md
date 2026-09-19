---
publishDate: 2026-08-12T00:00:00Z
title: 'Cuánto cuesta la WhatsApp Business API: todos los costos, sin letra chica'
excerpt: 'Meta cobra por conversación, el proveedor técnico cobra aparte y la implementación es un tercer costo. Desglose completo para que armes un presupuesto que no te explote después.'
image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=2070&q=80'
category: WhatsApp
tags:
  - whatsapp business api
  - costos
  - meta business
author: Santiago Bedoya
metadata:
  description: 'Desglose de los costos de WhatsApp Business API: precio por conversación de Meta, costo del proveedor técnico, implementación y mantenimiento. Con cómo estimar tu caso.'
---

"¿Cuánto sale la API de WhatsApp?" es la pregunta más frecuente y la peor respondida. La respuesta honesta tiene tres capas, y quien te tira un número único está simplificando algo que te va a sorprender en la factura.

## Capa 1: lo que cobra Meta

Meta factura **por conversación**, no por mensaje. Una conversación es una ventana de 24 horas dentro de la cual todos los mensajes que se intercambien cuentan como una sola unidad.

Dos variables definen el precio:

### Quién la inicia

- **La inicia el cliente** (te escribe): se abre una ventana de servicio. Meta mantiene una franja mensual de estas conversaciones sin cargo, pensada justamente para la atención al cliente.
- **La iniciás vos**: se cobra siempre y requiere una plantilla aprobada.

### Para qué

Meta separa las conversaciones que inicia la empresa en categorías —marketing, utilidad, autenticación— y cada una tiene precio distinto. **Marketing es la más cara**, por bastante.

### El país

El precio varía muchísimo por mercado. Colombia, México, Argentina y España tienen tarifas distintas. Si atendés varios países, tu costo promedio depende de la mezcla.

> Los valores exactos los publica Meta y los actualiza periódicamente. Por eso no vas a encontrar acá una tabla de precios: estaría desactualizada en meses. Lo que importa es que entiendas **qué** te cobran, para que puedas leer la tabla vigente.

## Capa 2: el proveedor técnico

No te conectás a Meta directamente. Necesitás un proveedor que exponga la API y sostenga la infraestructura. Los modelos habituales:

- **Tarifa mensual fija** más el costo de Meta a precio de lista. El más transparente.
- **Margen sobre cada conversación**: el proveedor revende las conversaciones con recargo.
- **Por agente/usuario**, típico de las plataformas que incluyen bandeja de atención.

La diferencia entre modelos es enorme según tu volumen. Con volumen alto, un margen por conversación que parece chico se vuelve la mayor parte de tu factura. Con volumen bajo, una tarifa fija mensual es un peso muerto.

**Preguntá siempre**: ¿el costo de Meta me lo pasan a precio de lista o con recargo?

## Capa 3: la implementación

El costo de una sola vez, y el más variable:

- **Verificación del negocio con Meta.** Trámite administrativo. Tedioso, no técnico.
- **Alta del número y perfil comercial.**
- **Redacción y aprobación de plantillas.** Acá se pierde tiempo si no sabés qué rechaza Meta.
- **Integración con tus sistemas.** El grueso del trabajo. Va desde conectar una bandeja lista para usar hasta desarrollar la integración con un ERP propio.
- **Automatización o asistente con IA**, si además querés automatizar.

Una habilitación simple con una plataforma estándar es un proyecto de días. Una integración a medida con varios sistemas, de semanas.

## El cuarto costo que nadie menciona

**El mantenimiento.** Meta puntúa la calidad de tu número según los reportes y bloqueos de los usuarios. Si tu nivel baja, te recortan los límites de envío. Si sigue bajando, te suspenden.

Mantener esa calidad exige vigilar qué mandás, a quién y con qué frecuencia. No es un costo grande, pero existe, y descubrirlo el día que te recortan los límites es caro.

## Cómo estimar tu caso en cinco minutos

1. **Contá tus conversaciones mensuales reales.** No las estimes: miralas en el WhatsApp que ya usás.
2. **Separalas**: cuántas las inicia el cliente y cuántas las iniciarías vos.
3. **Clasificá las tuyas** en marketing, utilidad o autenticación.
4. **Buscá el precio vigente de Meta** para tu país y esas categorías.
5. **Sumá el proveedor y amortizá la implementación** en doce meses.

Ese número es tu costo mensual real. Compáralo contra lo que te cuesta hoy **no** atender: consultas perdidas fuera de horario, horas de gente respondiendo lo mismo diez veces, ventas que se llevó el que contestó primero.

## Cuándo NO conviene

Si recibís pocas consultas por día y una persona las atiende sin esfuerzo desde la app, la API te va a sumar costo y complejidad sin resolverte nada. La app gratuita alcanza.

La API se justifica cuando hay volumen, equipo o necesidad de integración. Antes de eso, es una solución buscando un problema.

---

*¿Querés una estimación sobre tu volumen real? [Contanos tu caso](/whatsapp-business-api) y armamos el número antes de que firmes nada. Si todavía estás decidiendo, empezá por [qué es la API y en qué se diferencia de WhatsApp Business](/blog/que-es-whatsapp-business-api).*
