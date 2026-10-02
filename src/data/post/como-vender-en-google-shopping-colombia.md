---
publishDate: 2026-10-01T00:00:00Z
title: 'Cómo vender con Google Shopping en Colombia: guía paso a paso'
excerpt: 'Guía de Google Shopping en Colombia: configura Merchant Center, optimiza tu feed de productos, elige entre Shopping y Performance Max y mide tu ROAS.'
image: ~/assets/images/seo/blog-como-vender-en-google-shopping-colombia.jpg
category: Marketing digital
tags:
  - google shopping
  - merchant center
  - ecommerce
  - performance max
author: Santiago Bedoya
metadata:
  title: 'Google Shopping en Colombia: guía para vender paso a paso'
  ignoreTitleTemplate: true
  description: 'Google Shopping en Colombia: configura Merchant Center, optimiza tu feed de productos, evita rechazos y elige entre Shopping y Performance Max.'
---

**Para vender con Google Shopping en Colombia necesitas tres piezas: una cuenta de Google Merchant Center con tu sitio verificado, un feed (fuente de datos) con tus productos bien descritos y, si quieres tráfico pagado, una campaña de Shopping o Performance Max en Google Ads.** Google admite Colombia tanto para anuncios de Shopping como para fichas gratuitas, con precios en pesos colombianos (COP). Los requisitos cambian con frecuencia, así que confirma los detalles en la [ayuda de Merchant Center](https://support.google.com/merchants).

## Cómo funciona Google Shopping

Google Shopping muestra productos con foto, precio y tienda en los resultados de búsqueda y en la pestaña Shopping. No se activa con palabras clave como una campaña de búsqueda clásica: Google relaciona lo que busca la persona con los datos de tu catálogo. Por eso la calidad del feed decide si apareces. Hay dos vías: **fichas gratuitas** y **anuncios de Shopping**.

## Qué debe cumplir tu tienda antes de empezar

Entre otras cosas, Google pide:

- Datos de contacto visibles (formulario, correo, teléfono o redes).
- Una política de devoluciones y reembolsos clara: qué debe hacer el cliente, en qué casos, en qué plazo y cuándo recibe su dinero. Debe verse sin iniciar sesión.
- Al menos un método de pago convencional: tarjeta, débito, facturación o pago contra entrega.
- Datos sensibles en una página segura (HTTPS) y un carrito que permita completar la compra.
- Costos y condiciones visibles antes de pagar.

En Colombia, alinea tu política con el Estatuto del Consumidor (Ley 1480 de 2011), que contempla el derecho de retracto de cinco días hábiles en ventas a distancia, con excepciones; valídalo con un abogado. Mostrar razón social y NIT es una buena práctica local que además refuerza la confianza. Si tu tienda no cumple lo básico, resuélvelo primero con [desarrollo web](/desarrollo-web).

## Cómo configurar Merchant Center paso a paso

1. **Crea la cuenta** con la cuenta de Google de tu negocio y registra nombre, país (Colombia) y datos de contacto.
2. **Verifica y reclama tu sitio.** Verificar demuestra que eres el dueño; reclamar vincula tu dominio a tu cuenta, y solo una cuenta puede reclamarlo. Puedes hacerlo con una etiqueta HTML, Google Analytics, Google Tag Manager o tu plataforma de e-commerce.
3. **Configura los envíos** con costos y tiempos reales. Si trabajas con Servientrega, Coordinadora, Interrapidísimo u otra transportadora, refleja sus tarifas y plazos; si ofreces envío gratis desde cierto valor en COP, muestra lo mismo en la web.
4. **Configura las devoluciones** con la misma política de tu sitio. Google la verifica y debe ser coherente.
5. **Carga tus productos** desde una hoja de cálculo de Google, un archivo programado o la sincronización de tu plataforma (Shopify, WooCommerce); confirma que la herramienta soporte Colombia y COP.
6. **Revisa los programas:** la mayoría de las cuentas ya participan en las fichas gratuitas; vincula Google Ads para los anuncios.

Muchos tutoriales muestran la interfaz antigua. Los nombres cambian (por ejemplo, "fuentes de datos" en lugar de "feeds"), pero la lógica es la misma. Si prefieres delegarlo, nuestro servicio de [Google Shopping](/google-shopping) configura Merchant Center, optimiza el feed y gestiona las campañas.

## El feed de productos: los atributos que importan

| Atributo       | Qué enviar                                                                     | Error frecuente                                     |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `id`           | Identificador único y estable por producto (SKU), hasta 50 caracteres          | Cambiarlo en cada actualización                     |
| `title`        | Nombre claro, hasta 150 caracteres                                             | Títulos genéricos o con textos promocionales        |
| `description`  | Texto plano, hasta 5.000 caracteres, fiel a la página                          | Copiar al fabricante sin adaptar, o incluir enlaces |
| `link`         | URL de la página del producto, en tu dominio verificado                        | Enlaces rotos o a la página de inicio               |
| `image_link`   | Foto principal limpia, de al menos 500 × 500 px (mejor cerca de 1.500 × 1.500) | Logos, marcas de agua o textos                      |
| `price`        | Precio con moneda ISO, como `129900.00 COP`, igual al de la página             | Precio distinto al del sitio                        |
| `availability` | `in_stock`, `out_of_stock`, `preorder` o `backorder`                           | Marcar "en stock" sin inventario                    |
| `brand`        | Marca del fabricante (hasta 70 caracteres)                                     | Poner el nombre de tu tienda                        |
| `gtin` / `mpn` | Código de barras válido; MPN si el producto no tiene GTIN                      | Inventar códigos                                    |
| `condition`    | `new`, `refurbished` o `used`                                                  | Omitirlo en usados o reacondicionados               |

Fuera de EE. UU. y Canadá, el precio debe incluir impuestos y coincidir con el que ve el cliente en el carrito. Si fabricas tu propia marca, GS1 Colombia asigna los GTIN; si revendes, usa el código del fabricante. Si tu producto es único o artesanal y no tiene identificadores, puedes declararlo con el atributo `identifier_exists`.

## Cómo optimizar el feed para vender más

- **Títulos:** marca + tipo de producto + los atributos que la gente busca (color, talla, material, modelo), con lo importante primero porque en muchas superficies el título se corta. Sin "oferta" ni "envío gratis".
- **Imágenes:** fondo limpio en la principal y fotos adicionales (`additional_image_link`) del producto en uso.
- **Categorías:** completa `google_product_category` con el ID de la taxonomía de Google y tu propio `product_type`.
- **Variantes:** agrúpalas con `item_group_id` y envía color y talla; en moda, también género y grupo de edad.
- **Actualización:** programa la sincronización de precio y disponibilidad con la frecuencia con que cambian en tu tienda.

## Fichas gratuitas o anuncios de Shopping

| Aspecto        | Fichas gratuitas                                                               | Anuncios de Shopping                                     |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Costo          | Sin costo                                                                      | Pagas por clic                                           |
| Dónde aparecen | Pestaña Shopping, Búsqueda, Imágenes, YouTube, Maps y Lens, según elegibilidad | Búsqueda, pestaña Shopping y otros espacios de Google    |
| Control        | Bajo: depende de tu feed                                                       | Alto: presupuesto, pujas y estructura                    |
| Tráfico        | Sin garantía                                                                   | Depende de presupuesto y subasta, sin garantía de ventas |

Google aclara que estar habilitado en las fichas gratuitas no garantiza que tus productos se muestren. Conviene activar ambas: las gratuitas suman alcance sin costo y los anuncios dan tráfico más previsible.

## Shopping estándar o Performance Max

| Aspecto       | Shopping estándar                                               | Performance Max                                                            |
| ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Dónde sirve   | Búsqueda, pestaña Shopping y sitios socios                      | Búsqueda, Shopping, YouTube, Display, Discover, Gmail y Maps               |
| Control       | Alto: grupos de productos, pujas, prioridad, palabras negativas | Menor: más automatizado, aunque Google ha ido sumando controles y reportes |
| Qué necesitas | Feed y presupuesto                                              | Feed y, para aprovecharlo, imágenes, videos y textos                       |
| Encaja si     | Tienes un catálogo pequeño o quieres entender qué se vende      | Tienes volumen de conversiones y creativos para alimentarla                |

Una ruta razonable: empieza con Shopping estándar para entender qué productos se venden y, con datos de conversión, prueba Performance Max con presupuesto acotado y compara por ROAS. Si usas ambas sobre los mismos productos, compiten en la subasta; revisa la documentación vigente de Google Ads.

## Rechazos comunes y cómo corregirlos

| Problema                                           | Causa probable                                      | Cómo corregirlo                                                        |
| -------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Precio o disponibilidad no coinciden               | El feed difiere de la página o se actualiza tarde   | Igualar valores y moneda; programar actualizaciones                    |
| GTIN faltante o no válido                          | Código inventado, mal digitado o ausente            | Usar el GTIN del fabricante; si no existe, declararlo o usar MPN       |
| Imagen con texto promocional o marca de agua       | Logos, textos o imagen demasiado pequeña            | Foto limpia y del tamaño adecuado                                      |
| Página de destino que no funciona                  | Error 404, redirecciones o bloqueo a Googlebot      | Corregir el enlace; no bloquear al rastreador de Google                |
| Falta la política de devoluciones                  | No existe, no se ve o no está en Merchant Center    | Publicarla sin pedir inicio de sesión y configurarla también allí      |
| Suspensión por información insuficiente o engañosa | Contacto oculto, costos no visibles o pago inseguro | Mostrar contacto, condiciones y costos antes de pagar y pedir revisión |

Si tu firewall o tu hosting bloquea tráfico de otros países, Google puede no revisar tus páginas: Googlebot rastrea sobre todo desde Estados Unidos. Los mensajes exactos cambian: busca el tuyo en los productos que requieren atención y abre su artículo de ayuda.

## Cómo medir el ROAS en Google Shopping

El ROAS es el valor de conversión dividido entre el costo: un ROAS de 4 (400 %) significa COP 4 de ventas por cada COP 1 invertido.

- **Punto de equilibrio:** 1 ÷ margen bruto. Con un producto de COP 120.000 y 35 % de margen (cifras hipotéticas), el equilibrio es 1 ÷ 0,35 = 2,86. Por debajo, pierdes dinero.
- **Margen real:** resta comisión de la pasarela, envío gratis, devoluciones y pedidos contra entrega rechazados; el equilibrio real será más alto.
- **Medición:** registra las compras con su valor en COP mediante la etiqueta de Google o GA4 y verifica que no se dupliquen.
- **Por producto:** separa los que gastan sin vender de los de mejor margen y ajusta pujas y estructura.
- **Remarketing:** para quien visita y no compra, complementa con [publicidad en Meta Ads](/publicidad-en-meta-ads). Para fijar ese presupuesto, aplica el método de CPA objetivo de [cuánto invertir en Meta Ads](/blog/cuanto-invertir-en-meta-ads).

## Preguntas frecuentes

### ¿Funciona Google Shopping en Colombia?

Sí. Google admite Colombia como país de destino para anuncios de Shopping y fichas gratuitas, con precios en COP. Verifica la disponibilidad vigente en la ayuda de Merchant Center.

### ¿Necesito código de barras (GTIN) para vender?

Si el producto lo tiene, Google lo recomienda con fuerza y debe ser válido. Si no, usa marca y MPN; si es único o artesanal, puedes declarar que no tiene identificadores. Nunca inventes códigos.

### ¿Cuánto cuesta anunciarse en Google Shopping?

Las fichas gratuitas no cuestan. Los anuncios se pagan por clic y tú defines el presupuesto diario; no hay una cifra única, así que parte de tu margen y de tu ROAS de equilibrio.

### ¿Cuánto tarda la aprobación?

Puede tomar varios días, y más si hay que corregir errores. No programes un lanzamiento con la fecha pegada.

## Conclusión

Vender con Google Shopping en Colombia es, ante todo, un trabajo de datos: una tienda confiable, un feed correcto y un ROAS medido sobre tu margen real. Empieza por Merchant Center y las fichas gratuitas, corrige los rechazos y solo después sube la inversión en anuncios.

---

_¿Prefieres que lo hagamos por ti? Mira nuestro servicio de [Google Shopping](/google-shopping) o escríbenos por [WhatsApp](https://wa.me/573106041144)._
