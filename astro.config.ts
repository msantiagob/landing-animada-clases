import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { LEGACY_REDIRECTS } from './src/data/legacy-redirects';
import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  output: 'server',

  /**
   * Netlify: las páginas con `prerender = false` (casi todo el sitio y la API)
   * corren en una función serverless; las prerenderizadas (el blog) son archivos
   * estáticos. El almacenamiento de leads es Netlify Blobs (src/lib/storage).
   */
  adapter: netlify(),

  /**
   * `file` y no `directory` (el valor por defecto). Netlify hace que el
   * comportamiento de la barra final siga a la estructura de archivos:
   * - `blog/index.html` (directory): `/blog` responde 301 a `/blog/`.
   * - `blog.html` (file): `/blog` responde 200 y `/blog/` va con 301 a `/blog`.
   * El sitio usa `trailingSlash: 'never'` (src/config.yaml): el canonical y el
   * sitemap listan `/blog`, y una URL del sitemap que redirige, cuyo destino
   * declara como canonical la de partida, es justo lo que Search Console
   * reporta como "Página con redirección". Solo cambia el blog (lo único
   * prerenderizado). Ojo: con `file`, `Astro.url.pathname` de esas páginas
   * termina en `.html` durante el build; ver `stripHtmlExtension`.
   */
  build: { format: 'file' },

  /**
   * 301 desde las URLs del sitio anterior que Google ya conoce (lista en
   * src/data/legacy-redirects.ts). El adaptador de Netlify las escribe como
   * reglas de plataforma en `dist/_redirects` (`/origen  /destino  301`) y,
   * como respaldo, Astro las resuelve también dentro de la función. Un origen
   * reemplaza a la página real que tenga esa ruta, así que ninguno puede
   * coincidir con una página existente.
   */
  redirects: Object.fromEntries(
    Object.entries(LEGACY_REDIRECTS).map(([from, destination]) => [from, { status: 301 as const, destination }])
  ),

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      /**
       * El sitemap solo debe listar páginas indexables. Enviar una URL que
       * además responde noindex es contradictorio: Search Console lo reporta
       * como "URL enviada marcada como noindex" y gasta presupuesto de rastreo.
       *
       * Quedan fuera:
       * - /admin y /api, que no son contenido.
       * - Las páginas paginadas del blog (/blog/2, /blog/3...): solo se indexa
       *   la primera, porque el resto tiene contenido casi idéntico.
       * - /etiqueta/*, marcado noindex en config.yaml (tag.robots.index: false).
       */
      filter: (page) => {
        const { pathname } = new URL(page);

        if (/\/(admin|api)(\/|$)/.test(pathname)) return false;
        if (/^\/blog\/\d+\/?$/.test(pathname)) return false;
        if (/^\/etiqueta(\/|$)/.test(pathname)) return false;

        return true;
      },
      changefreq: 'weekly',
      lastmod: new Date(),
    }),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    domains: ['cdn.pixabay.com', 'images.unsplash.com'],
  },

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },

  vite: {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});
