import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { HUBS, LANDINGS } from '~/data/landings';
import { LEGACY_REDIRECTS } from '~/data/legacy-redirects';

/**
 * El filtro del sitemap vive dentro de astro.config.ts y no se puede importar
 * sin arrancar Astro entero. Se reconstruye acá la misma lógica y se comprueba
 * que el archivo de configuración la declare: si alguien cambia una sin la
 * otra, el test falla.
 *
 * Lo que se protege: un sitemap que lista URLs noindex es contradictorio.
 * Search Console lo reporta como "URL enviada marcada como noindex".
 */

const ROOT = resolve(__dirname, '..');
const config = readFileSync(resolve(ROOT, 'astro.config.ts'), 'utf8');

const shouldInclude = (pathname: string): boolean => {
  if (/\/(admin|api)(\/|$)/.test(pathname)) return false;
  if (/^\/blog\/\d+\/?$/.test(pathname)) return false;
  if (/^\/etiqueta(\/|$)/.test(pathname)) return false;
  return true;
};

describe('filtro del sitemap', () => {
  it.each([
    '/',
    '/servicios',
    '/autor',
    '/about',
    '/booking',
    '/blog',
    '/blog/que-es-whatsapp-business-api',
    '/categoria/python',
    '/contact',
    '/privacidad',
    '/terminos',
  ])('incluye %s', (pathname) => {
    expect(shouldInclude(pathname)).toBe(true);
  });

  // Que una landing nueva entre al sitemap no depende de nadie: sale del registro.
  it.each(LANDINGS.map((landing) => `/${landing.slug}`))('incluye la landing %s', (pathname) => {
    expect(shouldInclude(pathname)).toBe(true);
  });

  it.each(HUBS.map((hub) => `/${hub.slug}`))('incluye el hub %s', (pathname) => {
    expect(shouldInclude(pathname)).toBe(true);
  });

  it.each([
    ['el panel', '/admin'],
    ['una pantalla del panel', '/admin/dashboard'],
    ['la pantalla de acceso', '/admin/login'],
    ['la API', '/api/contact'],
    ['la API de administración', '/api/admin/leads'],
    ['la segunda página del blog', '/blog/2'],
    ['una página alta del blog', '/blog/17'],
    ['una etiqueta', '/etiqueta/python'],
    ['el índice de etiquetas', '/etiqueta'],
  ])('excluye %s (%s)', (_caso, pathname) => {
    expect(shouldInclude(pathname)).toBe(false);
  });

  // Un artículo cuyo slug empieza con dígitos NO es una página paginada.
  it('no confunde un artículo con slug numérico con una página del listado', () => {
    expect(shouldInclude('/blog/5-errores-de-seguridad')).toBe(true);
  });

  it('no excluye un artículo por contener la palabra api en el slug', () => {
    expect(shouldInclude('/blog/que-es-whatsapp-business-api')).toBe(true);
  });

  it('no excluye una landing cuyo slug contiene la palabra api', () => {
    expect(shouldInclude('/whatsapp-business-api')).toBe(true);
  });

  // Las URLs del sitio anterior responden 301: un 301 en el sitemap es lo mismo
  // que una URL noindex, una contradicción que Search Console reporta.
  it('las redirecciones del sitio anterior no son páginas que el sitemap vaya a listar', () => {
    const pages = new Set(
      readdirSync(resolve(ROOT, 'src/pages'), { recursive: true, encoding: 'utf8' })
        .filter((file) => /\.(astro|md|mdx)$/.test(file))
        .map((file) => `/${file.replace(/\.(astro|md|mdx)$/, '').replace(/(^|\/)index$/, '')}`)
    );

    Object.keys(LEGACY_REDIRECTS).forEach((source) =>
      expect(pages.has(source), `${source} tiene una página y una redirección a la vez`).toBe(false)
    );
  });
});

describe('astro.config.ts declara el filtro', () => {
  it('excluye admin y api', () => {
    expect(config).toMatch(/\/\\\/\(admin\|api\)\(\\\/\|\$\)\//);
  });

  it('excluye las páginas paginadas del blog', () => {
    expect(config).toMatch(/\^\\\/blog\\\/\\d\+/);
  });

  it('excluye las etiquetas, que están marcadas noindex en config.yaml', () => {
    expect(config).toMatch(/\^\\\/etiqueta/);
  });

  it('declara el filtro dentro de la integración del sitemap', () => {
    const sitemap = config.slice(config.indexOf('sitemap({'), config.indexOf('mdx()'));

    expect(sitemap).toMatch(/filter:\s*\(page\)/);
  });

  // customPages agrega URLs a mano al sitemap, saltándose lo que Astro descubre.
  it('no agrega URLs a mano con customPages', () => {
    expect(config).not.toMatch(/customPages/);
  });
});

describe('páginas marcadas noindex', () => {
  /**
   * Toda página estática que declare `noindex` tiene que quedar fuera del
   * sitemap. Hoy solo el panel lo hace y lo cubre la regla de /admin; si mañana
   * se suma otra (una página de gracias, por ejemplo) este test obliga a
   * excluirla en el filtro en lugar de descubrirlo en Search Console.
   */
  const routes = readdirSync(resolve(ROOT, 'src/pages'), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.astro$/.test(file) && !file.includes('['))
    .map((file) => ({
      file,
      route: `/${file.replace(/\.astro$/, '').replace(/(^|\/)index$/, '')}`,
      source: readFileSync(resolve(ROOT, 'src/pages', file), 'utf8'),
    }));

  const declaresNoindex = (source: string) => /\bindex:\s*false\b|name="robots"\s+content="[^"]*noindex/i.test(source);

  it('el detector reconoce las dos formas de declarar noindex', () => {
    expect(declaresNoindex('robots: {\n  index: false,\n}')).toBe(true);
    expect(declaresNoindex('<meta name="robots" content="noindex, nofollow" />')).toBe(true);
    expect(declaresNoindex('robots: { index: true }')).toBe(false);
  });

  const noindex = routes.filter(({ source }) => declaresNoindex(source));

  it('el panel declara noindex, así que la comprobación tiene algo que revisar', () => {
    expect(noindex.length).toBeGreaterThan(0);
  });

  it.each(noindex.map(({ route }) => route))('%s declara noindex y el filtro la excluye del sitemap', (route) => {
    expect(shouldInclude(route), `${route} es noindex pero el filtro la incluye`).toBe(false);
  });

  // El error inverso es peor: un noindex copiado por descuido en una landing la
  // saca de Google, y tampoco falla ningún build.
  const commercial = new Set([
    '/',
    '/about',
    '/contact',
    '/booking',
    '/autor',
    ...HUBS.map((hub) => `/${hub.slug}`),
    ...LANDINGS.map((landing) => `/${landing.slug}`),
  ]);

  it.each(routes.filter(({ route }) => commercial.has(route)).map(({ route, source }) => [route, source] as const))(
    '%s es una página comercial y no declara noindex',
    (route, source) => {
      expect(declaresNoindex(source), `${route} declara noindex`).toBe(false);
    }
  );
});

describe('coherencia con config.yaml', () => {
  const siteConfig = readFileSync(resolve(ROOT, 'src/config.yaml'), 'utf8');

  // Si algún día se decide indexar las etiquetas, hay que sacarlas del filtro.
  it('las etiquetas siguen marcadas como noindex', () => {
    const tagBlock = siteConfig.slice(siteConfig.indexOf('    tag:'));
    expect(tagBlock).toMatch(/robots:\s*\n\s*index: false/);
  });

  it('las categorías se indexan, por eso están en el sitemap', () => {
    const categoryBlock = siteConfig.slice(siteConfig.indexOf('    category:'), siteConfig.indexOf('    tag:'));
    expect(categoryBlock).toMatch(/index: true/);
  });
});
