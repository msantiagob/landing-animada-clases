import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * El filtro del sitemap vive dentro de astro.config.ts y no se puede importar
 * sin arrancar Astro entero. Se reconstruye acá la misma lógica y se comprueba
 * que el archivo de configuración la declare: si alguien cambia una sin la
 * otra, el test falla.
 *
 * Lo que se protege: un sitemap que lista URLs noindex es contradictorio.
 * Search Console lo reporta como "URL enviada marcada como noindex".
 */

const config = readFileSync(resolve(__dirname, '..', 'astro.config.ts'), 'utf8');

const shouldInclude = (pathname: string): boolean => {
  if (/\/(admin|api)(\/|$)/.test(pathname)) return false;
  if (/^\/blog\/\d+\/?$/.test(pathname)) return false;
  if (/^\/etiqueta(\/|$)/.test(pathname)) return false;
  return true;
};

describe('filtro del sitemap', () => {
  it.each([
    '/',
    '/ciberseguridad',
    '/clases-de-python',
    '/whatsapp-business-api',
    '/servicios',
    '/autor',
    '/blog',
    '/blog/que-es-whatsapp-business-api',
    '/categoria/python',
    '/contact',
  ])('incluye %s', (pathname) => {
    expect(shouldInclude(pathname)).toBe(true);
  });

  it.each([
    ['el panel', '/admin'],
    ['una pantalla del panel', '/admin/dashboard'],
    ['la API', '/api/contact'],
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
});

describe('coherencia con config.yaml', () => {
  const siteConfig = readFileSync(resolve(__dirname, '..', 'src/config.yaml'), 'utf8');

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
