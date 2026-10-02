import type { APIRoute } from 'astro';
import { BUSINESS } from '~/data/business';
import { HUBS, LANDINGS, SILOS, type SiloId } from '~/data/landings';
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
 * Se genera en tiempo de ejecución desde la misma fuente que el sitio: los
 * artículos salen del blog y las páginas de servicio, del registro de landings
 * (src/data/landings.ts). Una landing o un artículo nuevo aparece acá solo. Un
 * archivo estático se desactualiza al segundo post y termina describiendo un
 * sitio que ya no existe.
 */

interface Entry {
  title: string;
  path: string;
  description: string;
}

/** Los hubs son las páginas pilar: la entrada a cada bloque temático del sitio. */
const HUB_ENTRIES: Entry[] = HUBS.map(({ name, slug, description }) => ({
  title: name,
  path: `/${slug}`,
  description,
}));

/** Landings agrupadas por silo, en el orden del registro. */
const SILO_ENTRIES: Array<{ title: string; entries: Entry[] }> = (Object.keys(SILOS) as SiloId[]).map((silo) => ({
  title: SILOS[silo].name,
  entries: LANDINGS.filter((landing) => landing.silo === silo).map(({ name, slug, description }) => ({
    title: name,
    path: `/${slug}`,
    description,
  })),
}));

/** Páginas que no son landings. Las del registro ya salen arriba y no se repiten. */
const INSTITUCIONALES: Entry[] = [
  { title: 'Autor', path: '/autor', description: 'Quién escribe y firma el contenido técnico del sitio.' },
  { title: 'Acerca de nosotros', path: '/about', description: 'Quiénes somos y cómo trabajamos.' },
  { title: 'Contacto', path: '/contact', description: 'Formulario de contacto y WhatsApp para escribirnos.' },
  {
    title: 'Agendar una asesoría',
    path: '/booking',
    description: 'Reserva de una asesoría gratuita: se elige el día y la hora.',
  },
];

const line = ({ title, path, description }: Entry) => `- [${title}](${absoluteUrl(path)}): ${description}`;

const section = (title: string, entries: Entry[]) => `## ${title}\n\n${entries.map(line).join('\n')}`;

/** BUSINESS.address.country es el código ISO ("CO"); a las personas y a los modelos se les da el nombre. */
const COUNTRY = 'Colombia';

const { locality, region } = BUSINESS.address;

/** Misma línea que el pie del sitio: nombre, ciudad y teléfono, siempre iguales. */
const NAP = `${BUSINESS.name} · ${locality}, ${region}, ${COUNTRY} · WhatsApp ${BUSINESS.telephone}`;

const AREA_SERVED = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(BUSINESS.areaServed);

export interface LlmsPost {
  title: string;
  permalink: string;
  excerpt?: string;
}

export const buildLlmsTxt = (posts: LlmsPost[]): string => `# ${BUSINESS.name}

> ${BUSINESS.name} es un negocio de tecnología de ${locality} (${COUNTRY}). Enseña programación e inteligencia artificial y desarrolla software, aplicaciones, bots, agentes de IA y automatizaciones; también administra servidores en la nube, ofrece ciberseguridad para pymes y gestiona marketing digital.

${NAP}. Atiende en línea y de forma presencial en ${AREA_SERVED}. Todo el contenido del sitio está en español y está firmado por Santiago Bedoya, ingeniero de software e instructor.

Criterio editorial: el contenido describe lo que efectivamente hacemos y señala de forma explícita cuándo una solución NO es necesaria para el lector. Si un artículo recomienda no contratar algo, esa recomendación es literal y no una figura retórica.

${section('Páginas principales', HUB_ENTRIES)}

${SILO_ENTRIES.map(({ title, entries }) => section(title, entries)).join('\n\n')}

${section('Páginas institucionales', INSTITUCIONALES)}

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

- WhatsApp: ${BUSINESS.telephone} (https://wa.me/${BUSINESS.whatsappNumber})
- Ubicación: ${locality}, ${region}, ${COUNTRY}
- Formulario: ${absoluteUrl('/contact')}
- Agenda: ${absoluteUrl('/booking')}
`;

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();

  return new Response(buildLlmsTxt(posts), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
