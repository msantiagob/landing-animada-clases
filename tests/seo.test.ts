import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
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

const ORGANIZATION_ID = 'https://sonmyd.co/#organization';
const AUTHOR_ID = 'https://sonmyd.co/autor#person';

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
  const schema = organizationSchema();

  it('declara un @id estable para que Google consolide la entidad', () => {
    expect(schema['@id']).toBe(ORGANIZATION_ID);
    expect(schema.name).toBe('Sonmyd');
    expect(schema.url).toBe('https://sonmyd.co');
  });

  // LocalBusiness es el tipo que Google usa para el SEO local; ProfessionalService
  // es su subtipo para empresas de servicios.
  it('es un ProfessionalService (subtipo de LocalBusiness)', () => {
    expect(schema['@type']).toBe('ProfessionalService');
  });

  it('publica el teléfono del negocio', () => {
    expect(schema.telephone).toBe(BUSINESS.telephone);
  });

  it('declara la dirección postal de Medellín SIN calle', () => {
    expect(schema.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Medellín',
      addressRegion: 'Antioquia',
      addressCountry: 'CO',
    });
    expect(schema.address).not.toHaveProperty('streetAddress');
    expect(schema.address).not.toHaveProperty('postalCode');
  });

  it('declara las coordenadas del centro de Medellín', () => {
    expect(schema.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    });
    expect(typeof schema.geo.latitude).toBe('number');
    expect(typeof schema.geo.longitude).toBe('number');
  });

  describe('areaServed', () => {
    it('lista cada municipio atendido como City', () => {
      const cities = schema.areaServed.filter((area) => area['@type'] === 'City').map((area) => area.name);

      expect(cities).toEqual([...BUSINESS.areaServed]);
    });

    it('incluye Colombia completa por la modalidad en línea', () => {
      expect(schema.areaServed).toContainEqual({ '@type': 'Country', name: 'Colombia' });
    });

    it('ya no declara países que no se atienden (AR, MX, ES, CL, PE)', () => {
      const serialized = JSON.stringify(schema.areaServed);

      ['AR', 'MX', 'ES', 'CL', 'PE'].forEach((code) => expect(serialized).not.toContain(`"${code}"`));
    });
  });

  it('declara un punto de contacto de atención al cliente en español', () => {
    expect(schema.contactPoint).toEqual({
      '@type': 'ContactPoint',
      telephone: BUSINESS.telephone,
      contactType: 'customer service',
      availableLanguage: 'es',
      areaServed: 'CO',
    });
  });

  describe('knowsAbout', () => {
    const knowsAbout = schema.knowsAbout.join(' | ').toLowerCase();

    // Los temas del registro de landings: lo que se enseña y lo que se construye.
    it.each([
      'inteligencia artificial',
      'python',
      'javascript',
      'desarrollo web',
      'aplicaciones móviles',
      'aws',
      'linux',
      'n8n',
      'bots',
      'agentes de ia',
      'automatización',
      'ciberseguridad',
      'meta ads',
      'google shopping',
      'seo',
    ])('cubre el tema "%s"', (topic) => {
      expect(knowsAbout).toContain(topic);
    });

    it('conserva los temas de WhatsApp y llamadas con IA', () => {
      expect(knowsAbout).toContain('whatsapp');
      expect(knowsAbout).toContain('llamadas');
    });

    it('no repite temas', () => {
      expect(new Set(schema.knowsAbout).size).toBe(schema.knowsAbout.length);
    });
  });

  // Solo se declaran perfiles verificados; sin ellos, mejor no emitir la propiedad.
  it('no inventa perfiles (sameAs), horarios ni rango de precios', () => {
    expect(schema).not.toHaveProperty('sameAs');
    expect(schema).not.toHaveProperty('openingHours');
    expect(schema).not.toHaveProperty('openingHoursSpecification');
    expect(schema).not.toHaveProperty('priceRange');
  });

  it('es serializable sin perder campos (nada undefined)', () => {
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });

  it('devuelve objetos nuevos en cada llamada, sin estado compartido', () => {
    const first = organizationSchema();
    first.areaServed.push({ '@type': 'City', name: 'Contaminada' });

    expect(organizationSchema().areaServed.map((area) => area.name)).not.toContain('Contaminada');
  });
});

describe('websiteSchema', () => {
  it('referencia a la organización en lugar de duplicar sus datos', () => {
    expect(websiteSchema().publisher).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('declara el idioma del sitio', () => {
    expect(websiteSchema().inLanguage).toBe('es');
  });
});

describe('serviceSchema', () => {
  const input = {
    name: 'Asistente de WhatsApp con IA',
    description: 'Atención automática por WhatsApp.',
    path: '/asistente-de-whatsapp',
    serviceType: 'Automatización de atención al cliente con IA',
  };
  const schema = serviceSchema(input);

  it('usa un @id derivado de la URL de la página', () => {
    expect(schema['@id']).toBe('https://sonmyd.co/asistente-de-whatsapp#service');
    expect(schema.url).toBe('https://sonmyd.co/asistente-de-whatsapp');
  });

  it('enlaza el proveedor con la organización', () => {
    expect(schema.provider).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('conserva nombre, descripción y tipo de servicio', () => {
    expect(schema.name).toBe(input.name);
    expect(schema.description).toBe(input.description);
    expect(schema.serviceType).toBe(input.serviceType);
  });

  it('atiende la misma zona que la organización (municipios y Colombia)', () => {
    expect(schema.areaServed).toEqual(organizationSchema().areaServed);
  });

  describe('image', () => {
    it('omite la propiedad cuando no hay imagen', () => {
      expect(schema).not.toHaveProperty('image');
    });

    it('convierte una ruta del sitio en URL absoluta', () => {
      expect(serviceSchema({ ...input, image: '/_astro/portada.abc123.jpg' }).image).toBe(
        'https://sonmyd.co/_astro/portada.abc123.jpg'
      );
    });

    it('respeta una URL que ya es absoluta', () => {
      expect(serviceSchema({ ...input, image: 'https://cdn.ejemplo.com/foto.jpg' }).image).toBe(
        'https://cdn.ejemplo.com/foto.jpg'
      );
    });
  });

  it('no emite precios ni ofertas: nunca se verificaron', () => {
    const serialized = JSON.stringify(serviceSchema({ ...input, image: '/foto.jpg' }));

    ['offers', 'price', 'priceCurrency', 'priceRange', 'lowPrice', 'highPrice'].forEach((key) =>
      expect(serialized).not.toContain(`"${key}"`)
    );
  });
});

describe('courseSchema', () => {
  const input = {
    name: 'Clases de IA',
    description: 'Clases de inteligencia artificial aplicada.',
    path: '/clases-de-ia',
  };
  const schema = courseSchema(input);
  const instances = schema.hasCourseInstance as Array<Record<string, unknown>>;

  it('usa un @id y una URL derivados de la página', () => {
    expect(schema['@type']).toBe('Course');
    expect(schema['@id']).toBe('https://sonmyd.co/clases-de-ia#course');
    expect(schema.url).toBe('https://sonmyd.co/clases-de-ia');
  });

  it('declara el idioma y enlaza el proveedor con la organización', () => {
    expect(schema.inLanguage).toBe('es');
    expect(schema.provider).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('declara que el curso es de pago, sin monto', () => {
    expect(schema.offers).toEqual({ '@type': 'Offer', category: 'Paid' });
  });

  describe('hasCourseInstance', () => {
    it('genera una instancia en línea y una presencial, en ese orden', () => {
      expect(instances).toHaveLength(2);
      expect(instances.map((instance) => instance.courseMode)).toEqual(['Online', 'Onsite']);
      instances.forEach((instance) => expect(instance['@type']).toBe('CourseInstance'));
    });

    it('asigna al autor como instructor de cada instancia', () => {
      instances.forEach((instance) => expect(instance.instructor).toEqual({ '@id': AUTHOR_ID }));
    });

    it('ubica la modalidad presencial en Medellín, sin calle', () => {
      const onsite = instances.find((instance) => instance.courseMode === 'Onsite');

      expect(onsite?.location).toEqual({
        '@type': 'Place',
        name: 'Medellín',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Medellín',
          addressRegion: 'Antioquia',
          addressCountry: 'CO',
        },
      });
      expect(JSON.stringify(onsite?.location)).not.toContain('streetAddress');
    });

    it('no asigna lugar físico a la modalidad en línea', () => {
      const online = instances.find((instance) => instance.courseMode === 'Online');

      expect(online).not.toHaveProperty('location');
    });
  });

  // La carga horaria 'PT16H' estaba fija en el código y nunca se verificó: en el
  // marcado es una afirmación pública. Tampoco se declaran duraciones ni precios.
  describe('sin afirmaciones no verificadas', () => {
    const serialized = JSON.stringify(courseSchema({ ...input, image: '/portada.jpg' }));

    it.each(['courseWorkload', 'PT16H', 'timeRequired', 'duration', 'price', 'priceCurrency', 'numberOfCredits'])(
      'no emite "%s"',
      (key) => {
        expect(serialized).not.toContain(key);
      }
    );
  });

  describe('image', () => {
    it('omite la propiedad cuando no hay imagen', () => {
      expect(schema).not.toHaveProperty('image');
    });

    it('convierte una ruta del sitio en URL absoluta', () => {
      expect(courseSchema({ ...input, image: '/_astro/clases-de-ia.abc123.jpg' }).image).toBe(
        'https://sonmyd.co/_astro/clases-de-ia.abc123.jpg'
      );
    });

    it('respeta una URL que ya es absoluta', () => {
      expect(courseSchema({ ...input, image: 'https://cdn.ejemplo.com/foto.jpg' }).image).toBe(
        'https://cdn.ejemplo.com/foto.jpg'
      );
    });
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
