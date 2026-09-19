---
publishDate: 2026-09-15T00:00:00Z
title: 'Seguridad informática para pymes: las 7 medidas que sí mueven la aguja'
excerpt: 'Sin comprar herramientas caras ni contratar un equipo. Siete medidas ordenadas por impacto real, que una empresa chica puede implementar este mes.'
image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=2070&q=80'
category: Seguridad
tags:
  - ciberseguridad
  - pymes
  - backups
author: Santiago Bedoya
metadata:
  description: 'Siete medidas concretas de ciberseguridad para empresas pequeñas y medianas, ordenadas por impacto: segundo factor, backups probados, gestión de accesos y capacitación.'
---

La industria de la seguridad vive de venderte miedo y después venderte la cura. Yo prefiero el camino aburrido: hay siete medidas que cubren la enorme mayoría del riesgo real de una empresa chica, casi todas son gratis o baratas, y ninguna requiere un equipo dedicado.

Están en orden de impacto. Si solo podés hacer una, hacé la primera.

## 1. Segundo factor en todo

**La medida con mejor relación entre esfuerzo y protección que existe.** Sin competencia.

El segundo factor pide algo más que la contraseña para entrar: un código temporal de una app, o una llave física. Aunque te roben la clave —y las claves se roban todo el tiempo, en brechas de servicios de terceros— sin el segundo factor no entran.

Activalo en este orden: correo corporativo primero (porque desde el correo se recuperan todas las demás cuentas), después banca, servidores, redes sociales y panel del sitio.

Usá una app de códigos, no SMS. El SMS se puede interceptar clonando la línea, y es un ataque que ocurre.

## 2. Backups fuera de línea y probados

Frente a un secuestro de datos, lo único que te devuelve la operación es una copia limpia.

Tres condiciones, y las tres son obligatorias:

- **Automáticos.** Un backup que depende de que alguien se acuerde no existe.
- **Fuera del servidor.** Si está en el mismo disco, el mismo incidente se lo lleva. El secuestro de datos busca y cifra los backups conectados.
- **Probados.** Restaurá uno completo, de verdad, al menos una vez. Un backup que nunca se restauró no es un respaldo: es una suposición. La cantidad de empresas que descubre en el peor momento que el archivo estaba vacío hace meses es deprimente.

## 3. Ordenar quién accede a qué

Hacé una lista de todos los sistemas y de quién entra a cada uno. Siempre aparecen dos cosas: **cuentas de gente que ya no trabaja ahí** y **permisos de administrador que nadie necesita**.

Dos reglas:

- **Mínimo privilegio**: cada persona con los permisos justos para su tarea.
- **Baja inmediata**: cuando alguien se va, se cierran los accesos ese día. No la semana que viene.

Cuesta una tarde y elimina una categoría entera de riesgo.

## 4. Gestor de contraseñas

El problema no es que la gente use contraseñas débiles. Es que **repite** la misma en veinte servicios. Cuando uno de esos veinte sufre una brecha, el atacante prueba esa combinación en todos lados. Se llama *credential stuffing* y es automático.

Un gestor de contraseñas genera una distinta para cada servicio y las recuerda por vos. Las opciones buenas cuestan poco por usuario y algunas son gratuitas.

Beneficio lateral importante: dejás de compartir claves por WhatsApp.

## 5. Actualizaciones al día

Las vulnerabilidades conocidas se publican. Los escaneos automáticos las buscan en todo internet, sin apuntarle a nadie en particular.

Un sistema sin actualizar no es un riesgo teórico: es una puerta que ya está catalogada.

Activá actualizaciones automáticas en equipos y navegadores. En servidores, definí una ventana de mantenimiento periódica. Y prestá atención al software que ya no recibe soporte: eso no se parcha nunca más.

## 6. Configurar bien el correo del dominio

Tres registros de DNS —**SPF, DKIM y DMARC**— definen quién puede mandar correo en nombre de tu dominio.

Sin ellos, cualquiera puede escribirle a tus clientes haciéndose pasar por vos. Es el vector del fraude del falso proveedor: un mail que parece tuyo pidiendo que cambien el número de cuenta para el próximo pago.

Beneficio adicional: con estos registros bien puestos, tus mails legítimos dejan de caer en spam.

Es configuración, no compra. Una hora de trabajo.

## 7. Entrenar al equipo

**Las personas son la superficie más grande**, y ninguna herramienta lo cambia.

La mayoría de los incidentes empieza con alguien que hizo clic donde no debía o entregó una clave creyendo que hablaba con el proveedor. El engaño moderno es bueno: mails bien escritos, urgencia creíble, remitente que parece legítimo.

Lo que funciona no es una charla anual con diapositivas. Es entrenar dos reflejos concretos:

- **Ante urgencia + dinero + secreto, frená.** Es la firma del fraude.
- **Verificá por otro canal.** Si el mail del gerente pide una transferencia, llamalo por teléfono. Siempre.

Y algo cultural que importa más que todo lo anterior: **que reportar un error no tenga consecuencias**. En las empresas donde se castiga al que cayó, nadie avisa, y un incidente detectado a las dos horas es infinitamente más barato que uno detectado a las dos semanas.

## Lo que NO necesitás todavía

Para ser justos con tu presupuesto: si no tenés las siete de arriba resueltas, no necesitás un centro de monitoreo, ni una prueba de intrusión, ni la suite cara de seguridad.

Contratar una prueba de intrusión sin tener segundo factor ni backups es como poner una alarma de última generación en una casa con la puerta abierta. Va a encontrar problemas, sí. Los mismos que ya sabés que tenés.

**Primero lo básico. Después lo sofisticado.**

---

*¿Querés saber cómo estás parado? Hacemos [auditorías de seguridad](/ciberseguridad) con informe priorizado por riesgo y en castellano. Si el foco es la infraestructura, mirá también [servidores y VPS](/servidores-y-vps).*
