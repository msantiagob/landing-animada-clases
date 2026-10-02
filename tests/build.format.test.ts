import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AstroIntegration } from 'astro';
import { describe, expect, it, vi } from 'vitest';
import config from '../astro.config';
import { getCanonical, stripHtmlExtension } from '~/utils/permalinks';

const ROOT = resolve(__dirname, '..');

/**
 * Por qué `build.format: 'file'` (decisión sobre la barra final en Netlify)
 *
 * El sitio usa URLs sin barra final (`trailingSlash: false` en src/config.yaml): el
 * canonical y el sitemap dicen `/blog`. Las páginas prerenderizadas (el blog) las
 * sirve Netlify como archivos, y Netlify decide la barra según la ESTRUCTURA de
 * archivos (Netlify Support, "How can I alter trailing slash behaviour in my URLs?"):
 *
 *   dist/blog.html        -> /blog 200,  /blog/ 301 a /blog
 *   dist/blog/index.html  -> /blog 301 a /blog/,  /blog/ 200
 *
 * Con el formato por defecto de Astro (`directory`, que genera `blog/index.html`)
 * cada URL del sitemap respondería 301 a una URL cuyo canonical apunta de vuelta a
 * la de partida: justo lo que Search Console reporta como "Página con redirección".
 * Con `file` el archivo es `blog.html` y la URL canónica responde 200.
 *
 * Estos tests fijan esa decisión: si alguien cambia una de las piezas sin las otras,
 * falla acá y no en Search Console tres semanas después.
 */

type ConfigHooks = NonNullable<AstroIntegration['hooks']>;

/** Corre el hook de configuración de la integración del tema y devuelve lo que le pide a Astro. */
const settingsRequestedByTheme = async () => {
  const integration = (config.integrations ?? [])
    .flat()
    .find(
      (item): item is AstroIntegration => Boolean(item) && (item as AstroIntegration).name === 'astrowind-integration'
    );
  const updateConfig = vi.fn();
  const logger: { info: () => void; fork: () => typeof logger } = { info: () => {}, fork: () => logger };
  const setup = integration?.hooks['astro:config:setup'] as ConfigHooks['astro:config:setup'];

  await setup?.({
    config: { root: new URL('file:///proyecto/') },
    updateConfig,
    logger,
    addWatchFile: vi.fn(),
  } as never);

  return updateConfig.mock.calls[0]?.[0] as { site: string; base: string; trailingSlash: string } | undefined;
};

describe('astro.config.ts: barra final y formato de salida', () => {
  it('genera archivos .html (build.format: "file") para que Netlify sirva /blog con 200', () => {
    expect(config.build?.format).toBe('file');
  });

  it('el tema le pide a Astro trailingSlash "never", porque src/config.yaml dice trailingSlash: false', async () => {
    const settings = await settingsRequestedByTheme();

    expect(settings?.trailingSlash).toBe('never');
    expect(settings?.site).toBe('https://sonmyd.co');
  });

  it('el formato y la barra final van de la mano, como indica la documentación de Astro (file ↔ never, directory ↔ always)', async () => {
    const settings = await settingsRequestedByTheme();
    const expected = { file: 'never', directory: 'always' } as Record<string, string>;

    expect(settings?.trailingSlash).toBe(expected[config.build?.format ?? 'directory']);
  });

  it('el sitio corre en una función de Netlify y deja prerenderizado solo lo que lo pide', () => {
    expect(config.output).toBe('server');
    expect(config.adapter?.name).toBe('@astrojs/netlify');
  });
});

describe('stripHtmlExtension', () => {
  it.each([
    ['/blog.html', '/blog'],
    ['/blog/2.html', '/blog/2'],
    ['/blog/mi-articulo.html', '/blog/mi-articulo'],
    ['/categoria/ia.html', '/categoria/ia'],
    ['/etiqueta/ia/2.html', '/etiqueta/ia/2'],
  ])('%s -> %s: la URL pública no lleva extensión', (pathname, expected) => {
    expect(stripHtmlExtension(pathname)).toBe(expected);
  });

  it.each(['/', '/blog', '/blog/', '/clases-de-ia', '/blog/mi-articulo', ''])(
    'deja intacta la ruta %j, que ya es pública',
    (pathname) => {
      expect(stripHtmlExtension(pathname)).toBe(pathname);
    }
  );

  it.each([
    ['/a.html/b', '/a.html/b'],
    ['/archivo.htmlx', '/archivo.htmlx'],
    ['/archivo.html.bak', '/archivo.html.bak'],
  ])('solo quita ".html" cuando es el final de la ruta: %s', (pathname, expected) => {
    expect(stripHtmlExtension(pathname)).toBe(expected);
  });

  it('el canonical que sale de la ruta de compilación es la URL pública sin extensión ni barra final', () => {
    expect(String(getCanonical(stripHtmlExtension('/blog.html')))).toBe('https://sonmyd.co/blog');
    expect(String(getCanonical(stripHtmlExtension('/blog/mi-articulo.html')))).toBe(
      'https://sonmyd.co/blog/mi-articulo'
    );
    expect(String(getCanonical(stripHtmlExtension('/blog/2.html')))).toBe('https://sonmyd.co/blog/2');
  });
});

describe('uso de Astro.url en las plantillas', () => {
  const templates = (readdirSync(resolve(ROOT, 'src'), { recursive: true, encoding: 'utf8' }) as string[])
    .filter((file) => file.endsWith('.astro'))
    .map((file) => ({ file, lines: readFileSync(resolve(ROOT, 'src', file), 'utf8').split('\n') }));

  it('hay plantillas que revisar', () => {
    expect(templates.length).toBeGreaterThan(10);
  });

  it('toda lectura de Astro.url pasa por stripHtmlExtension: en las páginas prerenderizadas la ruta de compilación termina en .html', () => {
    const offenders = templates.flatMap(({ file, lines }) =>
      lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => /Astro\.(url|request\.url)\b/.test(line) && !line.includes('stripHtmlExtension('))
        .map(({ line, number }) => `src/${file}:${number}: ${line.trim()}`)
    );

    expect(offenders).toEqual([]);
  });
});
