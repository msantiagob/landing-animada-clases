---
publishDate: 2026-09-18T00:00:00Z
title: 'Automatizar Google Workspace: 6 procesos que tu equipo todavía hace a mano'
excerpt: 'Sheets, Gmail, Drive y Calendar tienen una capa de automatización que casi nadie usa. Seis casos concretos con lo que hace falta para cada uno.'
image: 'https://images.unsplash.com/photo-1481487196290-c152efe083f5?auto=format&fit=crop&w=2070&q=80'
category: Automatización
tags:
  - google workspace
  - automatización
  - google sheets
author: Santiago Bedoya
metadata:
  description: 'Seis automatizaciones concretas sobre Google Workspace: reportes que se arman solos, Drive que se ordena, seguimientos por Gmail, Calendar y aprobaciones sin cadenas de mails.'
---

Casi todas las empresas que usan Google Workspace lo usan como un Office con carpeta compartida. Sheets para planillas, Gmail para el correo, Drive para archivos. Y punto.

Debajo hay una capa de automatización —Apps Script, más las APIs de cada servicio— que está incluida en lo que ya pagás y que casi nadie toca. Seis casos donde suele rendir de inmediato.

## 1. El reporte que alguien arma todos los lunes

**El síntoma**: una persona dedica dos horas semanales a juntar datos de varias planillas, calcular totales, armar el resumen y mandarlo por mail.

**La automatización**: un script consolida las fuentes, calcula, genera el resumen y lo envía solo, en horario. La persona pasa de armarlo a leerlo.

**Qué hace falta**: Apps Script, o una plataforma sin código si las fuentes están en distintos servicios.

**Detalle que importa**: si el reporte requiere criterio —"esta cifra hay que explicarla"— automatizá la parte mecánica y dejá el comentario a la persona. Automatizar el juicio es donde estas cosas salen mal.

## 2. Drive convertido en un basurero

**El síntoma**: carpetas con nombres tipo "Documentos", archivos llamados "final_v2_REAL_ok", y nadie encuentra nada.

**La automatización**: un script que mueve archivos a carpetas según nombre, tipo o fecha; que archiva lo viejo; que detecta duplicados.

**Qué hace falta**: Apps Script con la API de Drive.

**La advertencia**: automatizar el orden sin acordar antes una convención de nombres es acelerar el caos. Primero la convención, después el script. Siempre en ese orden.

## 3. Seguimientos que se pierden

**El síntoma**: mandás una propuesta y el seguimiento depende de que alguien se acuerde. Se pierden oportunidades por olvido, no por falta de interés.

**La automatización**: una planilla con los envíos y sus fechas; el script detecta los que superaron el plazo sin respuesta y dispara un recordatorio al responsable —o directamente un mail de seguimiento al cliente, si el mensaje es simple.

**Qué hace falta**: Sheets más Gmail vía Apps Script.

**El límite**: un seguimiento automático genérico se nota y molesta. Funciona bien para recordarle **a tu equipo** que haga el seguimiento; funciona mal como reemplazo del contacto humano en una venta consultiva.

## 4. Formularios que alguien transcribe

**El síntoma**: entra un formulario y una persona copia los datos al CRM, al sistema de facturación o a otra planilla.

**La automatización**: al recibirse la respuesta, el script valida, normaliza y escribe en todos los destinos. Si algo no valida, avisa en vez de escribir basura.

**Qué hace falta**: disparador de Forms más las APIs de destino.

**El detalle que casi nadie hace**: la validación. Sin ella, automatizás la entrada de datos sucios a más velocidad. Un teléfono mal formateado copiado a mano lo corrige la persona; automatizado, entra tal cual.

## 5. Calendar sin ida y vuelta

**El síntoma**: cinco mails para acordar un horario.

**La automatización**: enlace de reserva sobre tu disponibilidad real, creación del evento con videollamada, recordatorio automático el día previo y registro en la planilla de seguimiento.

**Qué hace falta**: API de Calendar, o una herramienta de agendamiento integrada.

**El detalle**: bloqueá franjas de trabajo concentrado antes de publicar la disponibilidad. Si no, la agenda se llena de reuniones de quince minutos que destruyen el día.

## 6. Aprobaciones por cadena de mails

**El síntoma**: pedir una aprobación implica un hilo de correo con cinco personas donde nadie sabe en qué estado está.

**La automatización**: un formulario dispara la solicitud, el script notifica a quien aprueba, registra la decisión con fecha y responsable, y avisa al solicitante.

**Qué hace falta**: Forms, Sheets y Gmail. Se arma en un día.

**El beneficio real** no es la velocidad: es la **trazabilidad**. Saber quién aprobó qué y cuándo, sin arqueología en la bandeja de entrada.

## Apps Script o plataforma externa

**Apps Script** si todo ocurre dentro de Google. Es gratis, corre en tu cuenta, no suma proveedores. Tiene cuotas, pero para volúmenes de pyme rara vez molestan.

**Plataforma sin código** si necesitás conectar Google con servicios de afuera —tu CRM, WhatsApp, tu sistema de facturación— y no querés programar. Cuesta por operación.

**Desarrollo propio** cuando el volumen es alto o la lógica es de negocio compleja.

## El error de siempre

Empezar por el proceso más grande y más visible.

Elegí el más chico y más molesto. Automatizalo entero, que funcione, que la gente lo use. Esa victoria es la que te compra permiso interno para el siguiente.

Los proyectos de automatización no fracasan por falta de tecnología. Fracasan porque arrancaron por el proceso más complejo, tardaron seis meses en mostrar algo y para entonces nadie creía en la iniciativa.

---

*Si querés que miremos qué procesos conviene automatizar primero, [contanos tu caso](/automatizaciones). Y si preferís que tu equipo aprenda a hacerlo, las [clases de Python](/clases-de-python) son el camino.*
