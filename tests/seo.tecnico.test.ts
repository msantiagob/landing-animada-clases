import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guardas de SEO técnico.
 *
 * Todo lo que se comprueba acá se rompió alguna vez en producción SIN fallar el
 * build: el logo apuntando a /src/, el canonical relativo, los favicons
 * ausentes y el copy de plantilla publicado. Son fallos silenciosos, y por eso
 * necesitan un test.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('logo', () => {
  // Apuntaba a "/src/assets/...", que solo existe en desarrollo: en producción
  // devolvía 404 en todas las páginas.
  it('importa el asset en vez de escribir una ruta /src/', () => {
    const logo = read('src/components/Logo.astro');

    expect(logo).not.toMatch(/src="\/src\//);
    expect(logo).toMatch(/import logo from/);
  });

  it('declara ancho y alto para no provocar salto de layout', () => {
    const logo = read('src/components/Logo.astro');

    expect(logo).toMatch(/width="32"/);
    expect(logo).toMatch(/height="32"/);
  });
});

describe('canonical', () => {
  // Las páginas declaran canonical: '/ruta' porque es lo cómodo. La
  // normalización a absoluta tiene que pasar en Metadata.astro, en un solo
  // lugar, o cada landing nueva reintroduce el bug.
  it('se normaliza a URL absoluta en Metadata.astro', () => {
    const metadata = read('src/components/common/Metadata.astro');

    expect(metadata).toMatch(/canonical: rawCanonical/);
    expect(metadata).toMatch(/const canonical = String\(getCanonical\(String\(rawCanonical\)\)\)/);
  });
});

describe('favicons y manifest', () => {
  it.each(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'site.webmanifest'])(
    'sirve /%s desde public/',
    (file) => {
      expect(existsSync(resolve(ROOT, 'public', file))).toBe(true);
    }
  );

  it('el manifest no conserva el nombre de la plantilla', () => {
    const manifest = JSON.parse(read('public/site.webmanifest'));

    expect(manifest.name).not.toMatch(/MyWebSite/i);
    expect(manifest.short_name).not.toMatch(/MySite/i);
    expect(manifest.name).toMatch(/Sonmyd/);
    expect(manifest.lang).toBe('es');
  });
});

describe('robots.txt', () => {
  const robots = read('public/robots.txt');

  it('mantiene el panel y la API fuera del rastreo', () => {
    expect(robots).toMatch(/^Disallow: \/admin$/m);
    expect(robots).toMatch(/^Disallow: \/api$/m);
  });

  it('declara el sitemap', () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/sonmyd\.co\/sitemap-index\.xml$/m);
  });

  // Bloquearlos deja el sitio fuera de las respuestas de IA, que hoy es un
  // canal de tráfico real. La decisión de permitirlos es explícita.
  it.each(['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot'])(
    'permite al rastreador de IA %s',
    (agent) => {
      const block = new RegExp(`User-agent: ${agent}\\nAllow: /`);
      expect(robots).toMatch(block);
    }
  );

  it('no bloquea a ningún rastreador de IA', () => {
    expect(robots).not.toMatch(/User-agent: (GPTBot|ClaudeBot|PerplexityBot)\nDisallow: \//);
  });
});

describe('coherencia del dominio', () => {
  /**
   * El dominio aparece en config.yaml, en robots.txt y como respaldo en
   * seo.ts. Al migrar de sonmyd.com a sonmyd.co quedó desincronizado en un
   * archivo porque estaba escapado dentro de una expresión regular.
   *
   * Un dominio distinto entre config y robots.txt manda a Google a un sitemap
   * que no existe, y no falla ningún build.
   */
  const siteConfig = read('src/config.yaml');
  const dominio = siteConfig.match(/^\s*site: '(https:\/\/[^']+)'/m)?.[1];

  it('config.yaml declara el sitio', () => {
    expect(dominio).toBeDefined();
  });

  it('robots.txt apunta al sitemap del MISMO dominio que config.yaml', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${dominio}/sitemap-index.xml`);
  });

  it('el respaldo de seo.ts usa el mismo dominio', () => {
    expect(read('src/utils/seo.ts')).toContain(`SITE?.site ?? '${dominio}'`);
  });

  it('ningún archivo del sitio quedó apuntando al dominio viejo', () => {
    ['src/config.yaml', 'public/robots.txt', 'src/utils/seo.ts'].forEach((file) => {
      // Se admite en un correo (hola@sonmyd.com), no como URL.
      const urlsViejas = read(file).match(/(?<!@)\bsonmyd\.com\b/g) ?? [];
      expect(urlsViejas, `${file} conserva URLs de sonmyd.com`).toEqual([]);
    });
  });
});

describe('llms.txt', () => {
  const llms = read('src/pages/llms.txt.ts');

  it('se genera desde los posts reales y no desde una lista escrita a mano', () => {
    expect(llms).toMatch(/fetchPosts/);
  });

  it('devuelve texto plano', () => {
    expect(llms).toMatch(/'Content-Type': 'text\/plain; charset=utf-8'/);
  });

  it('usa URLs absolutas, que es lo único que un modelo puede citar', () => {
    expect(llms).toMatch(/absoluteUrl/);
    expect(llms).not.toMatch(/\]\(\/[a-z]/);
  });

  it('cubre las diez landings', () => {
    [
      'clases-de-ia',
      'clases-de-python',
      'asistente-de-whatsapp',
      'whatsapp-business-api',
      'llamadas-de-marketing',
      'gestor-de-llamadas',
      'automatizaciones',
      'desarrollo-de-software',
      'servidores-y-vps',
      'ciberseguridad',
    ].forEach((slug) => expect(llms).toContain(`/${slug}`));
  });
});

describe('migas de pan visibles', () => {
  const LANDINGS = [
    'clases-de-ia',
    'clases-de-python',
    'asistente-de-whatsapp',
    'whatsapp-business-api',
    'llamadas-de-marketing',
    'gestor-de-llamadas',
    'automatizaciones',
    'desarrollo-de-software',
    'servidores-y-vps',
    'ciberseguridad',
    'servicios',
    'autor',
  ];

  // Google pide que los datos estructurados describan contenido visible: un
  // BreadcrumbList sin migas en pantalla es una señal a medias.
  it.each(LANDINGS)('/%s muestra migas además del JSON-LD', (slug) => {
    const source = read(`src/pages/${slug}.astro`);

    expect(source).toMatch(/<Breadcrumbs/);
    expect(source).toMatch(/breadcrumbSchema/);
  });

  it('el artículo del blog también las muestra', () => {
    expect(read('src/pages/[...blog]/index.astro')).toMatch(/<Breadcrumbs/);
  });

  it('marca la página actual con aria-current', () => {
    expect(read('src/components/common/Breadcrumbs.astro')).toMatch(/aria-current="page"/);
  });
});

describe('caja de autor', () => {
  it('aparece al pie de cada artículo', () => {
    expect(read('src/pages/[...blog]/index.astro')).toMatch(/<AuthorBox/);
  });

  it('enlaza a /autor con rel="author" para consolidar la entidad', () => {
    const box = read('src/components/blog/AuthorBox.astro');

    expect(box).toMatch(/href="\/autor"/);
    expect(box).toMatch(/rel="author"/);
  });
});

describe('restos de la plantilla AstroWind', () => {
  const pages = readdirSync(resolve(ROOT, 'src/pages'))
    .filter((file) => file.endsWith('.astro'))
    .map((file) => `src/pages/${file}`)
    .concat(['src/pages/[...blog]/[...page].astro', 'src/pages/[...blog]/index.astro']);

  it.each(pages)('%s no conserva texto de la plantilla', (page) => {
    const source = read(page);

    expect(source).not.toMatch(/AstroWind/i);
    expect(source).not.toMatch(/statically generated blog example/i);
    expect(source).not.toMatch(/The Blog/);
  });

  // Eran los números de la plantilla publicados como logros propios: 500+
  // proyectos, 150+ clientes, 15+ años. Publicidad falsa en una página comercial.
  it('la home no publica estadísticas inventadas', () => {
    const home = read('src/pages/index.astro');

    expect(home).not.toMatch(/Proyectos Exitosos/);
    expect(home).not.toMatch(/Clientes Satisfechos/);
    expect(home).not.toMatch(/500\+/);
    expect(home).not.toMatch(/150\+/);
  });

  it('ninguna página promete soporte 24/7, que no se puede cumplir', () => {
    pages.forEach((page) => {
      const source = read(page);
      // Se admite mencionarlo para NEGARLO explícitamente, como en la home.
      const promete = /soporte (técnico )?24\/7/i.test(source) && !/No prometemos soporte 24\/7/i.test(source);
      expect(promete, `${page} promete soporte 24/7`).toBe(false);
    });
  });

  it('ninguna página publica el teléfono de relleno de la plantilla', () => {
    pages.forEach((page) => expect(read(page)).not.toMatch(/234-5678/));
  });
});

describe('página pilar del blog', () => {
  const blogList = read('src/pages/[...blog]/[...page].astro');

  it('tiene contenido propio y no solo el listado', () => {
    expect(blogList).toMatch(/eyebrow/);
    expect(blogList).toMatch(/Artículos técnicos en español/);
  });

  it('enlaza a las páginas de servicio para distribuir autoridad', () => {
    ['/clases-de-ia', '/whatsapp-business-api', '/automatizaciones', '/ciberseguridad'].forEach((path) =>
      expect(blogList).toContain(path)
    );
  });

  // Las páginas 2, 3... tienen contenido casi idéntico: indexarlas genera
  // competencia interna sin sumar tráfico.
  it('solo indexa la primera página del listado', () => {
    expect(blogList).toMatch(/index: blogListRobots\?\.index && currentPage === 1/);
  });

  it('da un canonical distinto a cada página paginada', () => {
    expect(blogList).toMatch(/canonical: currentPage > 1 \? `\/blog\/\$\{currentPage\}` : '\/blog'/);
  });
});
