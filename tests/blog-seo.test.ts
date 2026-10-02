import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import matter from 'gray-matter';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HUBS, LANDINGS, SILOS } from '~/data/landings';
import { cleanSlug } from '~/utils/permalinks';
import {
  BLOG_INDEX_DESCRIPTION,
  BLOG_INDEX_TITLE,
  CATEGORY_DESCRIPTIONS,
  flattenBlogTopics,
  getBlogIndexSeo,
  getBlogTopics,
  getCategoryDescription,
  getCategorySeo,
  getTagSeo,
} from '~/utils/blog-seo';

import { findVoseo } from './voseo';

/**
 * Títulos, descripciones y enlaces de las páginas de listado del blog.
 *
 * Las categorías se indexan y entran al sitemap, así que su título y su
 * descripción compiten en buscadores. Las etiquetas no, pero tampoco deben
 * mostrar el texto genérico del sitio. Y los temas del índice salen del registro
 * de landings: si alguien vuelve a escribirlos a mano, se desincronizan en silencio.
 */

const ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(ROOT, 'src/data/post');

const siteConfig = yaml.load(readFileSync(resolve(ROOT, 'src/config.yaml'), 'utf8')) as {
  metadata: { title: { default: string }; description: string };
};

const MAX_TITLE = 60;
const MIN_DESCRIPTION = 120;
const MAX_DESCRIPTION = 158;

const length = (text: string) => [...text].length;

describe('getBlogIndexSeo', () => {
  it('la primera página apunta a "blog de programación, IA y marketing digital" y lleva la marca', () => {
    const { title } = getBlogIndexSeo(1);

    expect(title).toBe(`${BLOG_INDEX_TITLE} | Sonmyd`);
    expect(title.toLowerCase()).toContain('blog de programación');
    expect(title).toContain('IA');
    expect(title.toLowerCase()).toContain('marketing digital');
  });

  it('usa la primera página cuando no se indica ninguna', () => {
    expect(getBlogIndexSeo()).toEqual(getBlogIndexSeo(1));
  });

  it('el título de la primera página cabe en los 60 caracteres que muestra Google', () => {
    expect(length(getBlogIndexSeo(1).title)).toBeLessThanOrEqual(MAX_TITLE);
  });

  it('la descripción mide entre 120 y 158 caracteres y nombra los tres temas', () => {
    const { description } = getBlogIndexSeo(1);

    expect(length(description)).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
    expect(length(description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(description.toLowerCase()).toContain('programación');
    expect(description.toLowerCase()).toContain('inteligencia artificial');
    expect(description.toLowerCase()).toContain('marketing digital');
  });

  it.each([2, 9, 10, 99])('la página %i se distingue por número, sin marca, y cabe en 60 caracteres', (page) => {
    const { title } = getBlogIndexSeo(page);

    expect(title).toBe(`${BLOG_INDEX_TITLE} — Página ${page}`);
    expect(length(title)).toBeLessThanOrEqual(MAX_TITLE);
  });

  it('cada página tiene un título distinto', () => {
    const titles = [1, 2, 3, 4].map((page) => getBlogIndexSeo(page).title);

    expect(new Set(titles).size).toBe(titles.length);
  });

  it('no reutiliza el título ni la descripción genéricos del sitio', () => {
    const { title, description } = getBlogIndexSeo(1);

    expect(title).not.toBe(siteConfig.metadata.title.default);
    expect(description).not.toBe(siteConfig.metadata.description);
  });

  it('está escrito en tuteo', () => {
    expect(findVoseo(`${BLOG_INDEX_TITLE} ${BLOG_INDEX_DESCRIPTION}`)).toEqual([]);
  });
});

describe('getCategorySeo', () => {
  const python = { slug: 'python', title: 'Python' };

  it('titula la página "Artículos de <Categoría> | Sonmyd"', () => {
    expect(getCategorySeo(python).title).toBe('Artículos de Python | Sonmyd');
  });

  it('usa "Artículos de <Categoría>" como encabezado visible', () => {
    expect(getCategorySeo(python).heading).toBe('Artículos de Python');
  });

  it('añade el número a partir de la segunda página', () => {
    expect(getCategorySeo(python, 1).title).toBe('Artículos de Python | Sonmyd');
    expect(getCategorySeo(python, 2).title).toBe('Artículos de Python — Página 2 | Sonmyd');
    expect(getCategorySeo(python, 12).title).toBe('Artículos de Python — Página 12 | Sonmyd');
  });

  it('mantiene el mismo encabezado en todas las páginas', () => {
    expect(getCategorySeo(python, 3).heading).toBe(getCategorySeo(python, 1).heading);
  });

  it('el título de una categoría con nombre largo sigue cabiendo en 60 caracteres', () => {
    const { title } = getCategorySeo({ slug: 'inteligencia-artificial', title: 'Inteligencia artificial' }, 12);

    expect(length(title)).toBeLessThanOrEqual(MAX_TITLE);
  });

  describe('descripción', () => {
    it('usa la descripción curada de la categoría', () => {
      expect(getCategorySeo(python).description).toBe(CATEGORY_DESCRIPTIONS.python);
    });

    it('busca por slug, no por el título visible', () => {
      const seo = getCategorySeo({ slug: 'whatsapp', title: 'Cualquier otro nombre' });

      expect(seo.description).toBe(CATEGORY_DESCRIPTIONS.whatsapp);
    });

    it('no hereda la descripción genérica del sitio', () => {
      Object.keys(CATEGORY_DESCRIPTIONS).forEach((slug) => {
        expect(getCategorySeo({ slug, title: slug }).description).not.toBe(siteConfig.metadata.description);
      });
    });

    it('cada categoría tiene una descripción distinta de las demás', () => {
      const descriptions = Object.values(CATEGORY_DESCRIPTIONS);

      expect(new Set(descriptions).size).toBe(descriptions.length);
    });

    it('arma una descripción en español a partir del nombre cuando la categoría no tiene una curada', () => {
      const seo = getCategorySeo({ slug: 'devops', title: 'DevOps' });

      expect(seo.description).toContain('DevOps');
      expect(seo.description).toMatch(/^Artículos de la categoría DevOps/);
      expect(length(seo.description)).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
      expect(length(seo.description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
    });

    it('la descripción de respaldo también sale cuando el slug falta', () => {
      expect(getCategoryDescription({ title: 'DevOps' })).toContain('DevOps');
    });

    it('nunca devuelve el respaldo para un slug curado', () => {
      Object.keys(CATEGORY_DESCRIPTIONS).forEach((slug) => {
        expect(getCategoryDescription({ slug, title: slug })).toBe(CATEGORY_DESCRIPTIONS[slug]);
      });
    });

    it('recorta en el límite de una palabra si el nombre de la categoría es larguísimo', () => {
      const category = {
        slug: 'larga',
        title: 'Infraestructura en la nube, servidores dedicados y administración de sistemas operativos Linux',
      };
      const full = getCategoryDescription(category);
      const { description } = getCategorySeo(category);
      const kept = description.slice(0, -1);

      expect(length(full)).toBeGreaterThan(MAX_DESCRIPTION);
      expect(length(description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
      expect(description.endsWith('…')).toBe(true);
      // Lo que se conserva es el principio del texto original y el corte cae entre palabras.
      expect(full.startsWith(kept)).toBe(true);
      expect(full[kept.length]).toMatch(/[\s,;:.\-—]/);
    });

    it.each([2, 10, 99])('en la página %i añade el número y sigue por debajo de 158 caracteres', (page) => {
      Object.keys(CATEGORY_DESCRIPTIONS).forEach((slug) => {
        const { description } = getCategorySeo({ slug, title: slug }, page);

        expect(description.endsWith(`Página ${page}.`)).toBe(true);
        expect(length(description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
      });
    });

    it('la primera página no lleva número', () => {
      expect(getCategorySeo(python, 1).description).not.toMatch(/Página/);
    });
  });
});

describe('CATEGORY_DESCRIPTIONS', () => {
  const entries = Object.entries(CATEGORY_DESCRIPTIONS);

  it.each(entries)('%s: mide entre 120 y 145 caracteres (deja lugar al sufijo de página)', (_slug, description) => {
    expect(length(description)).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
    expect(length(description)).toBeLessThanOrEqual(145);
  });

  it.each(entries)('%s: es una oración completa en tuteo', (_slug, description) => {
    expect(description).toMatch(/\.$/);
    expect(findVoseo(description)).toEqual([]);
  });

  it('las claves son slugs válidos', () => {
    Object.keys(CATEGORY_DESCRIPTIONS).forEach((slug) => expect(cleanSlug(slug)).toBe(slug));
  });

  // Sin esto, una categoría nueva sale con la frase genérica de respaldo y nada lo avisa.
  it('cubre todas las categorías de los artículos publicados', () => {
    const categories = new Set(
      readdirSync(POSTS_DIR)
        .filter((file) => /\.mdx?$/.test(file))
        .map((file) => matter(readFileSync(resolve(POSTS_DIR, file), 'utf8')).data.category as string | undefined)
        .filter((category): category is string => Boolean(category))
    );

    expect(categories.size).toBeGreaterThan(0);

    categories.forEach((category) => {
      expect(
        CATEGORY_DESCRIPTIONS,
        `Falta la descripción de la categoría "${category}" en CATEGORY_DESCRIPTIONS (src/utils/blog-seo.ts)`
      ).toHaveProperty(cleanSlug(category));
    });
  });
});

describe('getTagSeo', () => {
  const tag = { slug: 'python', title: 'python' };

  it('titula la página con la etiqueta entre comillas latinas y la marca', () => {
    expect(getTagSeo(tag).title).toBe('Artículos con la etiqueta «python» | Sonmyd');
  });

  it('muestra "Etiqueta: <nombre>" como encabezado', () => {
    expect(getTagSeo(tag).heading).toBe('Etiqueta: python');
  });

  it('añade el número a partir de la segunda página', () => {
    expect(getTagSeo(tag, 2).title).toBe('Artículos con la etiqueta «python» — Página 2 | Sonmyd');
    expect(getTagSeo(tag, 2).description.endsWith('Página 2.')).toBe(true);
  });

  it('la descripción nombra la etiqueta, está en español y no pasa de 158 caracteres', () => {
    const { description } = getTagSeo(tag);

    expect(description).toContain('«python»');
    expect(length(description)).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
    expect(length(description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(findVoseo(description)).toEqual([]);
  });

  it('no muestra el texto genérico del sitio', () => {
    expect(getTagSeo(tag).description).not.toBe(siteConfig.metadata.description);
  });

  it('recorta una etiqueta larguísima sin pasarse del límite', () => {
    const { description } = getTagSeo({
      slug: 'x',
      title: 'automatización de procesos con inteligencia artificial para pymes colombianas y latinoamericanas',
    });

    expect(length(description)).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(description.endsWith('…')).toBe(true);
  });

  it('el título no es el de la plantilla en inglés', () => {
    expect(getTagSeo(tag).title).not.toMatch(/Posts by tag|Page \d/);
  });
});

describe('getBlogTopics', () => {
  const topics = getBlogTopics();
  const landingPaths = topics.groups.flatMap((group) => group.links.map((link) => link.path));

  it('enlaza a cada hub del registro, en su orden', () => {
    expect(topics.hubs).toEqual(HUBS.map(({ name, slug }) => ({ name, path: `/${slug}` })));
  });

  it('incluye los tres hubs', () => {
    expect(topics.hubs.map((hub) => hub.path)).toEqual(
      expect.arrayContaining(['/clases-de-programacion', '/servicios', '/marketing-digital'])
    );
  });

  it('muestra cada landing del registro exactamente una vez', () => {
    expect(landingPaths).toHaveLength(LANDINGS.length);
    expect([...landingPaths].sort()).toEqual(LANDINGS.map(({ slug }) => `/${slug}`).sort());
  });

  it('agrupa cada landing bajo el silo al que pertenece', () => {
    topics.groups.forEach((group) => {
      const slugs = group.links.map((link) => link.path.slice(1));

      slugs.forEach((slug) => {
        expect(LANDINGS.find((landing) => landing.slug === slug)?.silo).toBe(group.silo);
      });
    });
  });

  it('respeta el orden y el nombre de los silos', () => {
    expect(topics.groups.map((group) => group.silo)).toEqual(Object.keys(SILOS));
    topics.groups.forEach((group) => expect(group.name).toBe(SILOS[group.silo].name));
  });

  it('usa el nombre corto de cada landing como texto del enlace', () => {
    const link = topics.groups.flatMap((group) => group.links).find((item) => item.path === '/clases-de-ia');

    expect(link?.name).toBe(LANDINGS.find((landing) => landing.slug === 'clases-de-ia')?.name);
  });

  it('todas las rutas son absolutas, sin espacios y sin repetirse', () => {
    const paths = [...topics.hubs.map((hub) => hub.path), ...landingPaths];

    paths.forEach((path) => expect(path).toMatch(/^\/[a-z0-9-]+$/));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ningún grupo queda vacío', () => {
    topics.groups.forEach((group) => expect(group.links.length).toBeGreaterThan(0));
  });

  describe('con un registro distinto', () => {
    afterEach(() => {
      vi.doUnmock('~/data/landings');
      vi.resetModules();
    });

    it('deriva todo del registro: omite los silos vacíos y conserva el orden de SILOS', async () => {
      vi.resetModules();
      vi.doMock('~/data/landings', () => ({
        HUBS: [{ slug: 'hub-uno', name: 'Hub uno' }],
        SILOS: {
          a: { name: 'Silo A', hub: 'hub-uno' },
          vacio: { name: 'Silo sin landings', hub: 'hub-uno' },
          c: { name: 'Silo C', hub: 'hub-uno' },
        },
        LANDINGS: [
          { slug: 'uno', name: 'Uno', silo: 'c' },
          { slug: 'dos', name: 'Dos', silo: 'a' },
          { slug: 'tres', name: 'Tres', silo: 'c' },
        ],
      }));

      const { getBlogTopics: getMockedTopics } = await import('~/utils/blog-seo');
      const mocked = getMockedTopics();

      expect(mocked.hubs).toEqual([{ name: 'Hub uno', path: '/hub-uno' }]);
      expect(mocked.groups).toEqual([
        { silo: 'a', name: 'Silo A', links: [{ name: 'Dos', path: '/dos' }] },
        {
          silo: 'c',
          name: 'Silo C',
          links: [
            { name: 'Uno', path: '/uno' },
            { name: 'Tres', path: '/tres' },
          ],
        },
      ]);
    });
  });
});

describe('flattenBlogTopics', () => {
  it('pone los hubs primero y luego las landings agrupadas', () => {
    const topics = getBlogTopics();
    const flat = flattenBlogTopics(topics);

    expect(flat.slice(0, topics.hubs.length)).toEqual(topics.hubs);
    expect(flat).toHaveLength(HUBS.length + LANDINGS.length);
  });

  it('no pierde ni duplica ningún enlace: es lo que declara el ItemList y lo que se ve en pantalla', () => {
    const topics = getBlogTopics();
    const shown = [...topics.hubs, ...topics.groups.flatMap((group) => group.links)].map((link) => link.path);

    expect(flattenBlogTopics(topics).map((link) => link.path)).toEqual(shown);
  });

  it('devuelve una lista vacía si no hay nada que enlazar', () => {
    expect(flattenBlogTopics({ hubs: [], groups: [] })).toEqual([]);
  });
});
