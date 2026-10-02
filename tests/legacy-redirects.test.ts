import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { HUBS, LANDINGS } from '~/data/landings';
import { LEGACY_REDIRECTS } from '~/data/legacy-redirects';

/**
 * Redirecciones 301 de las URLs del sitio anterior.
 *
 * Google conoce estas URLs. Si responden 404, el posicionamiento que
 * acumularon se pierde; si responden 301 a la página que las reemplaza, se
 * transfiere. Las reglas de abajo son las que, rotas, no fallan ningún build:
 * un origen que pisa una página real, una cadena de redirecciones o un destino
 * que no existe se descubren recién cuando Search Console los reporta.
 */

const ROOT = resolve(__dirname, '..');
const PAGES = resolve(ROOT, 'src/pages');

const entries = Object.entries(LEGACY_REDIRECTS);
const sources = Object.keys(LEGACY_REDIRECTS);
const destinations = [...new Set(Object.values(LEGACY_REDIRECTS))];

const PAGE_FILE = /\.(astro|md|mdx|ts|js|html)$/;

/**
 * Rutas estáticas que generan los archivos de src/pages. Las dinámicas
 * ([...blog]) se omiten: una ruta estática siempre gana sobre ellas, así que
 * no pueden colisionar con un origen.
 */
const staticRoutes = (): Set<string> => {
  const routes = new Set<string>();

  for (const file of readdirSync(PAGES, { recursive: true, encoding: 'utf8' })) {
    if (!PAGE_FILE.test(file) || file.includes('[')) continue;

    const route = file
      .replace(PAGE_FILE, '')
      .split('/')
      .filter((segment, index, all) => !(segment === 'index' && index === all.length - 1))
      .join('/');

    routes.add(`/${route}`);
  }

  return routes;
};

const ROUTES = staticRoutes();

/** Lo que se le indexó al sitio anterior y hoy tiene que seguir resolviendo. */
const EXPECTED: Record<string, string> = {
  '/agendar': '/booking',
  '/dashboard': '/admin/dashboard',
  '/servicios/aplicaciones-nativas': '/desarrollo-de-aplicaciones-moviles',
  '/servicios/aplicaciones-web': '/desarrollo-web',
  '/servicios/automatizacion-agentes': '/agentes-de-ia',
  '/servicios/automatizaciones': '/automatizaciones',
  '/servicios/diagnostico': '/booking',
  '/servicios/llms-ia-generativa': '/agentes-de-ia',
  '/servicios/machine-learning': '/desarrollo-de-software',
  '/servicios/python-para-ia': '/clases-de-python',
  '/servicios/soluciones-cloud': '/consultoria-aws',
  '/en': '/',
  '/en/schedule': '/booking',
  '/en/services': '/servicios',
  '/en/services/agent-automation': '/agentes-de-ia',
  '/en/services/automations': '/automatizaciones',
  '/en/services/cloud-solutions': '/consultoria-aws',
  '/en/services/diagnosis': '/booking',
  '/en/services/llms-generative-ai': '/agentes-de-ia',
  '/en/services/machine-learning': '/desarrollo-de-software',
  '/en/services/native-apps': '/desarrollo-de-aplicaciones-moviles',
  '/en/services/python-for-ai': '/clases-de-python',
  '/en/services/web-applications': '/desarrollo-web',
  '/en/privacy': '/privacidad',
  '/en/terms': '/terminos',
  '/privacy': '/privacidad',
  '/terms': '/terminos',
};

describe('el mapa de redirecciones', () => {
  // Quitar una entrada convierte una URL indexada en un 404 sin que nada falle.
  it('conserva todas las URLs antiguas que Google conoce, con su destino', () => {
    expect(LEGACY_REDIRECTS).toEqual(EXPECTED);
  });

  it('no está vacío', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('las versiones en inglés (/en/...) apuntan a la misma página que la versión en español', () => {
    expect(LEGACY_REDIRECTS['/en/services/native-apps']).toBe(LEGACY_REDIRECTS['/servicios/aplicaciones-nativas']);
    expect(LEGACY_REDIRECTS['/en/services/web-applications']).toBe(LEGACY_REDIRECTS['/servicios/aplicaciones-web']);
    expect(LEGACY_REDIRECTS['/en/services/automations']).toBe(LEGACY_REDIRECTS['/servicios/automatizaciones']);
    expect(LEGACY_REDIRECTS['/en/services/python-for-ai']).toBe(LEGACY_REDIRECTS['/servicios/python-para-ia']);
    expect(LEGACY_REDIRECTS['/en/services/cloud-solutions']).toBe(LEGACY_REDIRECTS['/servicios/soluciones-cloud']);
  });
});

describe('orígenes', () => {
  it.each(sources)('%s empieza con "/"', (source) => {
    expect(source.startsWith('/')).toBe(true);
  });

  // /privacy/ y /privacy son dos rutas para el router; la canónica no lleva barra final.
  it.each(sources)('%s no termina en "/"', (source) => {
    expect(source.endsWith('/')).toBe(false);
  });

  it.each(sources)('%s es una ruta limpia: minúsculas, sin espacios, query ni hash', (source) => {
    expect(source).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
  });

  // Una redirección REEMPLAZA a la página con la misma ruta: el origen deja de
  // servir su contenido y pasa a responder 301.
  it.each(sources)('%s no pisa una página real de src/pages', (source) => {
    expect(ROUTES.has(source), `${source} coincide con un archivo de src/pages y lo dejaría inaccesible`).toBe(false);
  });

  it('la raíz no puede ser un origen', () => {
    expect(sources).not.toContain('/');
  });

  // /servicios es el hub de servicios: una página real con tráfico y enlaces
  // entrantes. Si fuera un origen, el hub desaparecería del sitio.
  it('/servicios no es un origen', () => {
    expect(sources).not.toContain('/servicios');
    expect(ROUTES.has('/servicios')).toBe(true);
  });

  it('ningún origen coincide con una landing ni con un hub del registro', () => {
    const live = new Set([...LANDINGS.map((landing) => `/${landing.slug}`), ...HUBS.map((hub) => `/${hub.slug}`)]);

    sources.forEach((source) => expect(live.has(source), `${source} es una página viva del registro`).toBe(false));
  });

  it('el detector de rutas estáticas reconoce las páginas del sitio', () => {
    // Si el escáner dejara de ver las páginas, el test de colisión pasaría en falso.
    ['/', '/booking', '/servicios', '/admin/dashboard', '/llms.txt'].forEach((route) =>
      expect(ROUTES.has(route), `el escáner no encontró ${route}`).toBe(true)
    );
    expect([...ROUTES].some((route) => route.includes('['))).toBe(false);
  });
});

describe('las páginas demo de la plantilla', () => {
  it.each(['privacy.md', 'terms.md'])('src/pages/%s ya no existe', (file) => {
    expect(existsSync(resolve(PAGES, file))).toBe(false);
  });
});

describe('destinos', () => {
  const KNOWN_PAGES = ['/booking', '/admin/dashboard', '/privacidad', '/terminos', '/servicios'];
  const VALID = new Set([
    '/',
    ...LANDINGS.map((landing) => `/${landing.slug}`),
    ...HUBS.map((hub) => `/${hub.slug}`),
    ...KNOWN_PAGES,
  ]);

  it.each(destinations)('%s es la raíz, una landing, un hub o una página conocida', (destination) => {
    expect(VALID.has(destination), `${destination} no está en el registro ni entre las páginas conocidas`).toBe(true);
  });

  // Un 301 hacia un 404 es peor que no redirigir: le dice a Google que la
  // página se movió a un lugar que no existe.
  it.each(destinations)('%s existe como página', (destination) => {
    expect(ROUTES.has(destination), `no hay un archivo en src/pages que sirva ${destination}`).toBe(true);
  });

  it.each(entries)('%s → %s no es una cadena', (source, destination) => {
    expect(sources, `${destination} es a su vez un origen`).not.toContain(destination);
    expect(destination).not.toBe(source);
  });

  it('el destino es una ruta interna absoluta', () => {
    destinations.forEach((destination) => expect(destination).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/));
  });

  it('las URLs de diagnóstico y agenda llevan a la reserva, no a una página de servicio', () => {
    expect(LEGACY_REDIRECTS['/servicios/diagnostico']).toBe('/booking');
    expect(LEGACY_REDIRECTS['/en/services/diagnosis']).toBe('/booking');
    expect(LEGACY_REDIRECTS['/agendar']).toBe('/booking');
    expect(LEGACY_REDIRECTS['/en/schedule']).toBe('/booking');
  });
});

describe('astro.config.ts', () => {
  const config = readFileSync(resolve(ROOT, 'astro.config.ts'), 'utf8');

  it('importa LEGACY_REDIRECTS desde el archivo de datos', () => {
    expect(config).toMatch(/import \{ LEGACY_REDIRECTS \} from '\.\/src\/data\/legacy-redirects'/);
  });

  it('declara `redirects` a partir de LEGACY_REDIRECTS', () => {
    expect(config).toMatch(/redirects:\s*Object\.fromEntries\(\s*Object\.entries\(LEGACY_REDIRECTS\)/);
  });

  // 301 = movida de forma permanente. Con 302 Google conserva la URL vieja
  // indexada y no traspasa el posicionamiento.
  it('responde 301 (permanente) y no 302', () => {
    expect(config).toMatch(/status:\s*301/);
    expect(config).not.toMatch(/status:\s*30[2378]/);
  });

  it('no repite las redirecciones a mano en la configuración', () => {
    expect(config).not.toMatch(/'\/servicios\/[a-z-]+':/);
    expect(config).not.toMatch(/'\/en\/[a-z/-]*':/);
  });
});
