---
publishDate: 2026-10-01T00:00:00Z
title: 'Certificación AWS Cloud Practitioner: guía y plan para aprobar'
excerpt: 'La certificación AWS Cloud Practitioner (CLF-C02) explicada: costo, dominios, plan de estudio de cuatro semanas, servicios clave, recursos gratis y qué sigue.'
image: ~/assets/images/seo/blog-certificacion-aws-cloud-practitioner.jpg
category: Infraestructura
tags:
  - aws
  - cloud practitioner
  - certificación
  - nube
  - clf-c02
author: Santiago Bedoya
metadata:
  title: 'Guía de la certificación AWS Cloud Practitioner (CLF-C02)'
  ignoreTitleTemplate: true
  description: 'Guía de la certificación AWS Cloud Practitioner (CLF-C02): datos del examen, dominios, plan de estudio por semanas, servicios clave y recursos gratuitos.'
---

**La certificación AWS Cloud Practitioner (examen CLF-C02) es la credencial de nivel básico de Amazon Web Services: acredita que entiendes qué es la nube de AWS, sus servicios principales, la seguridad y cómo se cobra, sin exigir experiencia técnica profunda.** Según la guía oficial del examen, son 65 preguntas (50 puntúan y 15 son de prueba), 90 minutos y 700 puntos sobre 1.000 para aprobar; el precio de lista es USD 100. Verifica la versión vigente antes de agendar, porque AWS actualiza el examen y sus condiciones.

Esta guía resume qué evalúa, cómo prepararte en cuatro semanas, qué servicios dominar, qué recursos gratuitos usar y qué certificación sigue.

## Datos del examen CLF-C02 (según la guía oficial)

| Dato                 | Valor                                                 |
| -------------------- | ----------------------------------------------------- |
| Código               | CLF-C02                                               |
| Preguntas            | 65 (50 puntúan y 15 no)                               |
| Duración             | 90 minutos                                            |
| Puntaje para aprobar | 700 en una escala de 100 a 1.000                      |
| Costo de lista       | USD 100                                               |
| Formato              | Opción múltiple y respuesta múltiple                  |
| Modalidad            | Centro Pearson VUE o examen supervisado en línea      |
| Idiomas              | Incluye español (Latinoamérica) e inglés, entre otros |
| Vigencia             | 3 años                                                |
| Prerrequisitos       | Ninguno                                               |

Son los datos que publican la página y la guía oficiales de AWS; confírmalos en la versión vigente. Cuatro detalles útiles si lo presentas desde Colombia:

- **Se paga en dólares.** El costo en pesos depende de la TRM del día y de los impuestos de tu medio de pago.
- **Puedes pedir más tiempo.** Si lo presentas en inglés y no es tu lengua materna, AWS ofrece 30 minutos adicionales («ESL +30»), que se solicitan en tu cuenta antes de agendar.
- **No hay penalización por responder al azar.** Las preguntas sin responder cuentan como incorrectas, así que contesta todas.
- **Descuento para el siguiente examen.** Al obtener una certificación AWS recibes un 50 % de descuento en otro examen; revisa las condiciones en tu cuenta.

## Los cuatro dominios del examen y cuánto pesan

| Dominio                              | Peso | Qué debes dominar                                                                                                                               |
| ------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Conceptos de la nube              | 24 % | Beneficios de la nube, elasticidad, alta disponibilidad, pilares del Well-Architected Framework, Cloud Adoption Framework y economía de la nube |
| 2. Seguridad y cumplimiento          | 30 % | Responsabilidad compartida, IAM, usuario root, MFA, mínimo privilegio, WAF, Shield, GuardDuty, Inspector, Artifact                              |
| 3. Tecnología y servicios de la nube | 34 % | Infraestructura global, cómputo, almacenamiento, bases de datos, redes, IA/ML y analítica                                                       |
| 4. Facturación, precios y soporte    | 12 % | Opciones de compra, Budgets, Cost Explorer, Pricing Calculator, Organizations y planes de soporte                                               |

Con el 30 % del peso, la seguridad no se puede dejar para el final: el modelo de responsabilidad compartida y IAM atraviesan todo el examen.

Una novedad: AWS está renovando sus planes de soporte. La guía actual del examen ya menciona Basic Support, Business Support+, Enterprise Support y Unified Operations, mientras que los planes anteriores (Developer, Business y Enterprise On-Ramp) se mantienen para los clientes existentes hasta el 1 de enero de 2027.

## Plan de estudio de cuatro semanas

Como referencia, 6 a 8 horas semanales suelen alcanzar para alguien con base técnica. Si partes de cero en tecnología, estira el plan a seis u ocho semanas.

**Semana 1: conceptos y fundamentos.**

- Qué es la nube, pago por uso, elasticidad, regiones, zonas de disponibilidad y ubicaciones de borde (_edge locations_).
- Modelo de responsabilidad compartida y los seis pilares del Well-Architected Framework.
- Práctica: crea tu cuenta, activa MFA en el usuario root y configura un presupuesto con alerta.

**Semana 2: cómputo, almacenamiento y bases de datos.**

- EC2 (tipos de instancia y opciones de compra), Lambda, contenedores (ECS, EKS, Fargate), Auto Scaling y balanceadores.
- S3 y sus clases de almacenamiento, EBS y EFS; RDS, Aurora, DynamoDB y ElastiCache.
- Práctica: lanza una instancia EC2 pequeña, sube un archivo a S3 y elimina todo al terminar.

**Semana 3: redes, seguridad y gobierno.**

- VPC, subredes, grupos de seguridad frente a NACL, Route 53, CloudFront, VPN y Direct Connect.
- IAM (usuarios, grupos, roles y políticas), IAM Identity Center, KMS, Secrets Manager, GuardDuty, Inspector, WAF, Shield y Artifact.
- CloudWatch, CloudTrail, Config, Systems Manager y Trusted Advisor.

**Semana 4: costos, soporte y repaso.**

- Opciones de compra (On-Demand, Reserved, Savings Plans, Spot), Cost Explorer, Budgets, Pricing Calculator, Organizations y etiquetas de asignación de costos.
- Planes de soporte y recursos de ayuda de AWS.
- Resuelve el set oficial de preguntas de práctica, anota cada error y repasa solo tus puntos débiles. El día anterior, descansa.

## Servicios clave: qué resuelve cada uno

Muchas preguntas piden relacionar una necesidad con el servicio correcto. Memoriza este mapa:

| Necesidad                                         | Servicio                    |
| ------------------------------------------------- | --------------------------- |
| Servidor virtual                                  | Amazon EC2                  |
| Ejecutar código sin administrar servidores        | AWS Lambda                  |
| Guardar archivos (objetos)                        | Amazon S3                   |
| Disco para una instancia                          | Amazon EBS                  |
| Base de datos relacional gestionada               | Amazon RDS o Aurora         |
| Base de datos NoSQL                               | Amazon DynamoDB             |
| DNS                                               | Amazon Route 53             |
| Entrega de contenido (CDN)                        | Amazon CloudFront           |
| Red privada virtual                               | Amazon VPC                  |
| Auditar quién hizo qué en la cuenta               | AWS CloudTrail              |
| Métricas y alarmas                                | Amazon CloudWatch           |
| Controlar y avisar sobre costos                   | AWS Budgets y Cost Explorer |
| Recomendaciones de costo, seguridad y rendimiento | AWS Trusted Advisor         |
| Informes de cumplimiento                          | AWS Artifact                |

Saber cuándo **no** usar algo también cuenta. Para un sitio pequeño o una aplicación sencilla, un servidor virtual tradicional puede ser más simple y más barato que armar la arquitectura equivalente en AWS; lo explicamos en [qué es un VPS y cuándo lo necesitas](/blog/que-es-un-vps-y-cuando-lo-necesitas).

## Recursos gratuitos y práctica con el Free Tier

- **Guía oficial del examen (CLF-C02)**, en la documentación de AWS: lista dominios, objetivos y servicios dentro y fuera de alcance. Es el mejor punto de partida.
- **AWS Skill Builder:** incluye el curso _AWS Cloud Practitioner Essentials_ y un set oficial de preguntas de práctica sin costo. Otros recursos, como el examen de práctica completo, pueden requerir suscripción: verifica qué incluye el plan gratuito.
- **Nivel gratuito (Free Tier):** desde julio de 2025, las cuentas nuevas pueden elegir un plan gratuito con créditos (AWS anunció USD 100 al registrarte y hasta USD 100 más al probar servicios) por un máximo de seis meses. Las reglas cambian: revisa la página oficial antes de crear la cuenta.

Para practicar sin sorpresas en la factura, sigue tres reglas:

1. **Protege la cuenta.** Activa MFA en el usuario root y no lo uses a diario; trabaja con un usuario de IAM o con IAM Identity Center.
2. **Crea un presupuesto el primer día.** Un presupuesto en AWS Budgets con alerta por correo te avisa antes de que el gasto se dispare.
3. **Elimina lo que crees.** Instancias, volúmenes y direcciones IP olvidados son la causa clásica de cobros inesperados.

Con la AWS CLI puedes practicar un ciclo completo en minutos:

```bash
aws sts get-caller-identity                     # ¿con qué identidad trabajo?
aws s3 mb s3://mi-bucket-de-practica-2026       # el nombre debe ser único en todo AWS
echo "hola nube" > nota.txt
aws s3 cp nota.txt s3://mi-bucket-de-practica-2026/
aws s3 ls s3://mi-bucket-de-practica-2026/
aws s3 rm s3://mi-bucket-de-practica-2026/nota.txt
aws s3 rb s3://mi-bucket-de-practica-2026       # elimina el bucket vacío
```

## Estrategia para el día del examen

- Lee la pregunta completa y detecta las palabras clave: «más rentable» (_cost-effective_), «menor esfuerzo operativo» (_least operational overhead_) o «alta disponibilidad».
- Descarta primero las opciones que no encajan: suelen sobrar dos.
- Marca las dudosas y vuelve a ellas al final. Con 90 minutos para 65 preguntas tienes cerca de 80 segundos por pregunta.
- Responde todo: no hay penalización.
- Si lo presentas en línea, prueba el equipo y la conexión el día anterior.

## ¿Vale la pena? Y qué certificación sigue

La Cloud Practitioner es una puerta de entrada, no una prueba de que sepas operar AWS: la propia guía deja fuera de alcance tareas como programar, diseñar arquitectura o diagnosticar problemas. Sirve para ordenar el vocabulario y respaldar a perfiles no técnicos que trabajan con equipos de nube. Para un perfil técnico, el valor real aparece en el siguiente nivel:

- **Solutions Architect – Associate (SAA-C03):** el paso natural si quieres diseñar arquitecturas.
- **Developer – Associate:** si tu foco es construir aplicaciones.
- **AWS Certified AI Practitioner:** si te interesa la IA generativa y el aprendizaje automático en AWS.

Ninguna exige haber aprobado la Cloud Practitioner.

Cuando ya tengas bases y quieras avanzar con acompañamiento, el [curso de AWS](/curso-de-aws) cubre EC2, S3, IAM, VPC, Lambda y costos con práctica real, y sirve para preparar Cloud Practitioner y Solutions Architect. Y si tu empresa necesita llevar cargas reales a la nube (migrar una aplicación, diseñar la arquitectura o reducir la factura), eso es lo que hacemos en nuestra [consultoría AWS](/consultoria-aws).

## Preguntas frecuentes

### ¿Cuánto cuesta la certificación AWS Cloud Practitioner?

El precio de lista que publica AWS es USD 100. En pesos colombianos varía con la TRM y con los impuestos de tu medio de pago. Tras aprobar una certificación obtienes un descuento para el siguiente examen.

### ¿Cuánto tiempo toma prepararla?

Con base técnica, cuatro semanas de 6 a 8 horas suelen alcanzar; desde cero, planea de seis a ocho semanas e incluye práctica en una cuenta propia.

### ¿Se puede presentar en español?

Sí. AWS lista español (Latinoamérica) entre los idiomas del examen; confirma la disponibilidad vigente en tu cuenta. Si prefieres inglés, solicita los 30 minutos adicionales.

### ¿Necesito saber programar?

No. La guía oficial deja fuera de alcance tareas como programar o diseñar arquitecturas; se evalúa que entiendas conceptos, servicios, seguridad y costos.

## Conclusión

La Cloud Practitioner es un buen primer escalón para entender AWS con orden: cuatro semanas de estudio, práctica con presupuesto y alertas, y el set oficial de preguntas para medir tu nivel. Úsala como punto de partida, no como meta.

---

_¿Quieres prepararla con un profesor? Mira el [curso de AWS](/curso-de-aws) o escríbenos por [WhatsApp](https://wa.me/573106041144)._
