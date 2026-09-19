---
publishDate: 2026-09-10T00:00:00Z
title: 'Qué es un VPS y cuándo lo necesitás (y cuándo te están vendiendo de más)'
excerpt: 'Hosting compartido, VPS, servidor dedicado, nube. Cuatro opciones, cuatro precios y mucha confusión deliberada. Cómo saber cuál te corresponde.'
image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=2070&q=80'
category: Infraestructura
tags:
  - vps
  - servidores
  - infraestructura
author: Santiago Bedoya
metadata:
  description: 'Qué es un VPS, en qué se diferencia del hosting compartido y de la nube, cuándo conviene cada uno y qué costo real tiene mantener un servidor virtual.'
---

Un VPS es un **servidor virtual**: una porción aislada de una máquina física, con su propia memoria, su propio disco y acceso completo al sistema operativo. Para todo efecto práctico, es un servidor entero que arrendás por mes.

La palabra clave es **aislada**. Eso es lo que lo separa del hosting compartido y lo que define cuándo lo necesitás.

## Las cuatro opciones, en orden de control

### Hosting compartido

Muchos sitios en un mismo servidor, compartiendo recursos. Administrás por un panel web y no tenés acceso al sistema.

**Barato y sin mantenimiento.** El proveedor se ocupa de todo.

**Límites**: instalás solo lo que el proveedor permite, y si otro sitio del mismo servidor consume de más, tu sitio se pone lento. Se lo llama "el problema del vecino ruidoso" y es muy real.

**Para quién**: sitios informativos, WordPress estándar, landings. Si tu sitio es contenido y formularios, esto alcanza y sobra.

### VPS

Recursos propios garantizados y acceso total al sistema operativo. Instalás lo que quieras, configurás lo que quieras.

**A cambio**, lo administrás vos. Actualizaciones, seguridad, backups y monitoreo son tu responsabilidad. Nadie viene a salvarte.

**Para quién**: aplicaciones que no son un sitio estándar, sistemas propios, bases de datos con requisitos particulares, o cuando necesitás control del entorno.

### Servidor dedicado

Una máquina física entera para vos. Máximo rendimiento, máximo costo.

**Para quién**: cargas muy pesadas y sostenidas, o requisitos regulatorios de aislamiento físico. La mayoría de las empresas nunca lo necesita.

### Nube gestionada

Railway, Render, Vercel, Fly. Subís el código y la plataforma se ocupa del servidor.

**Cuesta más por unidad de cómputo** y te ata parcialmente al proveedor. A cambio, no administrás nada y escalás con un clic.

**Para quién**: equipos sin perfil de infraestructura, o cuando el tiempo de tu gente vale más que la diferencia de precio. Que suele ser el caso.

## Cuándo pasar de hosting compartido a VPS

Las señales concretas:

- **Necesitás instalar algo que el hosting no permite.** Una versión específica de Node, Python, un servicio propio.
- **Tu aplicación no es un sitio web estándar.** Un backend con procesos de fondo, una API, un bot.
- **El rendimiento es errático** sin que cambie tu tráfico. Síntoma clásico de vecino ruidoso.
- **Manejás datos sensibles** y necesitás control del entorno.
- **Necesitás procesos que corren en horarios**, colas de trabajo o tareas largas.

Si ninguna aplica, **el hosting compartido te está sirviendo bien**. Migrar a un VPS "porque es más profesional" es sumarte trabajo de administración sin ganar nada.

## Lo que cuesta de verdad

El servidor es la parte barata. Un VPS que sostiene una aplicación de empresa con base de datos ronda los veinte a cincuenta dólares mensuales. Para cargas chicas, mucho menos.

Lo que se olvida en el presupuesto:

- **Backups fuera del servidor.** Unos dólares más, y no es opcional.
- **Dominio y certificados.** El certificado puede ser gratis con renovación automática.
- **Monitoreo.** Hay opciones gratuitas decentes.
- **Y el costo grande: la administración.** Actualizar, vigilar, responder cuando algo se cae.

Ese último es el que define si tercerizás o no. **El servidor no es caro; el día que se cae y nadie sabe por qué, sí.**

## Los cuatro errores que vemos siempre

Cuando nos llega un VPS que administró alguien sin experiencia, encontramos casi siempre lo mismo:

1. **Backups inexistentes, o en el mismo disco.** Un backup en el mismo servidor no es un backup: se pierde junto con el original.
2. **Acceso SSH con contraseña y usuario root habilitado.** Los bots escanean internet permanentemente. Un servidor nuevo recibe intentos de acceso a los minutos de encenderse.
3. **Sistema sin actualizar hace años.** Con vulnerabilidades públicas y documentadas. No hace falta que te ataquen a vos específicamente.
4. **Sin monitoreo.** El aviso de que el servidor se cayó llega por el cliente que no pudo comprar.

Ninguno de los cuatro requiere conocimiento avanzado. Requieren saber que hay que hacerlos.

## El criterio, en una línea

Elegí el nivel **más simple** que cubra tus requisitos técnicos reales.

Si el hosting compartido te alcanza, quedate ahí. Si necesitás control pero no querés administrar, mirá la nube gestionada antes que el VPS. Y si vas al VPS, asumí que estás tomando una responsabilidad operativa continua, no solo alquilando una máquina.

---

*¿Querés que revisemos tu infraestructura actual? Hacemos un [diagnóstico de servidores](/servidores-y-vps) con informe priorizado por riesgo. Y si te preocupa la parte de seguridad, empezá por [acá](/ciberseguridad).*
