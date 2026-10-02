import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUSINESS } from '~/data/business';
import { HUBS, LANDINGS, SILOS, type SiloId } from '~/data/landings';
import { footerData } from '~/navigation';
import { GET, buildLlmsTxt } from '~/pages/llms.txt';
import { fetchPosts } from '~/utils/blog';
import { BOOKING_DURATION_MINUTES } from '~/utils/booking';

// llms.txt lee los artículos con fetchPosts, que depende de `astro:content` y solo
// existe dentro de Astro. Se reemplaza para ejecutar el endpoint real en el test.
vi.mock('~/utils/blog', () => ({ fetchPosts: vi.fn() }));

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

/** Archivos de un directorio (recursivo) que cumplen el patrón, como rutas desde la raíz. */
const list = (dir: string, pattern: RegExp): string[] =>
  readdirSync(resolve(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => pattern.test(file))
    .map((file) => `${dir}/${file}`)
    .sort();

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
   * archivo porque estaba escrito escapado dentro de una expresión regular.
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

  it('BUSINESS.url coincide con el dominio de config.yaml', () => {
    expect(BUSINESS.url).toBe(dominio);
  });

  // sonmyd.com no tiene registros MX: un correo en ese dominio no recibe nada.
  it('ningún archivo de configuración quedó apuntando al dominio viejo, ni en un correo', () => {
    ['src/config.yaml', 'public/robots.txt', 'src/utils/seo.ts', 'src/data/business.ts'].forEach((file) => {
      const viejas = read(file).match(/\bsonmyd\.com\b/g) ?? [];
      expect(viejas, `${file} conserva referencias a sonmyd.com`).toEqual([]);
    });
  });
});

describe('llms.txt', () => {
  const llms = read('src/pages/llms.txt.ts');

  const POSTS = [
    { title: 'Qué es n8n', permalink: 'blog/que-es-n8n', excerpt: 'Guía para empezar con n8n.' },
    { title: 'Sin resumen', permalink: 'blog/sin-resumen' },
  ];

  const body = async (posts: unknown[] = POSTS) => {
    vi.mocked(fetchPosts).mockResolvedValue(posts as never);
    return (await GET({} as never)).text();
  };

  /** Texto de la sección `## título`, hasta la siguiente. */
  const sectionOf = (text: string, title: string) => {
    const start = text.indexOf(`\n## ${title}\n`);
    expect(start, `falta la sección "${title}"`).toBeGreaterThan(-1);
    const end = text.indexOf('\n## ', start + 1);
    return text.slice(start, end === -1 ? undefined : end);
  };

  beforeEach(() => {
    vi.mocked(fetchPosts).mockResolvedValue(POSTS as never);
  });

  describe('el archivo', () => {
    it('se genera desde los posts reales y no desde una lista escrita a mano', () => {
      expect(llms).toMatch(/fetchPosts/);
    });

    it('arma las páginas desde el registro de landings y no desde una lista escrita a mano', () => {
      expect(llms).toMatch(/LANDINGS/);
      expect(llms).toMatch(/HUBS/);
      LANDINGS.forEach(({ slug }) => expect(llms, slug).not.toContain(`'/${slug}'`));
    });

    it('usa URLs absolutas, que es lo único que un modelo puede citar', () => {
      expect(llms).toMatch(/absoluteUrl/);
      expect(llms).not.toMatch(/\]\(\/[a-z]/);
    });

    it('toma los datos del negocio de BUSINESS y no los repite escritos a mano', () => {
      expect(llms).toMatch(/BUSINESS/);
      expect(llms).not.toContain(BUSINESS.telephone);
      expect(llms).not.toContain(BUSINESS.whatsappNumber);
    });
  });

  describe('la respuesta', () => {
    it('devuelve texto plano en UTF-8', async () => {
      const response = await GET({} as never);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    it('se puede cachear una hora', async () => {
      expect((await GET({} as never)).headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    it('empieza con el nombre del sitio como título y un resumen en cita', async () => {
      const text = await body();

      expect(text.startsWith(`# ${BUSINESS.name}\n\n> `)).toBe(true);
    });
  });

  describe('páginas del registro', () => {
    it.each(HUBS.map((hub) => [hub.slug, hub] as const))('lista el hub %s con su descripción', async (slug, hub) => {
      const text = await body();

      expect(text).toContain(`- [${hub.name}](https://sonmyd.co/${slug}): ${hub.description}`);
    });

    it.each(LANDINGS.map((landing) => [landing.slug, landing] as const))(
      'lista la landing %s con su descripción',
      async (slug, landing) => {
        const text = await body();

        expect(text).toContain(`- [${landing.name}](https://sonmyd.co/${slug}): ${landing.description}`);
      }
    );

    it('cada página del registro aparece una sola vez', async () => {
      const text = await body();

      [...HUBS, ...LANDINGS].forEach(({ slug }) =>
        expect(text.split(`](https://sonmyd.co/${slug})`), slug).toHaveLength(2)
      );
    });

    it('agrupa las landings por silo, con el nombre del silo como título', async () => {
      const text = await body();

      (Object.keys(SILOS) as SiloId[]).forEach((silo) => {
        const section = sectionOf(text, SILOS[silo].name);

        LANDINGS.forEach((landing) => {
          const listed = section.includes(`](https://sonmyd.co/${landing.slug})`);
          expect(listed, `${landing.slug} en la sección ${SILOS[silo].name}`).toBe(landing.silo === silo);
        });
      });
    });

    it('respeta el orden de los silos del registro', async () => {
      const text = await body();
      const positions = Object.values(SILOS).map((silo) => text.indexOf(`\n## ${silo.name}\n`));

      expect(positions.every((position) => position > -1)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it('lista los hubs como páginas principales', async () => {
      const section = sectionOf(await body(), 'Páginas principales');

      HUBS.forEach((hub) => expect(section).toContain(`](https://sonmyd.co/${hub.slug})`));
      LANDINGS.forEach((landing) => expect(section).not.toContain(`](https://sonmyd.co/${landing.slug})`));
    });

    it('no repite como institucionales las páginas que ya están en el registro', async () => {
      const section = sectionOf(await body(), 'Páginas institucionales');

      [...HUBS, ...LANDINGS].forEach(({ slug }) => expect(section).not.toContain(`/${slug})`));
      expect(section).toContain('](https://sonmyd.co/autor)');
      expect(section).toContain('](https://sonmyd.co/about)');
    });
  });

  describe('páginas institucionales', () => {
    const institucionales = async () => sectionOf(await body(), 'Páginas institucionales');

    it('lista autor, acerca de, contacto y agenda con URL absoluta', async () => {
      const section = await institucionales();

      ['autor', 'about', 'contact', 'booking'].forEach((slug) =>
        expect(section, slug).toContain(`](https://sonmyd.co/${slug})`)
      );
    });

    // La API agenda turnos de una hora (BOOKING_DURATION_MINUTES). El índice que leen
    // los modelos anunciaba "30 minutos" y contradecía la reserva a la que lleva.
    it('la agenda no anuncia una duración distinta a la del turno de reserva', async () => {
      const section = await institucionales();
      const minutos = [...section.matchAll(/(\d+)\s*min/gi)].map(([, cantidad]) => Number(cantidad));

      expect(BOOKING_DURATION_MINUTES).toBe(60);
      expect(section).not.toMatch(/30\s*min|media hora/i);
      minutos.forEach((cantidad) => expect(cantidad).toBe(BOOKING_DURATION_MINUTES));
    });

    it('la agenda se presenta como asesoría gratuita, igual que en la página y en el menú', async () => {
      expect(await institucionales()).toMatch(/\[Agendar una asesoría\]\(https:\/\/sonmyd\.co\/booking\): .*gratuita/);
    });

    // contact.astro documenta que no se promete ningún plazo: no se ha medido ninguno.
    it('no promete un plazo de respuesta: el sitio no lo mide', async () => {
      const section = await institucionales();

      expect(section).not.toMatch(/\d+\s*horas/i);
      expect(section).not.toMatch(/respuesta en|respondemos en/i);
    });
  });

  describe('artículos', () => {
    it('lista cada artículo con URL absoluta bajo /blog y su extracto', async () => {
      const text = await body();

      expect(text).toContain('- [Qué es n8n](https://sonmyd.co/blog/que-es-n8n): Guía para empezar con n8n.');
    });

    it('usa un texto de respaldo cuando el artículo no trae extracto', async () => {
      const text = await body();

      expect(text).toContain('- [Sin resumen](https://sonmyd.co/blog/sin-resumen): Artículo técnico en español.');
    });

    it('avisa cuando todavía no hay artículos, en vez de dejar la sección vacía', async () => {
      const section = sectionOf(await body([]), 'Artículos');

      expect(section).toContain('Todavía no hay artículos publicados.');
    });
  });

  describe('contacto', () => {
    it('no publica ningún correo: no hay uno que funcione', async () => {
      const text = await body();

      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      expect(text).not.toContain('hola@sonmyd.com');
      expect(text).not.toMatch(/mailto:/i);
    });

    it('ofrece el WhatsApp y el teléfono del negocio, tal cual están en BUSINESS', async () => {
      const section = sectionOf(await body(), 'Contacto');

      expect(section).toContain(BUSINESS.telephone);
      expect(section).toContain(`https://wa.me/${BUSINESS.whatsappNumber}`);
    });

    it('ofrece el formulario y la agenda con URL absoluta', async () => {
      const section = sectionOf(await body(), 'Contacto');

      expect(section).toContain('https://sonmyd.co/contact');
      expect(section).toContain('https://sonmyd.co/booking');
    });

    it('ubica el negocio en Medellín, no en otra ciudad', async () => {
      const text = await body();

      expect(text).toContain(BUSINESS.address.locality);
      expect(text).not.toMatch(/Bogot[aá]/i);
    });

    it('repite la misma línea de nombre, ciudad y teléfono que el pie del sitio', async () => {
      expect(await body()).toContain(footerData.description);
    });

    it('menciona los municipios donde se atiende en persona', async () => {
      const text = await body();

      BUSINESS.areaServed.forEach((municipio) => expect(text).toContain(municipio));
    });
  });

  describe('buildLlmsTxt', () => {
    it('funciona sin artículos', () => {
      expect(buildLlmsTxt([])).toContain('Todavía no hay artículos publicados.');
    });

    it('termina con un salto de línea', () => {
      expect(buildLlmsTxt([]).endsWith('\n')).toBe(true);
    });
  });
});

describe('migas de pan visibles', () => {
  /** Landings y hubs del registro, más las páginas sueltas que también las llevan. */
  const PAGINAS = [...LANDINGS.map((landing) => landing.slug), ...HUBS.map((hub) => hub.slug), 'autor'];

  // Google pide que los datos estructurados describan contenido visible: un
  // BreadcrumbList sin migas en pantalla es una señal a medias.
  PAGINAS.forEach((slug) => {
    // Si la página todavía no existe, ya falla tests/seo.silos.test.ts; acá no se repite.
    const run = existsSync(resolve(ROOT, `src/pages/${slug}.astro`)) ? it : it.skip;

    run(`/${slug} muestra migas además del JSON-LD`, () => {
      const source = read(`src/pages/${slug}.astro`);

      expect(source).toMatch(/<Breadcrumbs/);
      expect(source).toMatch(/breadcrumbSchema/);
    });
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

describe('restos de la plantilla AstroWind y datos que no son del negocio', () => {
  /**
   * Lo que llega al navegador: páginas (menos el panel y la API), componentes,
   * layouts, artículos y los archivos de datos con texto. Los patrones son lo que
   * se publicó alguna vez por venir de la plantilla o de un sitio anterior.
   */
  const COPY = [
    ...list('src/pages', /\.(astro|md|mdx|ts)$/).filter((file) => !/^src\/pages\/(admin|api)\//.test(file)),
    ...list('src/components', /\.astro$/),
    ...list('src/layouts', /\.astro$/),
    ...list('src/data', /\.(md|mdx|ts)$/),
    'src/navigation.ts',
  ];

  /**
   * `astrowind:config` es el nombre del módulo virtual de la integración, no copy
   * de la plantilla. La negación explícita de soporte 24/7 sí se admite: decir que
   * NO se promete es lo contrario de prometerlo.
   */
  const sanitize = (text: string) =>
    text.replace(/astrowind:config/gi, '').replace(/No prometemos soporte 24\/7/gi, '');

  const LEFTOVERS: Array<{ name: string; pattern: RegExp; example: string }> = [
    { name: 'AstroWind', pattern: /AstroWind/i, example: 'Powered by AstroWind' },
    { name: 'AstroWind LLC', pattern: /AstroWind LLC/i, example: 'refers to AstroWind LLC, 1 Cupertino' },
    { name: 'onwidget (autor de la plantilla)', pattern: /onwidget/i, example: 'github.com/onwidget/astrowind' },
    {
      name: 'blog de ejemplo de la plantilla',
      pattern: /statically generated blog example/i,
      example: 'A statically generated blog example',
    },
    { name: 'The Blog', pattern: /The Blog/, example: 'Welcome to The Blog' },
    { name: 'Back to Blog', pattern: /Back to Blog/i, example: '← Back to Blog' },
    { name: 'min read', pattern: /\bmin read\b/i, example: '5 min read' },
    { name: 'Lorem ipsum', pattern: /lorem ipsum/i, example: 'Lorem ipsum dolor sit amet' },
    {
      name: 'Bogotá (el negocio está en Medellín)',
      pattern: /(?<!America\/)Bogot[aá]/i,
      example: 'Bogotá - Sede Principal',
    },
    {
      name: 'correo hola@sonmyd.com (el dominio no recibe correo)',
      pattern: /hola@sonmyd\.com/i,
      example: 'hola@sonmyd.com',
    },
    { name: 'dominio anterior sonmyd.com', pattern: /\bsonmyd\.com\b/i, example: 'https://sonmyd.com/servicios' },
    { name: '500 proyectos', pattern: /500\+?\s*proyectos/i, example: 'más de 500 proyectos exitosos' },
    { name: 'más de 500', pattern: /más de 500/i, example: 'más de 500 clientes' },
    { name: '15 años', pattern: /\b15\+?\s*años/i, example: 'Con más de 15 años de experiencia' },
    { name: 'estadística 500+ o 150+ de la plantilla', pattern: /\b(500|150)\+/, example: "amount: '500+'" },
    {
      name: 'Proyectos Exitosos (estadística de la plantilla)',
      pattern: /Proyectos Exitosos/i,
      example: 'Proyectos Exitosos',
    },
    {
      name: 'Clientes Satisfechos (estadística de la plantilla)',
      pattern: /Clientes Satisfechos/i,
      example: 'Clientes Satisfechos',
    },
    { name: 'soporte 24/7', pattern: /soporte (técnico )?24\/7/i, example: 'Brindamos soporte 24/7' },
    { name: 'teléfono de relleno de la plantilla', pattern: /234-5678/, example: '+1 (123) 234-5678' },
  ];

  const found = (text: string) =>
    LEFTOVERS.filter(({ pattern }) => pattern.test(sanitize(text))).map(({ name }) => name);

  it('revisa las páginas, los componentes y los artículos, y deja fuera el panel y la API', () => {
    expect(COPY.filter((file) => file.startsWith('src/pages/')).length).toBeGreaterThan(10);
    expect(COPY.filter((file) => file.startsWith('src/components/')).length).toBeGreaterThan(20);
    expect(COPY.filter((file) => file.startsWith('src/data/post/')).length).toBeGreaterThan(5);
    expect(COPY.filter((file) => /^src\/pages\/(admin|api)\//.test(file))).toEqual([]);
  });

  it('incluye las páginas dinámicas del blog y los archivos .md y .mdx', () => {
    expect(COPY).toContain('src/pages/[...blog]/index.astro');
    expect(COPY).toContain('src/pages/[...blog]/[category]/[...page].astro');
    expect(COPY.some((file) => /\.mdx?$/.test(file))).toBe(true);
  });

  // Ninguna página lo importaba y traía un botón "Download" hacia el repositorio de
  // la plantilla. Los patrones de abajo lo detectan si vuelve, pero un layout sin
  // uso no debería ni existir.
  it('LandingLayout, el layout de la plantilla con el enlace "Download", ya no existe', () => {
    expect(existsSync(resolve(ROOT, 'src/layouts/LandingLayout.astro'))).toBe(false);
    expect(list('src/layouts', /\.astro$/)).not.toContain('src/layouts/LandingLayout.astro');
  });

  it.each(COPY)('%s no conserva restos de la plantilla', (file) => {
    const leftovers = found(read(file));

    expect(leftovers, `${file} contiene: ${leftovers.join(', ')}`).toEqual([]);
  });

  describe('los patrones', () => {
    it.each(LEFTOVERS.map(({ name, pattern, example }) => [name, pattern, example] as const))(
      'detectan "%s"',
      (name, _pattern, example) => {
        expect(found(example)).toContain(name);
      }
    );

    it('no confunden el módulo virtual astrowind:config con copy de la plantilla', () => {
      expect(found("import { SITE } from 'astrowind:config';")).toEqual([]);
    });

    it('admiten negar explícitamente el soporte 24/7, pero no prometerlo', () => {
      expect(found('No prometemos soporte 24/7 porque no podríamos cumplirlo.')).toEqual([]);
      expect(found('Ofrecemos soporte 24/7 todo el año.')).toContain('soporte 24/7');
      expect(found('Ofrecemos soporte técnico 24/7.')).toContain('soporte 24/7');
    });

    it('detectan Bogotá con y sin tilde, pero no Medellín', () => {
      expect(found('Sede en Bogota')).toHaveLength(1);
      expect(found('Sede en Bogotá')).toHaveLength(1);
      expect(found('Sede en Medellín')).toEqual([]);
    });

    // Colombia entera usa la zona horaria America/Bogota: es un identificador de
    // la base IANA que aparece en comandos y configuraciones, no una ciudad.
    it('no marcan la zona horaria America/Bogota de un comando', () => {
      expect(found('-e TZ="America/Bogota" \\')).toEqual([]);
    });

    it('detectan los números de la plantilla con y sin signo +', () => {
      expect(found('Con más de 15 años')).toContain('15 años');
      expect(found('Con 15+ años de experiencia')).toContain('15 años');
      expect(found('500+ proyectos')).toContain('500 proyectos');
    });

    it('no marcan texto legítimo parecido', () => {
      expect(found('Hacemos desarrollo de software a medida en Medellín.')).toEqual([]);
      expect(found('Tiempo de lectura: 5 minutos.')).toEqual([]);
      expect(found('Escríbenos por WhatsApp o agenda una llamada.')).toEqual([]);
      expect(found('Nuestro dominio es sonmyd.co')).toEqual([]);
    });
  });
});

describe('página pilar del blog', () => {
  const blogList = read('src/pages/[...blog]/[...page].astro');

  it('tiene contenido propio y no solo el listado', () => {
    expect(blogList).toMatch(/eyebrow/);
    expect(blogList).toMatch(/Artículos técnicos en español/);
  });

  // Los temas del índice salen del registro: si alguien vuelve a escribirlos a
  // mano, una landing nueva no aparece y una renombrada queda con el enlace viejo.
  it('enlaza a los hubs y a las landings desde el registro, sin rutas escritas a mano', () => {
    expect(blogList).toMatch(/getBlogTopics\(/);
    LANDINGS.forEach(({ slug }) => expect(blogList, slug).not.toContain(`'/${slug}'`));
    HUBS.forEach(({ slug }) => expect(blogList, slug).not.toContain(`'/${slug}'`));
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
