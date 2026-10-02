---
publishDate: 2026-10-01T00:00:00Z
title: 'Cómo aprender JavaScript desde cero: ruta paso a paso'
excerpt: 'Ruta ordenada para aprender JavaScript desde cero: fundamentos, DOM, async, Git, TypeScript, React y Node.js, con tiempos orientativos y proyectos.'
image: '~/assets/images/seo/blog-como-aprender-javascript-desde-cero.jpg'
category: Desarrollo
tags:
  - javascript
  - aprender a programar
  - desarrollo web
  - typescript
  - react
author: Santiago Bedoya
metadata:
  title: 'Aprender JavaScript desde cero: ruta paso a paso | Sonmyd'
  ignoreTitleTemplate: true
  description: 'Cómo aprender JavaScript desde cero en el orden correcto: fundamentos, DOM, fetch, Git, TypeScript, React y Node.js, con tiempos por etapa y proyectos.'
---

Para aprender JavaScript desde cero, sigue este orden: fundamentos del lenguaje, manipulación del DOM, asincronía con `fetch`, Git, TypeScript, un framework como React y, al final, Node.js para el backend. Con 10 a 15 horas semanales, la ruta completa suele tomar entre 6 y 12 meses, y cada etapa se valida construyendo algo, no mirando videos.

El orden pesa más que el curso que elijas. Saltar a React sin entender funciones ni asincronía es una de las formas más rápidas de frustrarse: cada error suena a otro idioma.

## La ruta para aprender JavaScript desde cero, de un vistazo

| Etapa                 | Qué aprendes                          | Tiempo orientativo | Proyecto para validarla         |
| --------------------- | ------------------------------------- | ------------------ | ------------------------------- |
| 1. Fundamentos        | Variables, funciones, arrays, objetos | 4 a 8 semanas      | Conversor de monedas en consola |
| 2. DOM y eventos      | Páginas interactivas                  | 3 a 5 semanas      | Lista de tareas                 |
| 3. Asincronía y fetch | Promesas, async/await, APIs           | 3 a 5 semanas      | Buscador del clima              |
| 4. Git y GitHub       | Control de versiones                  | 1 a 2 semanas      | Portafolio publicado            |
| 5. TypeScript         | Tipos y errores tempranos             | 3 a 5 semanas      | Migrar un proyecto anterior     |
| 6. React              | Componentes, estado y hooks           | 6 a 10 semanas     | Panel con filtros               |
| 7. Node.js            | API REST y base de datos              | 6 a 10 semanas     | Aplicación completa desplegada  |

Son rangos, no promesas: dependen de las horas que dediques, de si ya programaste antes y de cuánto practiques. Lo único que no es negociable es el orden, porque cada etapa se apoya en la anterior. Git se aprende en paralelo, desde el inicio.

## Antes de empezar a programar: lo mínimo que necesitas

- **HTML y CSS básicos.** JavaScript trabaja sobre páginas web, así que debes entender etiquetas, clases y selectores. Con dos a cuatro semanas desde cero alcanza para arrancar.
- **Un editor y un navegador.** Visual Studio Code y Chrome o Firefox con sus herramientas de desarrollador. Con eso basta al comienzo.
- **Hábito de leer documentación.** La referencia gratuita de cabecera es MDN Web Docs; para un recorrido guiado, javascript.info, que tiene versión en español. Saber buscar pesa tanto como saber la sintaxis.
- **Matemáticas básicas.** Aritmética y lógica: si pasa esto, haz aquello. Nada más.

## Etapa 1: fundamentos del lenguaje (4 a 8 semanas)

Aquí se construye todo lo demás. Aprende, en este orden: variables con `let` y `const`, tipos de datos, condicionales y bucles, funciones (incluidas las funciones flecha), arrays con sus métodos (`map`, `filter`, `reduce`) y objetos con desestructuración.

Dos conceptos separan a quien entiende JavaScript de quien lo copia: el **ámbito** (_scope_) y los **closures**. Si no puedes explicar con tus palabras por qué una función recuerda las variables del lugar donde nació, no pases a React: los hooks se apoyan exactamente en eso.

Otro clásico es usar `==` por costumbre. Con `==` JavaScript convierte tipos de forma automática, y por eso `0 == ''` da verdadero. Usa `===` siempre y averigua por qué.

**Puedes avanzar cuando** resuelves un ejercicio nuevo sin copiar la solución.

## Etapa 2: el DOM y los eventos (3 a 5 semanas)

El DOM es la representación de tu página que JavaScript puede leer y modificar. Aquí el lenguaje se vuelve visible: haces clic y algo cambia.

Practica `querySelector`, `addEventListener`, la creación y eliminación de elementos, la validación de formularios y el guardado de datos en `localStorage`. Un proyecto vale más que diez tutoriales: una lista de tareas que conserve los datos al recargar la página.

**Puedes avanzar cuando** construyes esa lista de tareas sin seguir un video.

## Etapa 3: asincronía y fetch (3 a 5 semanas)

Casi toda aplicación real pide datos a un servidor. Eso es asincronía: el código no se queda esperando, sigue ejecutándose y la respuesta llega después. Recorre el camino en orden: callbacks, promesas y, por último, `async/await`, que será lo que uses a diario.

```js
async function obtenerUsuarios() {
  const respuesta = await fetch('https://jsonplaceholder.typicode.com/users');
  if (!respuesta.ok) {
    throw new Error(`Error HTTP ${respuesta.status}`);
  }
  return respuesta.json();
}
```

Dos detalles que hacen perder horas a los principiantes. Primero, `fetch` no falla con un 404 o un 500, solo con errores de red; por eso debes revisar `respuesta.ok`. Segundo, olvidar el `await` te devuelve una promesa en vez de los datos.

## Etapa 4: Git y GitHub (en paralelo, desde el inicio)

No lo dejes para el final. Aprende `commit`, ramas, `merge` y pull requests, y sube cada proyecto a GitHub. Tu perfil se convierte en tu portafolio, y trabajar con ramas te enseña a experimentar sin miedo a dañar lo que ya funciona.

## Etapa 5: TypeScript (3 a 5 semanas)

TypeScript añade tipos a JavaScript para detectar errores antes de ejecutar el código. Muchos proyectos profesionales lo usan, así que vale la pena, pero **después** de sentirte cómodo con JavaScript: aprenderlo antes mezcla dos curvas de aprendizaje y confunde.

Empieza por tipos básicos, interfaces y funciones tipadas, y deja los genéricos avanzados para más adelante. El mejor ejercicio es migrar uno de tus proyectos anteriores y ver qué errores había escondidos.

## Etapa 6: un framework, React (6 a 10 semanas)

Elige uno y profundiza. React es una apuesta sólida por su ecosistema y por la cantidad de equipos que lo usan; Vue, Svelte y Astro son alternativas válidas, y los conceptos se transfieren de uno a otro.

Antes de abrir el framework, intenta construir una interfaz con DOM puro y siente lo difícil que es mantener la pantalla sincronizada con los datos. React existe para resolver ese problema, y se aprende mejor cuando ya lo has sentido.

Estudia componentes, props, estado, los hooks `useState` y `useEffect`, listas, formularios y rutas. La trampa típica: usar `useEffect` sin entender closures y terminar con valores desactualizados que parecen magia. Por eso la etapa 1 no es negociable.

Si tu meta es crear sitios completos y publicarlos, el [curso de desarrollo web](/curso-de-desarrollo-web) recorre HTML, CSS, JavaScript y React con práctica guiada.

## Etapa 7: Node.js y backend (6 a 10 semanas)

Node.js te permite ejecutar JavaScript fuera del navegador, en el servidor. Aprende módulos, `npm`, una API REST con Express o Fastify, una base de datos relacional (PostgreSQL es una excelente opción), autenticación básica y variables de entorno.

Cierra la etapa desplegando una aplicación completa: interfaz en React, API en Node y datos persistentes, accesible desde una URL real. Con eso tienes el perfil base de un desarrollador web full stack.

## Proyectos que sí valen la pena

Un buen proyecto resuelve un problema concreto y maneja estados reales: cargando, error y vacío. Una escalera razonable:

1. **Conversor de monedas** de pesos colombianos (COP) a dólares, que consuma una API de tasas de cambio.
2. **Lista de tareas** con filtros y datos persistentes.
3. **Buscador del clima** por ciudad, con manejo de errores.
4. **Panel en React** que consuma tu propia API.
5. **Un proyecto para alguien real**: la página de un negocio de tu barrio, un sistema de citas, un control de gastos. Tener un usuario de verdad te obliga a terminar, pulir y escuchar.

## Cómo estudiar JavaScript cada semana

- **Constancia sobre maratones.** Cinco sesiones de una o dos horas rinden más que un sábado de ocho.
- **Más práctica que teoría.** Una hora de video merece dos de código escrito por ti. Copiar y pegar no cuenta.
- **Lee el error completo.** Casi siempre indica el archivo y la línea. Reduce el problema al mínimo y busca el mensaje exacto.
- **Explica en voz alta** lo que hace tu código. Si no puedes, todavía no lo entiendes.

## Errores que frenan a muchos principiantes

- **Coleccionar tutoriales.** Ver cursos sin construir nada propio da sensación de avance sin avance real.
- **Saltar a React sin fundamentos.** No sabrás depurar lo que no entiendes.
- **Delegar todo en la IA.** Pedirle a un asistente que escriba el código funciona hasta que algo falla y no sabes por qué. Úsala para que te explique lo que no entiendes, no para evitar entenderlo: es la misma trampa que describimos en [aprender inteligencia artificial desde cero](/blog/aprender-inteligencia-artificial-desde-cero).
- **Rendirse en el primer muro.** Los closures y la asincronía frustran a muchos; es normal y se supera con práctica, no con talento.

## ¿Aprender JavaScript solo o con acompañamiento?

Se puede aprender solo: MDN, javascript.info y tus propios proyectos son gratuitos. Lo que cuesta es el feedback. Pasar tres días atascado en un error que un profesor resolvería en cinco minutos es una causa frecuente de abandono.

Si prefieres una ruta adaptada a tu nivel y tu objetivo, las [clases de JavaScript](/clases-de-javascript) 1 a 1, en Medellín u online, recorren esta misma secuencia: DOM, TypeScript, Node.js y React, con proyectos reales.

## Preguntas frecuentes

### ¿Cuánto tiempo toma aprender JavaScript desde cero?

Para escribir programas útiles con fundamentos, DOM y asincronía, calcula de 3 a 4 meses con 10 a 15 horas semanales. Para sumar TypeScript, React y Node.js, entre 6 y 12 meses. Son rangos orientativos: el tiempo hasta un primer empleo depende además del mercado, de tu portafolio y de tu nivel de inglés, y no existe una cifra honesta que prometerte.

### ¿JavaScript es un buen primer lenguaje?

Sí, si tu meta es la web: lo ejecutas en el navegador sin instalar nada, ves resultados al instante y el mismo lenguaje te sirve para el frontend y el backend. Si te interesan los datos, la automatización o la IA, Python es una alternativa igual de válida; los conceptos de programación se transfieren de uno a otro.

### ¿Necesito saber HTML y CSS antes?

Lo básico, sí. JavaScript manipula los elementos de la página, así que debes saber qué es una etiqueta, una clase y un selector. No hace falta dominar CSS para empezar con el lenguaje.

### ¿Puedo aprender JavaScript gratis?

Sí. MDN Web Docs y javascript.info cubren el lenguaje completo, y React y Node.js tienen documentación oficial gratuita. Lo que suele pagarse es el acompañamiento: revisión de tu código, corrección de malos hábitos y una ruta adaptada a tu objetivo.

## Conclusión

Aprender JavaScript desde cero no depende del talento sino del orden y la práctica: fundamentos antes que frameworks, un proyecto por etapa y constancia semanal. Empieza hoy por la etapa 1 y avanza solo cuando puedas explicar lo que hiciste.

---

_¿Prefieres aprenderlo con un profesor? Conoce nuestras [clases de JavaScript](/clases-de-javascript) o el [curso de desarrollo web](/curso-de-desarrollo-web), o escríbenos por [WhatsApp](https://wa.me/573106041144)._
