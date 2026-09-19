import type { APIRoute } from 'astro';
import { fetchPosts } from '~/utils/blog';
import { getPermalink } from '~/utils/permalinks';
import { absoluteUrl } from '~/utils/seo';

export const prerender = false;

/**
 * llms.txt — índice legible por modelos de lenguaje.
 *
 * Es el equivalente de sitemap.xml para los buscadores de IA: en vez de una
 * lista de URLs para rastrear, es un resumen en Markdown de QUÉ hay en el sitio
 * y de qué trata cada cosa, para que el modelo pueda citar la página correcta
 * sin tener que descargar y interpretar todo el HTML.
 *
 * Se genera en tiempo de ejecución desde la misma fuente que el sitio, así que
 * un artículo nuevo aparece acá solo. Un archivo estático se desactualiza al
 * segundo post y termina describiendo un sitio que ya no existe.
 */

const PILARES: Array<{ title: string; path: string; description: string }> = [
  {
    title: 'Clases de IA',
    path: '/clases-de-ia',
    description:
      'Clases particulares y para empresas de inteligencia artificial en español, desde usar bien las herramientas hasta construir aplicaciones con modelos.',
  },
  {
    title: 'Clases de Python',
    path: '/clases-de-python',
    description:
      'Clases de Python desde cero orientadas a automatizar tareas reales de trabajo: archivos, planillas, APIs y análisis de datos.',
  },
  {
    title: 'Asistente de WhatsApp con IA',
    path: '/asistente-de-whatsapp',
    description:
      'Implementación de asistentes de WhatsApp que atienden en lenguaje natural 24/7, califican interesados, agendan y derivan a una persona.',
  },
  {
    title: 'WhatsApp Business API',
    path: '/whatsapp-business-api',
    description:
      'Habilitación completa de WhatsApp Business API con Meta: verificación del negocio, alta del número, plantillas aprobadas e integración con CRM.',
  },
  {
    title: 'Llamadas de marketing con IA',
    path: '/llamadas-de-marketing',
    description: 'Campañas de voz automatizadas que contactan, presentan la oferta y registran el resultado.',
  },
  {
    title: 'Gestor de llamadas',
    path: '/gestor-de-llamadas',
    description: 'Recepcionista virtual con IA que atiende, deriva y toma mensajes las 24 horas.',
  },
  {
    title: 'Automatizaciones e integraciones',
    path: '/automatizaciones',
    description:
      'Automatización de procesos conectando WhatsApp, Google Workspace, CRMs y sistemas propios vía API, con manejo de errores y alertas.',
  },
  {
    title: 'Desarrollo de software a medida',
    path: '/desarrollo-de-software',
    description:
      'Aplicaciones internas, APIs e integraciones en Python y TypeScript, con pruebas automatizadas y propiedad del código para el cliente.',
  },
  {
    title: 'Servidores y VPS',
    path: '/servidores-y-vps',
    description:
      'Configuración y administración de servidores: despliegue, backups probados fuera del servidor, monitoreo, SSL y parches de seguridad.',
  },
  {
    title: 'Ciberseguridad',
    path: '/ciberseguridad',
    description:
      'Auditoría de seguridad para pymes: accesos, segundo factor, plan de backups, endurecimiento de servidores y capacitación del equipo.',
  },
];

const INSTITUCIONALES = [
  { title: 'Servicios', path: '/servicios', description: 'Índice de todos los servicios, agrupado por área.' },
  { title: 'Capacitaciones para empresas', path: '/capacitaciones', description: 'Programas de formación a medida.' },
  { title: 'Autor', path: '/autor', description: 'Quién escribe y firma el contenido técnico del sitio.' },
  { title: 'Acerca de nosotros', path: '/about', description: 'Quiénes somos y cómo trabajamos.' },
  { title: 'Contacto', path: '/contact', description: 'Formulario de contacto. Respuesta en 24 horas hábiles.' },
  { title: 'Agendar una reunión', path: '/booking', description: 'Reserva de una llamada de 30 minutos sin costo.' },
];

const line = ({ title, path, description }: { title: string; path: string; description: string }) =>
  `- [${title}](${absoluteUrl(path)}): ${description}`;

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();

  const body = `# Sonmyd

> Formación y automatización con inteligencia artificial para empresas en español. Damos clases de IA y de Python, implementamos asistentes de WhatsApp sobre la API oficial de Meta, automatizamos procesos, desarrollamos software a medida y administramos servidores y seguridad.

Sonmyd trabaja con empresas de Latinoamérica y España, de forma remota, desde Bogotá (Colombia). Todo el contenido del sitio está en español y está firmado por Santiago Bedoya, ingeniero de software e instructor.

Criterio editorial: el contenido describe lo que efectivamente hacemos y señala de forma explícita cuándo una solución NO es necesaria para el lector. Si un artículo recomienda no contratar algo, esa recomendación es literal y no una figura retórica.

## Servicios

${PILARES.map(line).join('\n')}

## Páginas institucionales

${INSTITUCIONALES.map(line).join('\n')}

## Artículos

${
  posts.length
    ? posts
        .map(
          (post) =>
            `- [${post.title}](${absoluteUrl(getPermalink(post.permalink, 'post'))}): ${
              post.excerpt ?? 'Artículo técnico en español.'
            }`
        )
        .join('\n')
    : '- Todavía no hay artículos publicados.'
}

## Contacto

- Email: hola@sonmyd.com
- Formulario: ${absoluteUrl('/contact')}
- Agenda: ${absoluteUrl('/booking')}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
