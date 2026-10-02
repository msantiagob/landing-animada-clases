import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { HUBS, LANDINGS, SILOS, type Hub, type Landing } from '~/data/landings';
import { seoImageMeta } from '~/data/seo-images';
import { articleSchema, itemListSchema, personSchema } from '~/utils/seo';

/**
 * Guardas de la arquitectura de silos.
 *
 * El SEO por silos se rompe en silencio: alcanza con que una landing pierda su
 * canonical o que un artículo deje de enlazar a su pilar para que Google deje
 * de leer el bloque como una jerarquía. Nada de eso falla un build, así que se
 * comprueba acá.
 *
 * Este archivo es la vara de aceptación de cada página: no hay una lista de
 * landings escrita a mano, todo sale del registro (src/data/landings.ts). Una
 * landing nueva queda cubierta apenas se registra.
 *
 * Cada landing y cada hub tienen un `describe` cuyo nombre incluye el slug, así
 * que se puede correr solo el de una página (el espacio evita que "desarrollo-web"
 * traiga también a "curso-de-desarrollo-web"):
 *
 *   npx vitest run tests/seo.silos.test.ts -t "landing clases-de-ia"
 *   npx vitest run tests/seo.silos.test.ts -t "hub servicios"
 */

const ROOT = resolve(__dirname, '..');
const PAGES = resolve(ROOT, 'src/pages');
const POSTS = resolve(ROOT, 'src/data/post');

const length = (text: string) => [...text].length;
const isKebabCase = (text: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text);

const pageFile = (slug: string) => resolve(PAGES, `${slug}.astro`);
const readPage = (slug: string) => readFileSync(pageFile(slug), 'utf8');

const posts = () => readdirSync(POSTS).filter((file) => /\.mdx?$/.test(file));
const postFile = (id: string) => ['.md', '.mdx'].map((ext) => resolve(POSTS, `${id}${ext}`)).find(existsSync);

const SLUGS = [...LANDINGS.map((landing) => landing.slug), ...HUBS.map((hub) => hub.slug)];
const PAGES_WITH_REGISTRY: Array<Landing | Hub> = [...HUBS, ...LANDINGS];
const KINDS = ['curso', 'servicio'] as const;

/** Slugs de otros hubs, para exigirle al hub de servicios que los enlace. */
const OTHER_HUBS = ['clases-de-programacion', 'marketing-digital'];

/**
 * Etiquetas de apertura de un componente, con todos sus atributos. Recorre el
 * texto respetando comillas y llaves porque un atributo puede traer un ">" dentro
 * (`bullets={[...]}`, una flecha `=>`), y una regex no lo distingue del cierre.
 */
const openingTags = (source: string, component: string): string[] => {
  const tags: string[] = [];
  let from = 0;

  for (;;) {
    const start = source.indexOf(`<${component}`, from);
    if (start === -1) return tags;

    const afterName = source[start + component.length + 1];
    if (afterName !== undefined && !/[\s/>]/.test(afterName)) {
      from = start + 1;
      continue;
    }

    let depth = 0;
    let quote = '';
    let end = start + component.length + 1;

    for (; end < source.length; end++) {
      const char = source[end];

      if (quote) {
        if (char === quote && source[end - 1] !== '\\') quote = '';
      } else if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      } else if (char === '>' && depth === 0) {
        break;
      }
    }

    tags.push(source.slice(start, end + 1));
    from = end + 1;
  }
};

const attribute = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\b${name}=(["'])([^"']*)\\1`))?.[2];

/** El H1 de la página es lo que va en el slot "title" del Hero, sin las etiquetas. */
const heroTitle = (source: string): string | undefined => {
  const start = source.search(/<Hero[\s/>]/);
  if (start === -1) return undefined;

  const end = source.indexOf('</Hero>', start);
  const hero = end === -1 ? source.slice(start) : source.slice(start, end);
  const title = hero.match(/<Fragment\s+slot=["']title["']\s*>([\s\S]*?)<\/Fragment>/)?.[1];

  return title
    ?.replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Llamada con el slug como único argumento: getLanding('slug'), con cualquier comilla. */
const callWith = (fn: string, slug: string) => new RegExp(`${fn}\\(\\s*['"\`]${slug}['"\`]\\s*\\)`);

/** formId de cada formulario de captación, por página: no puede haber dos iguales en todo el sitio. */
const topLevelPages = readdirSync(PAGES).filter((file) => file.endsWith('.astro'));
const formIdsByPage = new Map<string, string[]>(
  topLevelPages.map((file) => [
    file.replace(/\.astro$/, ''),
    openingTags(readFileSync(resolve(PAGES, file), 'utf8'), 'LeadCapture').flatMap(
      (tag) => attribute(tag, 'formId') ?? []
    ),
  ])
);

// ─────────────────────────────────────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────────────────────────────────────

describe('registro de landings', () => {
  it('declara landings y hubs', () => {
    expect(LANDINGS.length).toBeGreaterThan(0);
    expect(HUBS.length).toBeGreaterThan(0);
  });

  it('los slugs son únicos entre landings y hubs', () => {
    expect(SLUGS.filter((slug, index) => SLUGS.indexOf(slug) !== index)).toEqual([]);
  });

  it('los títulos son únicos entre landings y hubs', () => {
    const titles = PAGES_WITH_REGISTRY.map((entry) => entry.title.toLowerCase());

    expect(titles.filter((title, index) => titles.indexOf(title) !== index)).toEqual([]);
  });

  it('las descripciones son únicas entre landings y hubs', () => {
    const descriptions = PAGES_WITH_REGISTRY.map((entry) => entry.description.toLowerCase());

    expect(descriptions.filter((text, index) => descriptions.indexOf(text) !== index)).toEqual([]);
  });

  it('los nombres de las landings son únicos: son las etiquetas del menú y del formulario', () => {
    const names = LANDINGS.map((landing) => landing.name.toLowerCase());

    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it('cada landing pertenece a un silo definido', () => {
    LANDINGS.forEach((landing) =>
      expect(Object.keys(SILOS), `${landing.slug} usa el silo "${landing.silo}"`).toContain(landing.silo)
    );
  });

  it('cada silo cuelga de un hub que existe y que lo declara entre sus silos', () => {
    Object.entries(SILOS).forEach(([id, silo]) => {
      const hub = HUBS.find((entry) => entry.slug === silo.hub);

      expect(hub, `el silo ${id} apunta al hub inexistente "${silo.hub}"`).toBeDefined();
      expect(hub?.silos, `el hub ${silo.hub} no lista el silo ${id}`).toContain(id);
    });
  });

  it('cada hub agrupa silos definidos', () => {
    HUBS.forEach((hub) =>
      hub.silos.forEach((silo) => expect(Object.keys(SILOS), `${hub.slug} usa el silo "${silo}"`).toContain(silo))
    );
  });

  it('cada silo tiene al menos una landing', () => {
    Object.keys(SILOS).forEach((id) =>
      expect(
        LANDINGS.some((landing) => landing.silo === id),
        `el silo ${id} está vacío`
      ).toBe(true)
    );
  });

  // El menú "Cursos" y el hub de clases se arman por silo; las páginas de curso se
  // cuentan por tipo. Si divergen, un curso aparecería en el menú equivocado.
  it('los cursos son exactamente las landings del silo de formación', () => {
    LANDINGS.forEach((landing) =>
      expect(landing.kind === 'curso', `${landing.slug}: kind=${landing.kind}, silo=${landing.silo}`).toBe(
        landing.silo === 'formacion'
      )
    );
  });

  it.each(['home', 'medellin'])('la imagen de la clave "%s" existe en el manifiesto', (key) => {
    expect(seoImageMeta[key], `falta "${key}" en src/data/seo-images`).toBeDefined();
  });
});

/** Reglas del registro que comparten las landings y los hubs. */
const registryChecks = (entry: Landing | Hub) => {
  it('el slug está en kebab-case', () => {
    expect(isKebabCase(entry.slug)).toBe(true);
  });

  it('el título mide entre 30 y 60 caracteres', () => {
    expect(length(entry.title)).toBeGreaterThanOrEqual(30);
    expect(length(entry.title)).toBeLessThanOrEqual(60);
  });

  it('la keyword principal aparece en el título', () => {
    expect(entry.keyword.trim()).not.toBe('');
    expect(entry.title.toLowerCase()).toContain(entry.keyword.toLowerCase());
  });

  it('la descripción mide entre 120 y 158 caracteres', () => {
    expect(length(entry.description)).toBeGreaterThanOrEqual(120);
    expect(length(entry.description)).toBeLessThanOrEqual(158);
  });

  it('tiene nombre', () => {
    expect(entry.name.trim()).not.toBe('');
  });

  it('su imagen existe en el manifiesto de imágenes', () => {
    expect(seoImageMeta[entry.image], `falta "${entry.image}" en src/data/seo-images`).toBeDefined();
  });
};

/** Reglas del registro que solo aplican a las landings. */
const landingRegistryChecks = (landing: Landing) => {
  it('la tarjeta (summary) no pasa de 110 caracteres', () => {
    expect(landing.summary.trim()).not.toBe('');
    expect(length(landing.summary)).toBeLessThanOrEqual(110);
  });

  it('tiene keywords secundarias', () => {
    expect(landing.secondary.length).toBeGreaterThan(0);
  });

  it('su contraparte (pair) existe y es del otro tipo: de curso a servicio y al revés', () => {
    const pair = LANDINGS.find((candidate) => candidate.slug === landing.pair);

    expect(pair, `pair "${landing.pair}" no está en el registro`).toBeDefined();
    expect(pair?.kind).not.toBe(landing.kind);
    expect(KINDS).toContain(pair?.kind);
  });

  it('las relacionadas existen, no se repiten y ninguna es la propia página', () => {
    expect(landing.related).not.toContain(landing.slug);
    expect(new Set(landing.related).size).toBe(landing.related.length);
    landing.related.forEach((slug) =>
      expect(
        LANDINGS.some((candidate) => candidate.slug === slug),
        `related "${slug}" no está en el registro`
      ).toBe(true)
    );
  });

  it('los artículos que lista existen en src/data/post y no se repiten', () => {
    expect(new Set(landing.posts).size).toBe(landing.posts.length);
    landing.posts.forEach((id) => expect(postFile(id), `no existe src/data/post/${id}.md ni .mdx`).toBeDefined());
  });

  it('tiene un mensaje de WhatsApp prellenado', () => {
    expect(landing.whatsapp.trim()).not.toBe('');
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Páginas
// ─────────────────────────────────────────────────────────────────────────────

describe('páginas con formulario de captación', () => {
  const withInterest = topLevelPages.filter((file) => /interest="/.test(readFileSync(resolve(PAGES, file), 'utf8')));

  // El interés viaja del formulario a la base y al panel: si una página lo declara
  // y no está en el registro, los leads de esa página caen en "Sin especificar".
  it.each(withInterest)('%s pertenece a una landing del registro', (file) => {
    const slug = file.replace(/\.astro$/, '');

    expect(
      LANDINGS.some((landing) => landing.slug === slug),
      `${file} declara interest="..." pero "${slug}" no es una landing del registro`
    ).toBe(true);
  });

  it('toda landing del registro tiene su página en src/pages', () => {
    const missing = LANDINGS.filter((landing) => !existsSync(pageFile(landing.slug))).map((landing) => landing.slug);

    expect(missing, 'landings sin página').toEqual([]);
  });

  it('todo hub del registro tiene su página en src/pages', () => {
    const missing = HUBS.filter((hub) => !existsSync(pageFile(hub.slug))).map((hub) => hub.slug);

    expect(missing, 'hubs sin página').toEqual([]);
  });
});

describe.each(LANDINGS.map((landing) => [landing.slug, landing] as const))('landing %s', (_slug, landing) => {
  const { slug, kind, keyword } = landing;
  const exists = existsSync(pageFile(slug));
  const source = exists ? readPage(slug) : '';

  describe('registro', () => {
    registryChecks(landing);
    landingRegistryChecks(landing);
  });

  it(`existe src/pages/${slug}.astro`, () => {
    expect(exists).toBe(true);
  });

  describe.skipIf(!exists)('contrato de la página', () => {
    it(`obtiene su registro con getLanding('${slug}')`, () => {
      expect(source).toMatch(callWith('getLanding', slug));
    });

    it('arma la metadata con landingMetadata()', () => {
      expect(source).toMatch(/landingMetadata\(/);
    });

    it('emite JSON-LD', () => {
      expect(source).toMatch(/<StructuredData/);
    });

    it('emite breadcrumbs, que Google lee como jerarquía', () => {
      expect(source).toMatch(/breadcrumbSchema/);
    });

    it('emite las FAQs, que es la vía más directa a un rich result', () => {
      expect(source).toMatch(/faqSchema/);
    });

    it(`declara el esquema de ${kind === 'curso' ? 'curso (courseSchema)' : 'servicio (serviceSchema)'}`, () => {
      expect(source).toMatch(kind === 'curso' ? /courseSchema/ : /serviceSchema/);
    });

    // Google pide que los datos estructurados describan contenido visible.
    it('muestra las migas de pan', () => {
      expect(source).toMatch(/<Breadcrumbs/);
    });

    it('usa su imagen del manifiesto con getSeoImage()', () => {
      expect(source).toMatch(/getSeoImage\(/);
    });

    it('tiene el botón de WhatsApp', () => {
      expect(source).toMatch(/<WhatsAppButton/);
    });

    it('enlaza a su contraparte y a las landings relacionadas con <RelatedLinks>', () => {
      expect(source).toMatch(/<RelatedLinks/);
    });

    it('declara el área de servicio con <ServiceArea>', () => {
      expect(source).toMatch(/<ServiceArea/);
    });

    it('muestra las FAQs con <FAQs>', () => {
      expect(source).toMatch(/<FAQs/);
    });

    it('tiene al menos 5 preguntas frecuentes', () => {
      expect((source.match(/\bquestion:/g) ?? []).length).toBeGreaterThanOrEqual(5);
    });

    it('el H1 (slot "title" del Hero) contiene la keyword principal', () => {
      const title = heroTitle(source);

      expect(title, 'no hay <Fragment slot="title"> dentro del <Hero>').toBeDefined();
      expect(title?.toLowerCase(), `H1: "${title}"`).toContain(keyword.toLowerCase());
    });

    it('no escribe un <h1> a mano: el del Hero es el único', () => {
      expect(source).not.toMatch(/<h1[\s>]/i);
    });

    describe('formulario de captación', () => {
      const tags = openingTags(source, 'LeadCapture');

      it('tiene un <LeadCapture>', () => {
        expect(tags.length).toBeGreaterThan(0);
      });

      it(`preselecciona su interés: interest="${slug}"`, () => {
        const interests = tags.map((tag) => attribute(tag, 'interest'));

        expect(interests).toContain(slug);
        expect(
          interests.filter((interest) => interest !== slug),
          'otros intereses en la misma página'
        ).toEqual([]);
      });

      it('declara un formId literal, para que los campos no repitan id', () => {
        tags.forEach((tag) => expect(attribute(tag, 'formId'), tag.slice(0, 80)).toBeTruthy());
      });

      it('su formId no se repite en ninguna otra página', () => {
        const mine = formIdsByPage.get(slug) ?? [];

        expect(new Set(mine).size, 'formId repetido dentro de la misma página').toBe(mine.length);

        mine.forEach((formId) => {
          const others = [...formIdsByPage]
            .filter(([page, ids]) => page !== slug && ids.includes(formId))
            .map(([page]) => page);

          expect(others, `el formId "${formId}" también lo usan`).toEqual([]);
        });
      });
    });
  });

  // El pilar recibe enlaces de sus artículos y los reparte: sin el enlace de
  // vuelta, el artículo queda suelto y la landing no hereda su autoridad.
  if (landing.posts.length > 0) {
    describe('artículos del registro enlazan a la landing', () => {
      landing.posts.forEach((id) => {
        // Si el artículo no existe, ya falla el registro; acá no se repite el error.
        const file = postFile(id);
        const run = file ? it : it.skip;

        run(`${id} contiene un enlace markdown a /${slug}`, () => {
          const text = readFileSync(file!, 'utf8');

          expect(text, `${id} no enlaza a /${slug} (se busca "](/${slug})" o "](/${slug}#")`).toMatch(
            new RegExp(`\\]\\(/${slug}(\\)|#)`)
          );
        });
      });
    });
  }
});

describe.each(HUBS.map((hub) => [hub.slug, hub] as const))('hub %s', (_slug, hub) => {
  const { slug } = hub;
  const exists = existsSync(pageFile(slug));
  const source = exists ? readPage(slug) : '';

  describe('registro', () => {
    registryChecks(hub);
  });

  it(`existe src/pages/${slug}.astro`, () => {
    expect(exists).toBe(true);
  });

  describe.skipIf(!exists)('contrato de la página', () => {
    it(`obtiene su registro con getHub('${slug}')`, () => {
      expect(source).toMatch(callWith('getHub', slug));
    });

    it('arma la metadata con landingMetadata()', () => {
      expect(source).toMatch(/landingMetadata\(/);
    });

    it('lista sus landings con landingsForHub()', () => {
      expect(source).toMatch(/landingsForHub\(/);
    });

    it('declara la lista como ItemList para que se lea como jerarquía', () => {
      expect(source).toMatch(/itemListSchema/);
    });

    it('tiene un <LeadCapture>', () => {
      expect(source).toMatch(/<LeadCapture/);
    });

    it('usa su imagen del manifiesto con getSeoImage()', () => {
      expect(source).toMatch(/getSeoImage\(/);
    });

    if (slug === 'servicios') {
      // Es el hub general: reparte autoridad también hacia los otros dos.
      it.each(OTHER_HUBS)('enlaza al hub /%s', (other) => {
        expect(source).toMatch(new RegExp(`/${other}(?![\\w-])|['"\`]${other}['"\`]`));
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Artículos
// ─────────────────────────────────────────────────────────────────────────────

describe('artículos del blog', () => {
  it('hay contenido publicado', () => {
    expect(posts().length).toBeGreaterThan(0);
  });

  describe.each(posts())('%s', (file) => {
    const { data } = matter(readFileSync(resolve(POSTS, file), 'utf8'));

    it('declara autor, excerpt y fecha', () => {
      expect(data.author, 'author').toBeTruthy();
      expect(data.excerpt, 'excerpt').toBeTruthy();
      expect(data.publishDate, 'publishDate').toBeTruthy();
    });

    // Sin esto Google recorta el excerpt y suele elegir mal el fragmento.
    it('define una meta description propia', () => {
      expect(data.metadata?.description, 'metadata.description').toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Esquemas
// ─────────────────────────────────────────────────────────────────────────────

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

describe('helpers de este archivo', () => {
  describe('openingTags', () => {
    it('devuelve la etiqueta completa aunque un atributo traiga ">" o llaves', () => {
      const source = `<Foo a="1">\n<LeadCapture\n  title="x > y"\n  bullets={['a', (b) => b > 1]}\n  interest="uno"\n/>\n<Bar />`;

      expect(openingTags(source, 'LeadCapture')).toEqual([
        `<LeadCapture\n  title="x > y"\n  bullets={['a', (b) => b > 1]}\n  interest="uno"\n/>`,
      ]);
    });

    it('no confunde un componente con otro que empieza igual', () => {
      expect(openingTags('<LeadCaptureExtra a="1" />', 'LeadCapture')).toEqual([]);
    });

    it('encuentra todas las apariciones', () => {
      expect(openingTags('<A x="1" /><A x="2"></A>', 'A')).toHaveLength(2);
    });

    it('devuelve una lista vacía cuando el componente no aparece', () => {
      expect(openingTags('<div></div>', 'LeadCapture')).toEqual([]);
    });
  });

  describe('heroTitle', () => {
    const page = (title: string) =>
      `<Hero tagline="x">\n  <Fragment slot="title">${title}</Fragment>\n  <Fragment slot="subtitle">otro</Fragment>\n</Hero>`;

    it('quita las etiquetas pero conserva los espacios del texto', () => {
      expect(heroTitle(page('Clases de <span class="text-accent">inteligencia artificial</span> en Medellín'))).toBe(
        'Clases de inteligencia artificial en Medellín'
      );
    });

    it('trata <br> como un espacio', () => {
      expect(heroTitle(page('Clases de<br />Python'))).toBe('Clases de Python');
    });

    it('ignora el slot "title" de otros widgets de la página', () => {
      const source = `${page('Curso de n8n')}\n<Features><Fragment slot="title">Otra cosa</Fragment></Features>`;

      expect(heroTitle(source)).toBe('Curso de n8n');
    });

    it('devuelve undefined si no hay Hero o no define el título', () => {
      expect(heroTitle('<Features />')).toBeUndefined();
      expect(heroTitle('<Hero tagline="x"><Fragment slot="subtitle">a</Fragment></Hero>')).toBeUndefined();
    });
  });
});
