import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import matter from 'gray-matter';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { HUBS, LANDINGS } from '~/data/landings';

import { findVoseo } from './voseo';

/**
 * Guardas de contenido de los artículos del blog.
 *
 * Nada de esto rompe un build: un título de 78 caracteres, una descripción que
 * Google corta a media frase, un "Contanos" en voseo o una landing que lista un
 * artículo sin que el artículo la enlace se publican igual. Por eso se comprueba.
 */

const ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(ROOT, 'src/data/post');
const PAGES_DIR = resolve(ROOT, 'src/pages');

const siteConfig = yaml.load(readFileSync(resolve(ROOT, 'src/config.yaml'), 'utf8')) as {
  metadata: { title: { template: string } };
};

type Frontmatter = {
  title: string;
  excerpt?: string;
  metadata?: { title?: string; description?: string; ignoreTitleTemplate?: boolean };
};

const posts = readdirSync(POSTS_DIR)
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => {
    const raw = readFileSync(resolve(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    return { file, id: file.replace(/\.mdx?$/, ''), raw, content, data: data as Frontmatter };
  });

const postIds = new Set(posts.map((post) => post.id));
const byFile = posts.map((post) => [post.file, post] as const);

const length = (text: string | undefined) => [...(text ?? '')].length;

/** El título que se ve en la pestaña: el de metadata si existe, con o sin la plantilla " | Sonmyd". */
const renderedTitle = ({ data }: (typeof posts)[number]): string => {
  const title = data.metadata?.title ?? data.title;

  return data.metadata?.ignoreTitleTemplate ? title : siteConfig.metadata.title.template.replace('%s', title);
};

/** Separa el cuerpo del cierre: la última regla horizontal (---) marca la línea final de llamada a la acción. */
const splitClosing = (content: string): { body: string; closing: string } => {
  const index = content.lastIndexOf('\n---\n');

  return index === -1
    ? { body: content, closing: '' }
    : { body: content.slice(0, index), closing: content.slice(index) };
};

const withoutCode = (text: string) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

const internalLinks = (text: string): Array<{ path: string; anchor: string }> =>
  [...text.matchAll(/\[([^\]]+)\]\((\/[^)\s]*)\)/g)].map(([, anchor, path]) => ({ anchor, path }));

describe('SEO de cada artículo', () => {
  it('hay artículos publicados', () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it.each(byFile)('%s: el <title> de la pestaña no pasa de 60 caracteres', (_file, post) => {
    // Pasado ese largo Google lo corta y la keyword del final se pierde.
    expect(length(renderedTitle(post)), renderedTitle(post)).toBeLessThanOrEqual(60);
  });

  it.each(byFile)('%s: si define metadata.title, controla la plantilla con ignoreTitleTemplate', (_file, post) => {
    // Sin ignoreTitleTemplate el sitio le suma " | Sonmyd" y se pasa del límite sin avisar.
    if (post.data.metadata?.title) {
      expect(post.data.metadata.ignoreTitleTemplate).toBe(true);
    }
  });

  it.each(byFile)('%s: la meta description mide entre 120 y 158 caracteres', (_file, post) => {
    const description = post.data.metadata?.description;

    expect(description, 'falta metadata.description').toBeDefined();
    expect(length(description)).toBeGreaterThanOrEqual(120);
    expect(length(description)).toBeLessThanOrEqual(158);
  });

  it.each(byFile)('%s: el extracto no pasa de 160 caracteres', (_file, post) => {
    expect(length(post.data.excerpt)).toBeGreaterThan(0);
    expect(length(post.data.excerpt)).toBeLessThanOrEqual(160);
  });

  it.each(byFile)('%s: el titular no pasa de 110 caracteres (límite recomendado para Article)', (_file, post) => {
    expect(length(post.data.title)).toBeLessThanOrEqual(110);
  });

  it('cada artículo tiene un <title> y una descripción propios', () => {
    const titles = posts.map(renderedTitle);
    const descriptions = posts.map((post) => post.data.metadata?.description);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe('copy en tuteo, sin voseo', () => {
  it.each(byFile)('%s no contiene voseo', (_file, post) => {
    expect(findVoseo(post.raw)).toEqual([]);
  });

  // El detector también es código: si deja de ver el voseo, el test de arriba pasa en falso.
  describe('el detector', () => {
    it.each([
      ['Contanos qué querés y te ayudamos.', ['contanos', 'querés']],
      ['Si sos una pyme y necesitás ayuda, mirá esto.', ['sos', 'necesitás', 'mirá']],
      ['Pasá a la API y quedate tranquilo.', ['pasá', 'quedate']],
      ['Vos podés hacerlo, hacelo hoy.', ['vos', 'podés', 'hacelo']],
      ['No sabés cuánto tardás: medí y elegí.', ['sabés', 'tardás', 'medí', 'elegí']],
      ['¿Dónde vivís? Escribinos y contanos.', ['vivís', 'escribinos', 'contanos']],
    ])('detecta el voseo de "%s"', (text, expected) => {
      expect(findVoseo(text)).toEqual(expected);
    });

    it.each([
      'Cuéntanos qué quieres y te ayudamos.',
      'Si eres una pyme y necesitas ayuda, mira esto.',
      'Pasa a la API y quédate tranquilo.',
      'Tú puedes hacerlo, hazlo hoy.',
      'Verás que además podrás ahorrar después, sin interés ni inglés.',
      'Compáralo, instálalo y actívalo; luego escríbenos.',
      'Estás a tiempo: el país entero lo usa y está más cerca de lo que crees.',
      'La señal de SOS no es un verbo.',
    ])('deja pasar el tuteo de "%s"', (text) => {
      expect(findVoseo(text)).toEqual([]);
    });
  });
});

describe('formato Markdown', () => {
  // Prettier reescribe *cursiva* como _cursiva_ y el chequeo de formato falla.
  it.each(byFile)('%s usa _cursiva_ y no *cursiva*', (_file, post) => {
    const singleAsterisk = /(?<![*\w])\*(?![*\s])[^*\n]+(?<![*\s])\*(?![*\w])/;

    expect(withoutCode(post.content)).not.toMatch(singleAsterisk);
  });
});

/**
 * Meta cobra la WhatsApp Business API por mensaje de plantilla desde el 1 de julio de
 * 2025 (antes, por conversación) y cambia condiciones y tarifas con frecuencia. Los
 * artículos explican el modelo sin cifras y mandan al lector a la lista oficial: una
 * tabla de precios propia estaría desactualizada en meses.
 */
describe('precios de la WhatsApp Business API', () => {
  const LISTA_OFICIAL = 'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing';
  const guides = byFile.filter(([file]) =>
    ['que-es-whatsapp-business-api.md', 'cuanto-cuesta-whatsapp-business-api.md'].includes(file)
  );

  it('están las dos guías de WhatsApp', () => {
    expect(guides).toHaveLength(2);
  });

  it.each(guides)('%s explica que Meta cobra por mensaje de plantilla', (_file, post) => {
    expect(post.content).toMatch(/por (?:cada )?mensaje de plantilla/i);
  });

  it.each(guides)('%s no presenta el cobro por conversación como el modelo vigente', (_file, post) => {
    expect(post.content).not.toMatch(/(?:cobra|factura)\s+(?:\*\*)?por conversaci[oó]n/i);
    expect(post.content).not.toMatch(/franja mensual/i);
  });

  it.each(guides)('%s manda al lector a la lista de precios oficial de Meta', (_file, post) => {
    expect(post.content).toContain(`](${LISTA_OFICIAL})`);
  });

  it.each(guides)('%s no publica cifras de precios', (_file, post) => {
    expect(withoutCode(post.content)).not.toMatch(/US\$|USD|COP|\$\s?\d|\d\s?(?:dólares|pesos)/i);
  });

  it('el artículo de costos aclara que las condiciones cambian', () => {
    const costs = guides.find(([file]) => file === 'cuanto-cuesta-whatsapp-business-api.md')![1];

    expect(costs.content).toMatch(/condiciones/i);
    expect(costs.content).toMatch(/1 de julio de 2025/);
  });
});

describe('enlaces internos', () => {
  const landingSlugs = new Set([...LANDINGS.map((landing) => landing.slug), ...HUBS.map((hub) => hub.slug)]);
  const pageSlugs = new Set([
    'blog',
    ...readdirSync(PAGES_DIR)
      .filter((file) => file.endsWith('.astro'))
      .map((file) => file.replace(/\.astro$/, '')),
  ]);

  it.each(byFile)(
    '%s: cada enlace interno apunta a una página, una landing registrada o un artículo que existe',
    (_file, post) => {
      internalLinks(post.content).forEach(({ path }) => {
        const [pathname] = path.split(/[#?]/);
        const blogPost = pathname.match(/^\/blog\/([a-z0-9-]+)$/);

        if (blogPost) {
          expect(postIds.has(blogPost[1]), `${path} no corresponde a ningún artículo`).toBe(true);
          return;
        }

        // Las categorías son páginas generadas; su existencia depende de los artículos.
        if (pathname.startsWith('/categoria/')) return;

        const slug = pathname.replace(/^\//, '');
        expect(
          landingSlugs.has(slug) || pageSlugs.has(slug),
          `${path} no es una página ni una landing del registro`
        ).toBe(true);
      });
    }
  );

  it.each(byFile)('%s: ningún enlace usa un texto genérico como ancla', (_file, post) => {
    const generic =
      /^(aquí|acá|click aquí|clic aquí|haz clic aquí|este enlace|ver más|leer más|más información|link)$/i;

    internalLinks(post.content).forEach(({ anchor }) => {
      expect(anchor.trim(), `ancla genérica: "${anchor}"`).not.toMatch(generic);
    });
  });

  // La landing lista el artículo (LANDINGS[].posts); el artículo tiene que devolver el enlace
  // EN EL CUERPO, en una oración con ancla descriptiva, y no solo en la línea de cierre.
  const pairs = LANDINGS.flatMap((landing) =>
    landing.posts.filter((id) => postIds.has(id)).map((id) => [id, landing.slug] as const)
  );

  it('hay pares artículo-landing que comprobar', () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  it.each(pairs)('%s enlaza en el cuerpo a /%s', (id, slug) => {
    const post = posts.find((item) => item.id === id)!;
    const { body } = splitClosing(post.content);
    const link = new RegExp(`\\]\\(/${slug}(?:[#?][^)]*)?\\)`);

    expect(body, `${id}.md no enlaza a /${slug} fuera de la línea de cierre`).toMatch(link);
  });

  it('las landings solo listan artículos que existen', () => {
    const missing = LANDINGS.flatMap((landing) =>
      landing.posts.filter((id) => !postIds.has(id)).map((id) => `${landing.slug} -> ${id}`)
    );

    expect(missing, 'LANDINGS[].posts apunta a archivos que no están en src/data/post').toEqual([]);
  });

  it('el nombre de cada archivo es un slug válido: de él sale la URL /blog/<slug>', () => {
    posts.forEach((post) => expect(post.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
  });
});

describe('seo-local-medellin: lo que Google cambió en Preguntas y respuestas', () => {
  /**
   * Hecho de un tercero que cambia con el tiempo. Verificado en octubre de 2026:
   * la documentación de Google confirma que la API de Preguntas y respuestas se
   * desactivó el 3 de noviembre de 2025, y un especialista de producto de Google
   * anunció en el foro de ayuda que las preguntas públicas se reemplazan por un
   * botón de IA que responde "con base en tus respuestas y las reseñas relevantes".
   * Google no confirmó una fecha de retiro completa ni un despliegue uniforme
   * (hay países y categorías sin el botón), así que el artículo lo cuenta como lo
   * que fue —un anuncio en curso— y no como algo consumado en todas partes.
   */
  const post = posts.find((item) => item.id === 'seo-local-medellin');
  const bullet = post?.content.split('\n').find((line) => line.startsWith('- **Preguntas y respuestas:**')) ?? '';

  it('encuentra el punto sobre Preguntas y respuestas', () => {
    expect(post).toBeDefined();
    expect(bullet).not.toBe('');
  });

  it('lo atribuye a un anuncio de Google y no lo da por consumado', () => {
    expect(bullet).toMatch(/según un anuncio/i);
    expect(bullet).toMatch(/empezó a reemplazarse/);
  });

  it('dice lo que Google dijo: respuestas del negocio y reseñas relevantes, no "información de tu perfil"', () => {
    expect(bullet).toMatch(/respuestas del negocio/);
    expect(bullet).toMatch(/reseñas relevantes/);
    expect(bullet).not.toMatch(/información de tu perfil/i);
  });

  it('avisa de que el despliegue no es uniforme y manda a revisar el propio perfil', () => {
    expect(bullet).toMatch(/no es uniforme/);
    expect(bullet).toMatch(/según país y categoría/);
    expect(bullet).toMatch(/revisa qué opciones ves en tu perfil/);
  });

  it('no fija un día exacto que Google no confirmó para el cambio visible', () => {
    expect(bullet).not.toMatch(/\b\d{1,2} de (?:noviembre|diciembre)\b/i);
  });
});
