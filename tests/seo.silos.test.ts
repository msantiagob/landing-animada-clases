import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { articleSchema, itemListSchema, personSchema } from '~/utils/seo';

/**
 * Guardas de la arquitectura de silos.
 *
 * El SEO por silos se rompe en silencio: alcanza con que una landing pierda su
 * canonical o que un artículo deje de enlazar a su pilar para que Google deje
 * de leer el bloque como una jerarquía. Nada de eso falla un build, así que se
 * comprueba acá.
 */

const ROOT = resolve(__dirname, '..');
const PAGES = resolve(ROOT, 'src/pages');
const POSTS = resolve(ROOT, 'src/data/post');

const page = (name: string) => readFileSync(resolve(PAGES, `${name}.astro`), 'utf8');
const posts = () => readdirSync(POSTS).filter((file) => /\.mdx?$/.test(file));

/** Landings comerciales: una keyword principal, una URL. */
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
];

describe('landings de cada silo', () => {
  it.each(LANDINGS)('existe la página /%s', (slug) => {
    expect(existsSync(resolve(PAGES, `${slug}.astro`))).toBe(true);
  });

  it.each(LANDINGS)('/%s declara su canonical', (slug) => {
    expect(page(slug)).toMatch(/canonical:/);
  });

  // Sin ignoreTitleTemplate, el título se le concatena " | Sonmyd" y se pasa
  // de los ~60 caracteres que muestra Google, cortando la keyword.
  it.each(LANDINGS)('/%s controla su propio título', (slug) => {
    expect(page(slug)).toMatch(/ignoreTitleTemplate: true/);
  });

  it.each(LANDINGS)('/%s emite JSON-LD', (slug) => {
    expect(page(slug)).toMatch(/<StructuredData/);
  });

  it.each(LANDINGS)('/%s declara breadcrumbs', (slug) => {
    expect(page(slug)).toMatch(/breadcrumbSchema/);
  });

  it.each(LANDINGS)('/%s emite FAQs, que es la vía más directa a un rich result', (slug) => {
    expect(page(slug)).toMatch(/faqSchema/);
  });

  it.each(LANDINGS)('/%s captura leads con el interés preseleccionado', (slug) => {
    const source = page(slug);
    expect(source).toMatch(/<LeadCapture/);
    expect(source).toMatch(new RegExp(`interest="${slug}"`));
  });
});

describe('página hub de servicios', () => {
  const servicios = page('servicios');

  // "Servicios" no es una keyword: la página distribuye autoridad, no compite.
  it('enlaza a todas las landings', () => {
    LANDINGS.forEach((slug) => expect(servicios).toContain(`/${slug}`));
  });

  it('declara la lista como ItemList para que se lea como jerarquía', () => {
    expect(servicios).toMatch(/itemListSchema/);
  });
});

describe('artículos del blog', () => {
  it('hay contenido publicado', () => {
    expect(posts().length).toBeGreaterThan(0);
  });

  it.each([
    ['que-es-whatsapp-business-api.md', '/whatsapp-business-api'],
    ['cuanto-cuesta-whatsapp-business-api.md', '/whatsapp-business-api'],
    ['conectar-whatsapp-con-google-sheets.md', '/automatizaciones'],
    ['python-para-automatizar-tareas.md', '/clases-de-python'],
    ['aprender-inteligencia-artificial-desde-cero.md', '/clases-de-ia'],
    ['zapier-make-o-codigo-propio.md', '/automatizaciones'],
    ['que-es-un-vps-y-cuando-lo-necesitas.md', '/servidores-y-vps'],
    ['seguridad-informatica-para-pymes.md', '/ciberseguridad'],
  ])('%s enlaza a su página pilar (%s)', (file, pilar) => {
    expect(readFileSync(resolve(POSTS, file), 'utf8')).toContain(pilar);
  });

  it.each(posts())('%s declara autor, excerpt y fecha', (file) => {
    const source = readFileSync(resolve(POSTS, file), 'utf8');

    expect(source).toMatch(/^author: /m);
    expect(source).toMatch(/^excerpt: /m);
    expect(source).toMatch(/^publishDate: /m);
  });

  it.each(posts())('%s define una meta description propia', (file) => {
    // Sin esto Google recorta el excerpt y suele elegir mal el fragmento.
    expect(readFileSync(resolve(POSTS, file), 'utf8')).toMatch(/description: /);
  });
});

describe('personSchema', () => {
  const schema = personSchema();

  it('identifica al autor para E-E-A-T', () => {
    expect(schema['@type']).toBe('Person');
    expect(schema.name).toBe('Santiago Bedoya');
  });

  it('lo vincula a la organización para consolidar la entidad', () => {
    expect(schema.worksFor).toEqual({ '@id': 'https://sonmyd.co/#organization' });
  });

  it('usa un @id estable, que es lo que permite referenciarlo desde los artículos', () => {
    expect(schema['@id']).toBe('https://sonmyd.co/autor#person');
  });
});

describe('articleSchema', () => {
  const build = (overrides = {}) =>
    articleSchema({
      headline: 'Qué es la WhatsApp Business API',
      description: 'Diferencias con WhatsApp Business.',
      path: '/blog/que-es-whatsapp-business-api',
      datePublished: '2026-08-04T00:00:00.000Z',
      ...overrides,
    });

  it('apunta el mainEntityOfPage a la URL absoluta del artículo', () => {
    expect(build().mainEntityOfPage).toBe('https://sonmyd.co/blog/que-es-whatsapp-business-api');
  });

  it('referencia al autor por @id en vez de duplicar sus datos', () => {
    expect(build().author).toEqual({ '@id': 'https://sonmyd.co/autor#person' });
  });

  it('usa la fecha de publicación como fecha de modificación si no hay otra', () => {
    const schema = build();
    expect(schema.dateModified).toBe(schema.datePublished);
  });

  it('respeta la fecha de modificación cuando se provee', () => {
    expect(build({ dateModified: '2026-09-01T00:00:00.000Z' }).dateModified).toBe('2026-09-01T00:00:00.000Z');
  });

  it('convierte una imagen relativa en absoluta', () => {
    expect(build({ image: '/portada.png' }).image).toBe('https://sonmyd.co/portada.png');
  });

  it('respeta una imagen que ya es absoluta', () => {
    expect(build({ image: 'https://images.unsplash.com/foto.jpg' }).image).toBe('https://images.unsplash.com/foto.jpg');
  });

  it('omite la imagen cuando no hay', () => {
    expect(build()).not.toHaveProperty('image');
  });
});

describe('itemListSchema', () => {
  it('numera las posiciones desde 1, como exige schema.org', () => {
    const schema = itemListSchema([
      { name: 'Ciberseguridad', path: '/ciberseguridad' },
      { name: 'Servidores y VPS', path: '/servidores-y-vps' },
    ]);

    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[0].url).toBe('https://sonmyd.co/ciberseguridad');
  });

  it('devuelve una lista vacía sin romperse', () => {
    expect(itemListSchema([]).itemListElement).toEqual([]);
  });
});
