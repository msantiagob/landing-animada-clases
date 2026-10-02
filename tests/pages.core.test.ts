import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
import { HUBS, LANDINGS, SILOS } from '~/data/landings';
import type { SiloId } from '~/data/landings';
import { getSeoImageMeta } from '~/data/seo-images';
import { landingPath, landingsBySilo, landingsForHub } from '~/utils/landings';
import { getBlogPermalink, getHomePermalink } from '~/utils/permalinks';
import { personSchema } from '~/utils/seo';

import {
  ROOT,
  astroSource,
  block,
  copyOf,
  copyProps,
  length,
  metadataOf,
  pageSource,
  read,
  visibleText,
} from './source';
import { findVoseo } from './voseo';

/**
 * Páginas principales: inicio, sobre Sonmyd, contacto, agenda, 404 y autor.
 *
 * Ningún build detecta lo que se protege acá: un título que repite la marca, una
 * cifra de clientes que nadie verificó, un correo que rebota, un enlace escrito a
 * mano que se desfasa del registro, un H1 sin la palabra clave. Por eso se leen
 * los .astro como texto (no se pueden importar desde Vitest) y se comprueba cada
 * decisión de contenido.
 *
 * Los datos del negocio salen siempre de BUSINESS; las listas de landings, del
 * registro (src/data/landings.ts). Ningún test las repite escritas a mano.
 */

const siteConfig = yaml.load(read('src/config.yaml')) as {
  metadata: { title: { template: string } };
  apps: { blog: { isEnabled: boolean; list: { pathname: string } } };
};

/** El título que se ve en la pestaña, con o sin la plantilla global " | Sonmyd". */
const renderedTitle = ({ title, ignoreTitleTemplate }: { title: string; ignoreTitleTemplate: boolean }) =>
  ignoreTitleTemplate ? title : siteConfig.metadata.title.template.replace('%s', title);

const brandCount = (title: string) => title.match(/Sonmyd/g)?.length ?? 0;

/**
 * Afirmaciones que el sitio no puede sostener: cifras de clientes o de años, porcentajes,
 * premios, certificaciones, "líder" y testimonios. Ninguna se ha verificado.
 */
const UNVERIFIABLE_CLAIMS =
  /\d[\d.,]*\s*(\+|%)|\b\d+\s*(años|clientes|proyectos|alumnos|estudiantes|empresas|reseñas|opiniones|certificaciones|países|sedes|oficinas)\b|\bmás de \d+|\b(líder|número 1|el mejor|los mejores|premiad[oa]s?|galardonad[oa]s?|certificad[oa]s?|garantizad[oa]s?|garantizamos)\b|testimonios?|reseñas de clientes/i;

const claimsIn = (text: string) => text.match(new RegExp(UNVERIFIABLE_CLAIMS, 'gi')) ?? [];

/** Palabras de interfaz en inglés que la plantilla dejaba en los textos. */
const ENGLISH_UI =
  /\b(book|schedule|appointment|submit|select|call us|meeting|go back|back to|not found|oops|read more|learn more|contact us|get started|sign up|download)\b/i;

const FREE_FORM_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+|mailto:/i;

const pageExists = (slug: string) => existsSync(resolve(ROOT, `src/pages/${slug}.astro`));

const hubSlugs = HUBS.map((hub) => hub.slug);

describe('el detector de afirmaciones sin sustento', () => {
  it.each([
    'Más de 500 clientes confían en nosotros',
    'Con 15+ años de experiencia',
    '98% de satisfacción',
    '120 proyectos entregados',
    'Somos líder en Medellín',
    'Equipo certificado por AWS',
    'Resultados garantizados',
    'Lo que dicen nuestros clientes: testimonios',
    'Número 1 en clases de IA',
  ])('detecta: %s', (text) => {
    expect(claimsIn(text).length, text).toBeGreaterThan(0);
  });

  it.each([
    'Clases 1 a 1 de inteligencia artificial',
    'Un proceso simple, con las reglas claras desde el inicio',
    'Cuatro razones concretas, sin cifras infladas ni promesas vacías.',
    'No prometemos resultados que no podemos sostener',
    'Santiago Bedoya, ingeniero de software e instructor',
    'Atendemos en persona en Medellín y Envigado',
  ])('no marca texto legítimo: %s', (text) => {
    expect(claimsIn(text)).toEqual([]);
  });
});

describe('inicio (index.astro)', () => {
  const home = pageSource('index');
  const metadata = metadataOf(home.frontmatter);
  const copy = copyOf(home);

  describe('metadatos', () => {
    it('el título es exacto y ya trae la marca: no se le suma la plantilla', () => {
      expect(metadata.title).toBe('Software, IA y clases de programación en Medellín | Sonmyd');
      expect(metadata.ignoreTitleTemplate).toBe(true);
      expect(renderedTitle(metadata)).toBe(metadata.title);
      expect(brandCount(renderedTitle(metadata))).toBe(1);
    });

    it('el título no pasa de 60 caracteres, para que Google no lo corte', () => {
      expect(length(metadata.title)).toBeLessThanOrEqual(60);
    });

    it('la descripción mide entre 120 y 158 caracteres y menciona la ciudad y la marca', () => {
      expect(length(metadata.description)).toBeGreaterThanOrEqual(120);
      expect(length(metadata.description)).toBeLessThanOrEqual(158);
      expect(metadata.description).toContain(BUSINESS.address.locality);
      expect(metadata.description).toContain(BUSINESS.name);
    });

    it('la descripción cubre las dos mitades del negocio: desarrollar y enseñar', () => {
      expect(metadata.description).toMatch(/desarrollamos/);
      expect(metadata.description).toMatch(/enseñamos/);
    });

    it('declara su canonical como la raíz', () => {
      expect(metadata.canonical).toBe('/');
    });

    it('la imagen social es la del manifiesto, y el archivo existe', () => {
      const image = getSeoImageMeta('home');

      expect(image).toBeDefined();
      expect(home.frontmatter).toMatch(/getSeoImageMeta\('home'\)/);
      expect(home.frontmatter).toContain('`~/assets/images/seo/${socialImage.file}`');
      expect(existsSync(resolve(ROOT, `src/assets/images/seo/${image!.file}`))).toBe(true);
    });
  });

  describe('H1 y hero', () => {
    const hero = block(home.markup, '<Hero', '</Hero>');
    const title = visibleText(block(hero, '<Fragment slot="title">', '</Fragment>'));

    it('el H1 es "Desarrollo de software, IA y clases de programación en Medellín"', () => {
      expect(title).toBe('Desarrollo de software, IA y clases de programación en Medellín');
    });

    it('el H1 lo pinta el Hero y la página no suma otro', () => {
      expect(home.markup.match(/<h1\b/g)).toBeNull();
      expect(read('src/components/widgets/Hero.astro')).toMatch(/<h1\b/);
    });

    it('el hero usa la imagen "home" del manifiesto', () => {
      expect(home.frontmatter).toMatch(/const homeImage = getSeoImage\('home'\);/);
      expect(hero).toMatch(/<Hero[^>]*image=\{homeImage\}/);
      expect(getSeoImageMeta('home')?.alt.length).toBeGreaterThan(20);
    });

    it('la llamada a la acción lleva a /booking y hay un botón de WhatsApp', () => {
      expect(hero).toMatch(/<Button[^>]*href="\/booking"/s);
      expect(hero).toMatch(/<WhatsAppButton[^>]*location="home-hero"/s);
      expect(pageExists('booking')).toBe(true);
    });

    it('el botón principal es "Agenda una asesoría gratuita", en tuteo', () => {
      expect(hero).toContain('text="Agenda una asesoría gratuita"');
    });

    it('la franja de confianza solo dice lo que se puede sostener', () => {
      const trust = visibleText(block(hero, '<Fragment slot="trust">', '</Fragment>'));

      expect(trust).toContain('Asesoría inicial gratuita');
      expect(claimsIn(trust)).toEqual([]);
    });
  });

  describe('los dos caminos: aprender o contratar', () => {
    it('enlazan a /clases-de-programacion y a /servicios, desde el registro', () => {
      expect(home.frontmatter).toMatch(/const courseHub = getHub\('clases-de-programacion'\);/);
      expect(home.frontmatter).toMatch(/const servicesHub = getHub\('servicios'\);/);

      const paths = block(home.markup, '<WidgetWrapper id="caminos"', '</WidgetWrapper>');
      expect(paths).toContain('href={landingPath(courseHub.slug)}');
      expect(paths).toContain('href={landingPath(servicesHub.slug)}');
    });

    it('las dos páginas existen y las rutas son las esperadas', () => {
      expect(landingPath('clases-de-programacion')).toBe('/clases-de-programacion');
      expect(landingPath('servicios')).toBe('/servicios');
      expect(pageExists('clases-de-programacion')).toBe(true);
      expect(pageExists('servicios')).toBe(true);
    });

    it('ofrecen aprender y hacerlo por ti', () => {
      const paths = visibleText(block(home.markup, '<WidgetWrapper id="caminos"', '</WidgetWrapper>'));

      expect(paths).toContain('Aprende');
      expect(paths).toContain('Lo hacemos por ti');
      expect(paths).toContain('Ver las clases de programación');
      expect(paths).toContain('Ver los servicios');
    });
  });

  describe('cuadrículas desde el registro', () => {
    const courses = landingsForHub('clases-de-programacion');
    const serviceSilos = (Object.keys(SILOS) as SiloId[]).filter((silo) => SILOS[silo].hub === 'servicios');
    const services = serviceSilos.flatMap((silo) => landingsBySilo(silo));
    const marketing = landingsBySilo('marketing');

    it('cursos, servicios y marketing juntos cubren cada landing del registro, una sola vez', () => {
      const slugs = [...courses, ...services, ...marketing].map((landing) => landing.slug);

      expect(slugs).toHaveLength(LANDINGS.length);
      expect(new Set(slugs)).toEqual(new Set(LANDINGS.map((landing) => landing.slug)));
    });

    it('la sección de clases lista los cursos del hub de clases', () => {
      expect(home.frontmatter).toMatch(/const courses = landingsForHub\(courseHub\.slug\);/);
      expect(block(home.markup, '<WidgetWrapper id="clases"', '</WidgetWrapper>')).toMatch(/courses\.map\(/);
      expect(courses.length).toBeGreaterThan(0);
    });

    it('la sección de servicios agrupa por silo los silos que cuelgan del hub de servicios', () => {
      expect(home.frontmatter).toMatch(/SILOS\[silo\]\.hub === servicesHub\.slug/);
      expect(home.frontmatter).toMatch(/landingsBySilo\(silo\)/);
      expect(block(home.markup, '<WidgetWrapper id="servicios"', '</WidgetWrapper>')).toMatch(/serviceGroups\.map\(/);
      expect(serviceSilos).toEqual(['desarrollo', 'ia-automatizacion', 'cloud-seguridad']);
    });

    it('marketing tiene su propia sección, porque su silo cuelga de otro hub', () => {
      expect(home.frontmatter).toMatch(/const marketing = landingsBySilo\('marketing'\);/);
      expect(block(home.markup, '<WidgetWrapper id="marketing"', '</WidgetWrapper>')).toMatch(/marketing\.map\(/);
      expect(SILOS.marketing.hub).toBe('marketing-digital');
    });

    it('cada tarjeta enlaza con landingPath y muestra el resumen del registro', () => {
      const cards = [
        block(home.markup, '<WidgetWrapper id="clases"', '</WidgetWrapper>'),
        block(home.markup, '<WidgetWrapper id="servicios"', '</WidgetWrapper>'),
        block(home.markup, '<WidgetWrapper id="marketing"', '</WidgetWrapper>'),
      ];

      cards.forEach((section) => {
        expect(section).toMatch(/href=\{landingPath\((course|landing)\.slug\)\}/);
        expect(section).toMatch(/\{(course|landing)\.name\}/);
        expect(section).toMatch(/\{(course|landing)\.summary\}/);
      });
    });

    it('cada sección cierra con el enlace a su hub', () => {
      expect(home.markup).toContain('href={landingPath(courseHub.slug)} class={seeAllClass}');
      expect(home.markup).toContain('href={landingPath(servicesHub.slug)} class={seeAllClass}');
      expect(home.markup).toContain('href={landingPath(marketingHub.slug)} class={seeAllClass}');
    });

    it('ninguna landing ni hub se enlaza con una ruta escrita a mano', () => {
      [...LANDINGS.map((landing) => landing.slug), ...hubSlugs].forEach((slug) => {
        expect(home.markup, slug).not.toContain(`href="/${slug}"`);
        expect(home.frontmatter, slug).not.toContain(`'/${slug}'`);
      });
    });

    it('el JSON-LD lista los hubs y las landings del registro', () => {
      expect(home.markup).toMatch(/itemListSchema\(\s*\[\.\.\.HUBS, \.\.\.LANDINGS\]/);
    });
  });

  describe('cómo trabajamos', () => {
    const steps = block(home.markup, '<Steps', '</Steps>');

    it('son cuatro pasos numerados', () => {
      const titles = [...steps.matchAll(/title: '([^']+)'/g)].map(([, title]) => title);

      expect(titles).toHaveLength(4);
      titles.forEach((title, index) => expect(title.startsWith(`${index + 1}. `)).toBe(true));
    });

    it('prometen alcance, plazo y precio por escrito, no un precio ni un plazo concretos', () => {
      const stepsCopy = copyProps(steps).join(' ');

      expect(stepsCopy).toMatch(/qué se hace, cuánto cuesta y en cuánto tiempo/);
      expect(claimsIn(stepsCopy)).toEqual([]);
    });
  });

  describe('por qué Sonmyd', () => {
    const features = block(home.markup, '<Features', '<!-- Local');
    const why = copyProps(features).join(' ');

    it('encuentra el bloque', () => {
      expect(features).toContain('id="por-que-sonmyd"');
      expect(features).toContain('tagline="Por qué Sonmyd"');
    });

    it('da cuatro razones concretas', () => {
      expect(features.match(/title: '/g)).toHaveLength(4);
      expect(why).toContain('Un ingeniero real, no un intermediario');
    });

    it('es honesto: sin cifras, clientes, premios ni testimonios', () => {
      expect(claimsIn(why)).toEqual([]);
      expect(why).not.toMatch(/\d{2,}/);
    });

    it('no importa ningún widget de estadísticas, testimonios, precios ni logos de clientes', () => {
      expect(home.frontmatter).not.toMatch(/widgets\/(Stats|Testimonials|Pricing|Brands|Clients)/);
    });

    it('presenta a Santiago Bedoya y enlaza a su página', () => {
      expect(why).toContain('Santiago Bedoya');
      expect(features).toContain("href: '/autor'");
      expect(pageExists('autor')).toBe(true);
    });
  });

  describe('sección local: Medellín', () => {
    const local = block(home.markup, '<ServiceArea', '</address>');
    const localText = visibleText(local);

    it('declara el área de servicio con ServiceArea', () => {
      expect(home.frontmatter).toMatch(/import ServiceArea from '~\/components\/widgets\/ServiceArea\.astro';/);
      expect(local).toMatch(/<ServiceArea[^>]*id="medellin"[^>]*kind="servicio"/s);
    });

    it('usa la imagen "medellin" del manifiesto, que existe y tiene texto alternativo', () => {
      const image = getSeoImageMeta('medellin');

      expect(home.frontmatter).toMatch(/const medellinImage = getSeoImage\('medellin'\);/);
      expect(local).toContain('{...medellinImage}');
      expect(image?.alt.length).toBeGreaterThan(20);
      expect(existsSync(resolve(ROOT, `src/assets/images/seo/${image!.file}`))).toBe(true);
    });

    it('muestra el nombre, la ciudad y el teléfono desde BUSINESS (NAP), no escritos a mano', () => {
      expect(local).toContain('<address');
      expect(localText).toContain(BUSINESS.name);
      expect(localText).toContain(`${BUSINESS.address.locality}, ${BUSINESS.address.region}, Colombia`);
      expect(localText).toContain(`WhatsApp: ${BUSINESS.telephone}`);
      expect(home.markup).not.toMatch(/\+57|\b310\b/);
    });

    it('no inventa una dirección de calle ni un correo', () => {
      expect(localText).not.toMatch(/\b(calle|carrera|avenida|oficina|piso)\b/i);
      expect(FREE_FORM_EMAIL.test(local)).toBe(false);
    });

    it('ofrece el formulario y la agenda como canales', () => {
      expect(local).toContain('href="/contact"');
      expect(local).toContain('href="/booking"');
    });
  });

  describe('preguntas frecuentes', () => {
    const questions = [...home.frontmatter.matchAll(/question:\s*'([^']+)'/g)].map(([, question]) => question);

    it('son exactamente seis', () => {
      expect(questions).toHaveLength(6);
      expect(home.frontmatter.match(/\banswer:/g)).toHaveLength(6);
    });

    it('cada pregunta es una pregunta en español: abre con ¿ y cierra con ?', () => {
      questions.forEach((question) => {
        expect(question.startsWith('¿'), question).toBe(true);
        expect(question.endsWith('?'), question).toBe(true);
      });
    });

    it('no repiten preguntas', () => {
      expect(new Set(questions).size).toBe(questions.length);
    });

    it('el JSON-LD y las preguntas visibles salen de la MISMA lista', () => {
      expect(home.markup).toMatch(/faqSchema\(faqs\)/);
      expect(home.markup).toMatch(
        /items=\{faqs\.map\(\(\{ question, answer \}\) => \(\{ title: question, description: answer \}\)\)\}/
      );
    });

    it('cubren lo que la gente pregunta antes de escribir: qué hacen, dónde, cuánto cuesta y cómo empezar', () => {
      expect(questions.join(' | ')).toMatch(/qué hace Sonmyd/i);
      expect(questions.join(' | ')).toMatch(/presenciales o en línea/);
      expect(questions.join(' | ')).toMatch(/fuera de Medellín/);
      expect(questions.join(' | ')).toMatch(/cuánto cuesta/i);
      expect(questions.join(' | ')).toMatch(/cómo empiezo/i);
    });

    it('la respuesta de precios no inventa un número', () => {
      const price = home.frontmatter.match(/question: '¿Cuánto cuesta\?',\s*answer:\s*'([^']+)'/)?.[1] ?? '';

      expect(price).not.toBe('');
      expect(price).not.toMatch(/\d|\$|COP|USD|desde/i);
    });

    it('los municipios de la respuesta de cobertura salen de BUSINESS', () => {
      expect(home.frontmatter).toMatch(/formatList\(BUSINESS\.areaServed\)/);
    });
  });

  describe('captación de leads', () => {
    it('cierra con LeadCapture, con el formulario "lead-home"', () => {
      expect(home.markup).toMatch(/<LeadCapture[^>]*formId="lead-home"/s);
    });

    it('los compromisos del formulario no prometen un plazo de respuesta ni datos de clientes', () => {
      const capture = block(home.markup, '<LeadCapture', '/>');

      expect(capture).toContain('Primera consulta sin costo y sin compromiso');
      expect(capture).toContain('Tus datos no se venden ni se ceden a terceros');
      expect(capture).not.toMatch(/\d+\s*horas/i);
      expect(claimsIn(capture)).toEqual([]);
    });
  });

  describe('sin restos de plantilla y en tuteo', () => {
    it('no conserva textos, imágenes ni enlaces de la plantilla', () => {
      expect(home.source).not.toMatch(/AstroWind|onwidget|lorem ipsum|unsplash\.com|placehold|example\.com/i);
    });

    it('no usa voseo', () => {
      expect(findVoseo(home.source)).toEqual([]);
    });

    it('no afirma nada que no se sostenga: cifras, clientes, premios', () => {
      expect(claimsIn(copy)).toEqual([]);
    });

    it('no publica ningún correo: el dominio no recibe mensajes', () => {
      expect(FREE_FORM_EMAIL.test(home.markup)).toBe(false);
    });
  });
});

describe('sobre Sonmyd (about.astro)', () => {
  const about = pageSource('about');
  const metadata = metadataOf(about.frontmatter);
  const copy = copyOf(about);

  it('el título lleva la marca una sola vez y la ciudad, sin plantilla', () => {
    expect(metadata.ignoreTitleTemplate).toBe(true);
    expect(brandCount(renderedTitle(metadata))).toBe(1);
    expect(metadata.title).toContain(BUSINESS.address.locality);
    expect(length(metadata.title)).toBeLessThanOrEqual(60);
  });

  it('la descripción mide entre 120 y 158 caracteres', () => {
    expect(length(metadata.description)).toBeGreaterThanOrEqual(120);
    expect(length(metadata.description)).toBeLessThanOrEqual(158);
  });

  it('declara su canonical y tiene imagen social propia (no la de la plantilla)', () => {
    expect(metadata.canonical).toBe('PATH');
    expect(about.frontmatter).toContain("const PATH = '/about';");
    expect(about.frontmatter).toMatch(/getSeoImageMeta\('home'\)/);
  });

  it('es honesta: sin cifras de clientes ni de años, sin certificaciones, premios ni sedes', () => {
    expect(claimsIn(copy)).toEqual([]);
    expect(copy).not.toMatch(/\b(sedes?|oficinas?|socios|aliados estratégicos|franquicias?)\b/i);
  });

  it('el único número que aparece es el "1 a 1" de las clases', () => {
    // Con borde de palabra: "n8n" es el nombre de una herramienta, no una cifra.
    const numbers = copy.match(/\b\d+\b/g) ?? [];

    expect(numbers.length).toBeGreaterThan(0);
    numbers.forEach((number) => expect(number).toBe('1'));
  });

  it('dice quién dirige Sonmyd y enlaza a su página', () => {
    expect(copy).toContain('Santiago Bedoya');
    expect(about.markup).toMatch(/href="\/autor"[^>]*>Santiago Bedoya/s);
    expect(personSchema().name).toBe('Santiago Bedoya');
  });

  it('enlaza a los tres hubs desde el registro', () => {
    expect(about.frontmatter).toMatch(/getHub\('clases-de-programacion'\)/);
    expect(about.frontmatter).toMatch(/getHub\('servicios'\)/);
    expect(about.frontmatter).toMatch(/getHub\('marketing-digital'\)/);
    ['courseHub', 'servicesHub', 'marketingHub'].forEach((hub) =>
      expect(about.markup).toContain(`href: landingPath(${hub}.slug)`)
    );
  });

  it('declara el área de servicio, agenda y ofrece WhatsApp', () => {
    expect(about.markup).toMatch(/<ServiceArea[^>]*id="medellin"/s);
    expect(about.markup).toContain('href="/booking"');
    expect(about.markup).toMatch(/<WhatsAppButton[^>]*location="about-cta"/s);
  });

  it('lleva migas de pan visibles y el JSON-LD', () => {
    expect(about.markup).toMatch(/<Breadcrumbs/);
    expect(about.markup).toMatch(/breadcrumbSchema/);
  });

  it('está en tuteo, sin correo y sin restos de plantilla', () => {
    expect(findVoseo(about.source)).toEqual([]);
    expect(FREE_FORM_EMAIL.test(about.markup)).toBe(false);
    expect(about.source).not.toMatch(/AstroWind|onwidget|lorem ipsum/i);
  });
});

describe('contacto (contact.astro)', () => {
  const contact = pageSource('contact');
  const metadata = metadataOf(contact.frontmatter);
  const text = visibleText(contact.markup);
  const copy = copyOf(contact);

  describe('título', () => {
    it('es "Contacto: escríbenos por WhatsApp | Sonmyd" y no repite la marca', () => {
      expect(metadata.title).toBe('Contacto: escríbenos por WhatsApp | Sonmyd');
      expect(metadata.ignoreTitleTemplate).toBe(true);
      expect(brandCount(renderedTitle(metadata))).toBe(1);
    });

    // Documenta POR QUÉ hace falta ignoreTitleTemplate: sin él, la plantilla le suma la marca otra vez.
    it('sin ignoreTitleTemplate la plantilla global duplicaría la marca', () => {
      const duplicated = renderedTitle({ title: metadata.title, ignoreTitleTemplate: false });

      expect(brandCount(duplicated)).toBe(2);
    });

    it('mide menos de 60 caracteres', () => {
      expect(length(renderedTitle(metadata))).toBeLessThanOrEqual(60);
    });
  });

  it('la descripción menciona Medellín y mide entre 120 y 158 caracteres', () => {
    expect(metadata.description).toContain(BUSINESS.address.locality);
    expect(length(metadata.description)).toBeGreaterThanOrEqual(120);
    expect(length(metadata.description)).toBeLessThanOrEqual(158);
  });

  it('declara su canonical', () => {
    expect(metadata.canonical).toBe('PATH');
    expect(contact.frontmatter).toContain("const PATH = '/contact';");
  });

  describe('canales de contacto', () => {
    it('NO publica ningún correo: el dominio no tiene registros MX', () => {
      expect(FREE_FORM_EMAIL.test(contact.markup)).toBe(false);
      expect(FREE_FORM_EMAIL.test(metadata.description)).toBe(false);
      expect(copy).not.toMatch(/correo electrónico|e-?mail/i);
    });

    it('muestra el teléfono desde BUSINESS, sin escribirlo a mano', () => {
      expect(contact.markup).toContain('{BUSINESS.telephone}');
      expect(text).toContain(BUSINESS.telephone);
      expect(contact.source).not.toMatch(/\+57|\b310\b|573106041144/);
    });

    it('tiene el botón de WhatsApp de la ubicación "contact"', () => {
      expect(contact.markup).toMatch(/<WhatsAppButton[^>]*location="contact"/s);
    });

    it('ofrece la agenda como segundo canal', () => {
      expect(contact.markup).toMatch(/<Button[^>]*href="\/booking"/s);
    });

    it('dice dónde está el negocio y qué municipios atiende, desde BUSINESS', () => {
      expect(text).toContain(`${BUSINESS.address.locality}, ${BUSINESS.address.region}, Colombia`);
      expect(contact.frontmatter).toMatch(/import \{ formatList \} from '~\/utils\/service-area';/);
      expect(contact.markup).toContain('formatList(BUSINESS.areaServed)');
    });
  });

  describe('formulario', () => {
    it('incluye LeadCapture con el formulario "lead-contacto"', () => {
      expect(contact.markup).toMatch(/<LeadCapture[^>]*formId="lead-contacto"/s);
      expect(contact.markup).toMatch(/<LeadCapture[^>]*id="form"/s);
    });

    it('lleva un único H1, el del hero', () => {
      expect(contact.markup.match(/<h1\b/g)).toBeNull();
      expect(visibleText(block(contact.markup, '<Fragment slot="title">', '</Fragment>'))).toBe(
        'Cuéntanos qué necesitas'
      );
    });
  });

  describe('promesas', () => {
    it('no promete un plazo de respuesta: no se ha medido ninguno', () => {
      expect(copy).not.toMatch(/\d+\s*horas|en menos de|respondemos en/i);
    });

    it('no afirma cifras ni premios', () => {
      expect(claimsIn(copy)).toEqual([]);
    });
  });

  it('describe la página como ContactPage y la ata a la organización y al sitio por su @id', () => {
    expect(contact.frontmatter).toMatch(/'@type': 'ContactPage'/);
    expect(contact.frontmatter).toMatch(/isPartOf: \{ '@id': absoluteUrl\('\/#website'\) \}/);
    expect(contact.frontmatter).toMatch(/about: \{ '@id': absoluteUrl\('\/#organization'\) \}/);
    expect(contact.frontmatter).toMatch(/inLanguage: 'es'/);
  });

  it('lleva migas de pan, está en tuteo y no conserva restos de plantilla', () => {
    expect(contact.markup).toMatch(/<Breadcrumbs/);
    expect(findVoseo(contact.source)).toEqual([]);
    expect(contact.source).not.toMatch(/AstroWind|onwidget|lorem ipsum|Bogot[aá]/i);
    expect(ENGLISH_UI.test(copy)).toBe(false);
  });
});

describe('agenda (booking.astro)', () => {
  const booking = pageSource('booking');
  const metadata = metadataOf(booking.frontmatter);
  const text = visibleText(booking.markup);
  const copy = copyOf(booking);
  const widget = copyOf(astroSource('src/components/widgets/AppointmentBooking.astro'));

  it('el título está en español, ya trae la marca y no la repite', () => {
    expect(metadata.title).toBe('Agenda una asesoría gratuita | Sonmyd');
    expect(metadata.ignoreTitleTemplate).toBe(true);
    expect(brandCount(renderedTitle(metadata))).toBe(1);
    expect(ENGLISH_UI.test(metadata.title)).toBe(false);
  });

  it('la descripción está en español, menciona Medellín y mide entre 120 y 158 caracteres', () => {
    expect(metadata.description).toContain(BUSINESS.address.locality);
    expect(length(metadata.description)).toBeGreaterThanOrEqual(120);
    expect(length(metadata.description)).toBeLessThanOrEqual(158);
    expect(ENGLISH_UI.test(metadata.description)).toBe(false);
  });

  it('declara su canonical', () => {
    expect(metadata.canonical).toBe('PATH');
    expect(booking.frontmatter).toContain("const PATH = '/booking';");
  });

  it('habla de "tú": imperativos de tuteo y ningún voseo', () => {
    expect(copy).toMatch(/\bAgenda\b/);
    expect(copy).toMatch(/\bElige\b/);
    expect(copy).toMatch(/\bcuéntanos\b/i);
    expect(text).toMatch(/\bEscríbenos\b/);
    expect(findVoseo(booking.source)).toEqual([]);
  });

  it('ni la página ni el formulario dejan textos de interfaz en inglés', () => {
    expect(ENGLISH_UI.test(copy)).toBe(false);
    expect(ENGLISH_UI.test(widget)).toBe(false);
  });

  it('el calendario es el widget AppointmentBooking, con su ancla', () => {
    expect(booking.markup).toMatch(/<AppointmentBooking[^>]*id="booking"/s);
  });

  it('si no hay horario, ofrece WhatsApp con un mensaje en español', () => {
    expect(booking.markup).toMatch(/<WhatsAppButton[^>]*location="booking"/s);
    expect(booking.markup).toContain('message="Hola, no encontré un horario disponible para la asesoría gratuita."');
  });

  it('no anuncia una duración: la reserva ocupa un turno de una hora', () => {
    expect(copy).not.toMatch(/\d+\s*(min|minutos|horas?)\b|media hora/i);
  });

  it('lleva migas de pan visibles y el JSON-LD', () => {
    expect(booking.markup).toMatch(/<Breadcrumbs/);
    expect(booking.markup).toMatch(/breadcrumbSchema/);
  });
});

describe('página 404 (404.astro)', () => {
  const notFound = pageSource('404');
  const metadata = metadataOf(notFound.frontmatter);
  const text = visibleText(notFound.markup);
  const copy = copyOf(notFound);

  it('está en español: título, descripción y encabezado', () => {
    expect(metadata.title).toBe('Página no encontrada');
    expect(metadata.description).toMatch(/La página que buscas no existe o cambió de dirección/);
    expect(notFound.markup).toMatch(/<h1[^>]*>Página no encontrada<\/h1>/);
    expect(ENGLISH_UI.test(copy)).toBe(false);
  });

  it('la plantilla global le suma la marca una sola vez', () => {
    expect(metadata.ignoreTitleTemplate).toBe(false);
    expect(brandCount(renderedTitle(metadata))).toBe(1);
  });

  it('habla de "tú" y no usa voseo', () => {
    expect(text).toMatch(/buscas/);
    expect(text).toMatch(/Escríbenos/);
    expect(findVoseo(notFound.source)).toEqual([]);
  });

  describe('enlaces útiles', () => {
    it('lleva al inicio, a cada hub del registro y al blog', () => {
      expect(notFound.frontmatter).toMatch(
        /\.\.\.HUBS\.map\(\(hub\) => \(\{ name: hub\.name, href: landingPath\(hub\.slug\)/
      );
      expect(notFound.frontmatter).toContain("name: 'Inicio', href: getHomePermalink()");
      expect(notFound.frontmatter).toContain("name: 'Blog', href: getBlogPermalink()");
    });

    it('esos destinos existen', () => {
      // El permalink del blog sale de config.yaml; en los tests el módulo de configuración es un doble.
      expect(getHomePermalink()).toBe('/');
      expect(typeof getBlogPermalink()).toBe('string');
      expect(siteConfig.apps.blog.isEnabled).toBe(true);
      expect(siteConfig.apps.blog.list.pathname).toBe('blog');
      expect(existsSync(resolve(ROOT, 'src/pages/[...blog]/[...page].astro'))).toBe(true);
      hubSlugs.forEach((slug) => expect(pageExists(slug), slug).toBe(true));
    });

    it('no escribe ninguna ruta a mano', () => {
      expect(notFound.markup).not.toMatch(/href="\//);
      hubSlugs.forEach((slug) => expect(notFound.source, slug).not.toContain(`'/${slug}'`));
    });

    it('pinta los enlaces como lista, con el foco visible', () => {
      expect(notFound.markup).toMatch(/<ul[^>]*>/);
      expect(notFound.markup).toContain('focus-visible:ring-2');
    });
  });

  it('ofrece WhatsApp para pedir ayuda, con la ubicación "404"', () => {
    expect(notFound.markup).toMatch(/<WhatsAppButton[^>]*location="404"/s);
    expect(text).toContain('¿No encuentras lo que buscas? Escríbenos y te ayudamos.');
  });

  it('hereda del layout público: cabecera, pie, GTM y botón flotante', () => {
    expect(notFound.frontmatter).toMatch(/import Layout from '~\/layouts\/PageLayout\.astro';/);
  });

  it('no publica ningún correo', () => {
    expect(FREE_FORM_EMAIL.test(notFound.markup)).toBe(false);
  });
});

describe('autor (autor.astro)', () => {
  const author = pageSource('autor');
  const metadata = metadataOf(author.frontmatter);
  const text = visibleText(author.markup);
  const copy = copyOf(author);

  it('el título nombra al autor, lleva la marca una sola vez y no pasa de 60 caracteres', () => {
    expect(metadata.title).toContain('Santiago Bedoya');
    expect(metadata.ignoreTitleTemplate).toBe(true);
    expect(brandCount(renderedTitle(metadata))).toBe(1);
    expect(length(metadata.title)).toBeLessThanOrEqual(60);
  });

  it('la descripción mide entre 120 y 158 caracteres', () => {
    expect(length(metadata.description)).toBeGreaterThanOrEqual(120);
    expect(length(metadata.description)).toBeLessThanOrEqual(158);
  });

  it('declara su canonical', () => {
    expect(metadata.canonical).toBe('PATH');
    expect(author.frontmatter).toContain("const PATH = '/autor';");
  });

  it('conserva el esquema Person y las migas de pan en el JSON-LD', () => {
    expect(author.frontmatter).toMatch(/import \{ breadcrumbSchema, personSchema \} from '~\/utils\/seo';/);
    expect(author.markup).toMatch(/<StructuredData[\s\S]*personSchema\(\)[\s\S]*breadcrumbSchema\(/);
  });

  it('el esquema Person identifica a Santiago Bedoya y apunta a la organización', () => {
    const person = personSchema();

    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Santiago Bedoya');
    expect(person.url).toBe('https://sonmyd.co/autor');
    expect(person.worksFor).toEqual({ '@id': 'https://sonmyd.co/#organization' });
    expect(person.jobTitle).toMatch(/Ingeniero de software/);
  });

  it('el H1 es el nombre del autor', () => {
    expect(author.markup).toMatch(/<h1[^>]*>Santiago Bedoya<\/h1>/);
    expect(author.markup.match(/<h1\b/g)).toHaveLength(1);
  });

  describe('enlaces a las clases y a los servicios', () => {
    it('enlaza a /clases-de-programacion y a /servicios con landingPath, desde el registro', () => {
      expect(author.frontmatter).toMatch(/const courseHub = getHub\('clases-de-programacion'\);/);
      expect(author.frontmatter).toMatch(/const servicesHub = getHub\('servicios'\);/);
      expect(author.markup).toContain('href={landingPath(courseHub.slug)}');
      expect(author.markup).toContain('href={landingPath(servicesHub.slug)}');
      expect(landingPath('clases-de-programacion')).toBe('/clases-de-programacion');
      expect(landingPath('servicios')).toBe('/servicios');
    });

    it('lo hace en el cuerpo del texto y en las tarjetas de "trabajar conmigo"', () => {
      expect(author.markup.match(/landingPath\(courseHub\.slug\)/g)?.length).toBeGreaterThanOrEqual(2);
      expect(author.markup.match(/landingPath\(servicesHub\.slug\)/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('cierra con agenda y contacto', () => {
      expect(author.markup).toContain("href: '/booking'");
      expect(author.markup).toContain("href: '/contact'");
    });
  });

  it('habla en primera persona y de "tú": sin voseo', () => {
    expect(text).toMatch(/\bCuéntame\b/);
    expect(text).toMatch(/\bte digo\b/);
    expect(findVoseo(author.source)).toEqual([]);
  });

  it('no afirma cifras, certificaciones ni premios que nadie verificó', () => {
    expect(claimsIn(copy)).toEqual([]);
    expect(copy).not.toMatch(/\b\d+\s*años\b/);
  });

  it('no publica ningún correo y no conserva restos de plantilla', () => {
    expect(FREE_FORM_EMAIL.test(author.markup)).toBe(false);
    expect(author.source).not.toMatch(/AstroWind|onwidget|lorem ipsum/i);
  });
});
