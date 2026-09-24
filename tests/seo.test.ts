import { describe, expect, it } from 'vitest';
import {
  SITE_URL,
  absoluteUrl,
  breadcrumbSchema,
  courseSchema,
  faqSchema,
  organizationSchema,
  serviceSchema,
  websiteSchema,
} from '~/utils/seo';

describe('absoluteUrl', () => {
  it('construye URLs absolutas a partir de una ruta', () => {
    expect(absoluteUrl('/clases-de-ia')).toBe('https://sonmyd.co/clases-de-ia');
  });

  it('tolera rutas sin barra inicial', () => {
    expect(absoluteUrl('clases-de-ia')).toBe('https://sonmyd.co/clases-de-ia');
  });

  it('nunca genera una doble barra', () => {
    expect(absoluteUrl('/')).toBe('https://sonmyd.co/');
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});

describe('organizationSchema', () => {
  it('declara un @id estable para que Google consolide la entidad', () => {
    const schema = organizationSchema();

    expect(schema['@type']).toBe('Organization');
    expect(schema['@id']).toBe('https://sonmyd.co/#organization');
    expect(schema.name).toBe('Sonmyd');
  });

  it('incluye las áreas temáticas que queremos posicionar', () => {
    const knowsAbout = organizationSchema().knowsAbout as string[];

    expect(knowsAbout.join(' | ').toLowerCase()).toContain('clases de ia');
    expect(knowsAbout.join(' | ').toLowerCase()).toContain('whatsapp');
    expect(knowsAbout.join(' | ').toLowerCase()).toContain('llamadas');
  });
});

describe('websiteSchema', () => {
  it('referencia a la organización en lugar de duplicar sus datos', () => {
    expect(websiteSchema().publisher).toEqual({ '@id': 'https://sonmyd.co/#organization' });
  });

  it('declara el idioma del sitio', () => {
    expect(websiteSchema().inLanguage).toBe('es');
  });
});

describe('serviceSchema', () => {
  const schema = serviceSchema({
    name: 'Asistente de WhatsApp con IA',
    description: 'Atención automática por WhatsApp.',
    path: '/asistente-de-whatsapp',
    serviceType: 'Automatización de atención al cliente con IA',
  });

  it('usa un @id derivado de la URL de la página', () => {
    expect(schema['@id']).toBe('https://sonmyd.co/asistente-de-whatsapp#service');
    expect(schema.url).toBe('https://sonmyd.co/asistente-de-whatsapp');
  });

  it('enlaza el proveedor con la organización', () => {
    expect(schema.provider).toEqual({ '@id': 'https://sonmyd.co/#organization' });
  });
});

describe('courseSchema', () => {
  it('genera una instancia por cada modalidad', () => {
    const schema = courseSchema({
      name: 'Clases de IA',
      description: 'Clases de inteligencia artificial aplicada.',
      path: '/clases-de-ia',
      modes: ['online', 'onsite'],
    });

    expect(schema['@type']).toBe('Course');
    expect(schema.hasCourseInstance).toHaveLength(2);
    expect((schema.hasCourseInstance as Array<{ courseMode: string }>).map((i) => i.courseMode)).toEqual([
      'online',
      'onsite',
    ]);
  });
});

describe('faqSchema', () => {
  it('convierte las preguntas al formato que Google usa para rich results', () => {
    const schema = faqSchema([
      { question: '¿Necesito saber programar?', answer: 'No.' },
      { question: '¿Son online?', answer: 'Sí, en vivo.' },
    ]);

    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: '¿Necesito saber programar?',
      acceptedAnswer: { '@type': 'Answer', text: 'No.' },
    });
  });

  it('soporta una lista vacía sin romper', () => {
    expect(faqSchema([]).mainEntity).toEqual([]);
  });
});

describe('breadcrumbSchema', () => {
  it('numera las posiciones desde 1 y resuelve URLs absolutas', () => {
    const schema = breadcrumbSchema([
      { name: 'Inicio', path: '/' },
      { name: 'Clases de IA', path: '/clases-de-ia' },
    ]);

    expect(schema.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://sonmyd.co/' },
      { '@type': 'ListItem', position: 2, name: 'Clases de IA', item: 'https://sonmyd.co/clases-de-ia' },
    ]);
  });
});
