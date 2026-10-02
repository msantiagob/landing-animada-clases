import { describe, expect, it, vi } from 'vitest';
import { HUBS, LANDINGS, SILOS } from '~/data/landings';
import type { Landing, SiloId } from '~/data/landings';
import {
  HUB_LINK_LABEL,
  PAIR_HEADING,
  getHub,
  getLanding,
  hubBreadcrumbs,
  hubForLanding,
  landingBreadcrumbs,
  landingMetadata,
  landingPath,
  landingsBySilo,
  landingsForHub,
  landingsListedInHub,
  relatedLinksFor,
} from '~/utils/landings';

/**
 * El manifiesto de imágenes lo escribe otro módulo; acá se simula para probar
 * la lógica de `landingMetadata` sin depender de qué fotos existan en disco.
 * La clave 'sin-imagen' representa una entrada del registro sin imagen.
 */
vi.mock('~/data/seo-images', () => ({
  getSeoImageMeta: (key: string) =>
    key === 'sin-imagen'
      ? undefined
      : {
          file: `${key}.jpg`,
          alt: `Imagen de ${key}`,
          width: 1600,
          height: 900,
          author: 'Autor',
          authorUrl: 'https://unsplash.com/@autor',
          sourceUrl: 'https://unsplash.com/photos/x',
          license: 'Unsplash License',
        },
}));

const SILO_IDS = Object.keys(SILOS) as SiloId[];
const slugs = (landings: Landing[]) => landings.map((landing) => landing.slug);

describe('landingPath', () => {
  it('antepone una barra al slug', () => {
    expect(landingPath('clases-de-ia')).toBe('/clases-de-ia');
  });

  it.each(LANDINGS.map((landing) => landing.slug))('/%s no termina en barra ni lleva espacios', (slug) => {
    expect(landingPath(slug)).toMatch(/^\/[a-z0-9-]+$/);
  });
});

describe('getLanding', () => {
  it.each(LANDINGS.map((landing) => [landing.slug, landing] as const))('devuelve la entrada de %s', (slug, landing) => {
    expect(getLanding(slug)).toBe(landing);
  });

  it('lanza ante un slug desconocido, nombrándolo en el error', () => {
    expect(() => getLanding('no-existe')).toThrow('Unknown landing "no-existe"');
  });

  it.each([
    ['vacío', ''],
    ['con mayúsculas', 'Clases-de-IA'],
    ['con barra inicial', '/clases-de-ia'],
    ['con espacios', ' clases-de-ia '],
  ])('no tolera un slug %s', (_caso, slug) => {
    expect(() => getLanding(slug)).toThrow(/Unknown landing/);
  });

  // 'servicios' es una página hub, no una landing: confundirlas rompería las migas.
  it('no confunde un hub con una landing', () => {
    HUBS.forEach((hub) => expect(() => getLanding(hub.slug)).toThrow(/Unknown landing/));
  });
});

describe('getHub', () => {
  it.each(HUBS.map((hub) => [hub.slug, hub] as const))('devuelve el hub %s', (slug, hub) => {
    expect(getHub(slug)).toBe(hub);
  });

  it('lanza ante un hub desconocido', () => {
    expect(() => getHub('no-existe')).toThrow('Unknown hub "no-existe"');
  });

  it('no confunde una landing con un hub', () => {
    expect(() => getHub('clases-de-ia')).toThrow(/Unknown hub/);
  });
});

describe('landingsBySilo', () => {
  it.each(SILO_IDS)('devuelve solo las landings del silo %s', (silo) => {
    const result = landingsBySilo(silo);

    expect(result.length).toBeGreaterThan(0);
    result.forEach((landing) => expect(landing.silo).toBe(silo));
  });

  it('conserva el orden del registro', () => {
    expect(slugs(landingsBySilo('formacion'))).toEqual(
      slugs(LANDINGS.filter((landing) => landing.silo === 'formacion'))
    );
  });

  it('reparte todas las landings sin dejar ninguna fuera ni repetirla', () => {
    const all = SILO_IDS.flatMap(landingsBySilo);

    expect(slugs(all).sort()).toEqual(slugs(LANDINGS).sort());
  });

  it('lanza ante un silo desconocido', () => {
    expect(() => landingsBySilo('inventado' as SiloId)).toThrow('Unknown silo "inventado"');
  });

  it('no trata propiedades heredadas de Object como silos', () => {
    expect(() => landingsBySilo('toString' as SiloId)).toThrow(/Unknown silo/);
  });
});

describe('landingsForHub', () => {
  it('el hub de formación reúne los cursos', () => {
    const result = landingsForHub('clases-de-programacion');

    expect(slugs(result)).toEqual(slugs(landingsBySilo('formacion')));
    result.forEach((landing) => expect(landing.kind).toBe('curso'));
  });

  it('el hub de marketing reúne las landings del silo de marketing', () => {
    expect(slugs(landingsForHub('marketing-digital'))).toEqual(slugs(landingsBySilo('marketing')));
  });

  it('el hub de servicios reúne los silos que cuelgan de él en SILOS', () => {
    const expected = LANDINGS.filter((landing) => SILOS[landing.silo].hub === 'servicios');

    expect(slugs(landingsForHub('servicios'))).toEqual(slugs(expected));
    expect(slugs(landingsForHub('servicios'))).toEqual(
      expect.arrayContaining(['desarrollo-de-software', 'agentes-de-ia', 'consultoria-aws'])
    );
  });

  it('conserva el orden del registro', () => {
    HUBS.forEach((hub) => {
      const result = slugs(landingsForHub(hub.slug));
      const registryOrder = slugs(LANDINGS).filter((slug) => result.includes(slug));

      expect(result).toEqual(registryOrder);
    });
  });

  it('cada landing pertenece a exactamente un hub', () => {
    const grouped = HUBS.flatMap((hub) => landingsForHub(hub.slug));

    expect(slugs(grouped).sort()).toEqual(slugs(LANDINGS).sort());
  });

  it('es consistente con hubForLanding', () => {
    HUBS.forEach((hub) =>
      landingsForHub(hub.slug).forEach((landing) => expect(hubForLanding(landing).slug).toBe(hub.slug))
    );
  });

  it('lanza ante un hub desconocido en vez de devolver una lista vacía', () => {
    expect(() => landingsForHub('no-existe')).toThrow('Unknown hub "no-existe"');
  });

  // El silo de marketing cuelga de marketing-digital en SILOS (su padre en las
  // migas), aunque la página /servicios también lo lista (HUBS.servicios.silos).
  // `landingsForHub` sigue SILOS; para la página de servicios existe landingsListedInHub.
  it('NO incluye en servicios las landings de marketing: su hub es marketing-digital', () => {
    const servicios = slugs(landingsForHub('servicios'));

    slugs(landingsBySilo('marketing')).forEach((slug) => expect(servicios).not.toContain(slug));
  });
});

describe('landingsListedInHub', () => {
  it('coincide con landingsForHub en los hubs de un solo silo', () => {
    expect(slugs(landingsListedInHub('clases-de-programacion'))).toEqual(
      slugs(landingsForHub('clases-de-programacion'))
    );
    expect(slugs(landingsListedInHub('marketing-digital'))).toEqual(slugs(landingsForHub('marketing-digital')));
  });

  it('la página de servicios lista también las landings de marketing', () => {
    const listed = slugs(landingsListedInHub('servicios'));

    slugs(landingsBySilo('marketing')).forEach((slug) => expect(listed).toContain(slug));
    slugs(landingsForHub('servicios')).forEach((slug) => expect(listed).toContain(slug));
  });

  it('recorre los silos en el orden de hub.silos y no repite ninguna landing', () => {
    const hub = getHub('servicios');
    const listed = landingsListedInHub('servicios');

    expect(slugs(listed)).toEqual(hub.silos.flatMap((silo) => slugs(landingsBySilo(silo))));
    expect(new Set(slugs(listed)).size).toBe(listed.length);
  });

  it('todas las landings listadas pertenecen a un silo del hub', () => {
    HUBS.forEach((hub) =>
      landingsListedInHub(hub.slug).forEach((landing) => expect(hub.silos).toContain(landing.silo))
    );
  });

  it('lanza ante un hub desconocido', () => {
    expect(() => landingsListedInHub('no-existe')).toThrow('Unknown hub "no-existe"');
  });
});

describe('hubForLanding', () => {
  it.each(LANDINGS.map((landing) => [landing.slug, landing] as const))(
    '%s resuelve el hub de su silo',
    (_slug, landing) => {
      expect(hubForLanding(landing).slug).toBe(SILOS[landing.silo].hub);
    }
  );

  it('los cursos cuelgan del hub de clases', () => {
    expect(hubForLanding(getLanding('curso-de-aws')).slug).toBe('clases-de-programacion');
  });

  it('los servicios de marketing cuelgan del hub de marketing digital', () => {
    expect(hubForLanding(getLanding('google-shopping')).slug).toBe('marketing-digital');
  });

  it('los servicios técnicos cuelgan del hub de servicios', () => {
    expect(hubForLanding(getLanding('consultoria-aws')).slug).toBe('servicios');
  });

  it('lanza si el silo de la landing no existe', () => {
    expect(() => hubForLanding({ ...getLanding('clases-de-ia'), silo: 'inventado' as SiloId })).toThrow(
      'Unknown silo "inventado"'
    );
  });
});

describe('landingMetadata', () => {
  const entries = [
    ...LANDINGS.map((landing) => [`landing ${landing.slug}`, landing] as const),
    ...HUBS.map((hub) => [`hub ${hub.slug}`, hub] as const),
  ];

  it.each(entries)('%s usa su título y su descripción del registro tal cual', (_label, entry) => {
    const metadata = landingMetadata(entry);

    expect(metadata.title).toBe(entry.title);
    expect(metadata.description).toBe(entry.description);
  });

  // Los títulos del registro ya traen la marca: sin esto saldrían con " | Sonmyd" duplicado.
  it.each(entries)('%s ignora la plantilla de título', (_label, entry) => {
    expect(landingMetadata(entry).ignoreTitleTemplate).toBe(true);
  });

  it.each(entries)('%s declara un canonical relativo que Metadata.astro vuelve absoluto', (_label, entry) => {
    expect(landingMetadata(entry).canonical).toBe(`/${entry.slug}`);
  });

  it('declara la imagen social con el alias ~/assets que resuelve adaptOpenGraphImages', () => {
    const metadata = landingMetadata(getLanding('clases-de-python'));

    expect(metadata.openGraph?.images).toEqual([
      { url: '~/assets/images/seo/clases-de-python.jpg', width: 1600, height: 900 },
    ]);
  });

  // findImage() solo resuelve rutas que empiezan por "~/assets/images".
  it.each(entries)('%s apunta la imagen a ~/assets/images/seo/', (_label, entry) => {
    const [image] = landingMetadata(entry).openGraph?.images ?? [];

    expect(image.url).toMatch(/^~\/assets\/images\/seo\/[a-z0-9-]+\.jpg$/);
  });

  it('toma el archivo de la imagen del manifiesto, no del slug', () => {
    const entry = { ...getLanding('clases-de-ia'), image: 'home' };

    expect(landingMetadata(entry).openGraph?.images?.[0].url).toBe('~/assets/images/seo/home.jpg');
  });

  it('funciona también para un hub', () => {
    const metadata = landingMetadata(getHub('servicios'));

    expect(metadata.canonical).toBe('/servicios');
    expect(metadata.openGraph?.images?.[0].url).toBe('~/assets/images/seo/servicios.jpg');
  });

  it('no declara robots: hereda indexar y seguir de la configuración global', () => {
    expect(landingMetadata(getLanding('clases-de-ia'))).not.toHaveProperty('robots');
  });

  // Fallar fuerte: una landing sin imagen es un bug que los tests deben atrapar.
  it('lanza, nombrando la clave y la landing, si el registro apunta a una imagen inexistente', () => {
    const broken = { ...getLanding('clases-de-ia'), image: 'sin-imagen' };

    expect(() => landingMetadata(broken)).toThrow(
      'Missing SEO image metadata for "sin-imagen" (used by "clases-de-ia")'
    );
  });
});

describe('hubBreadcrumbs', () => {
  it('lleva de Inicio al hub', () => {
    expect(hubBreadcrumbs(getHub('servicios'))).toEqual([
      { name: 'Inicio', path: '/' },
      { name: 'Servicios', path: '/servicios' },
    ]);
  });

  it.each(HUBS.map((hub) => [hub.slug, hub] as const))('%s termina en su propia ruta', (slug, hub) => {
    const crumbs = hubBreadcrumbs(hub);

    expect(crumbs).toHaveLength(2);
    expect(crumbs.at(-1)).toEqual({ name: hub.name, path: `/${slug}` });
  });
});

describe('landingBreadcrumbs', () => {
  it('lleva de Inicio al hub y de ahí a la landing (un curso)', () => {
    expect(landingBreadcrumbs(getLanding('clases-de-ia'))).toEqual([
      { name: 'Inicio', path: '/' },
      { name: 'Clases de programación', path: '/clases-de-programacion' },
      { name: 'Clases de IA', path: '/clases-de-ia' },
    ]);
  });

  it('usa el hub de servicios para un servicio técnico', () => {
    expect(landingBreadcrumbs(getLanding('agentes-de-ia'))).toEqual([
      { name: 'Inicio', path: '/' },
      { name: 'Servicios', path: '/servicios' },
      { name: 'Agentes de IA', path: '/agentes-de-ia' },
    ]);
  });

  it('usa el hub de marketing digital para un servicio de marketing', () => {
    expect(landingBreadcrumbs(getLanding('posicionamiento-seo'))).toEqual([
      { name: 'Inicio', path: '/' },
      { name: 'Marketing digital', path: '/marketing-digital' },
      { name: 'Posicionamiento SEO', path: '/posicionamiento-seo' },
    ]);
  });

  it.each(LANDINGS.map((landing) => [landing.slug, landing] as const))(
    '%s: Inicio > hub > landing, con rutas que empiezan por /',
    (slug, landing) => {
      const crumbs = landingBreadcrumbs(landing);

      expect(crumbs).toHaveLength(3);
      expect(crumbs[0]).toEqual({ name: 'Inicio', path: '/' });
      expect(crumbs[1]).toEqual({ name: hubForLanding(landing).name, path: `/${hubForLanding(landing).slug}` });
      expect(crumbs[2]).toEqual({ name: landing.name, path: `/${slug}` });
      crumbs.forEach((crumb) => expect(crumb.path.startsWith('/')).toBe(true));
    }
  );
});

describe('relatedLinksFor', () => {
  it('a un curso le ofrece que lo hagamos por él', () => {
    const model = relatedLinksFor(getLanding('clases-de-ia'));

    expect(PAIR_HEADING.curso).toBe('¿Prefieres que lo hagamos por ti?');
    expect(model.pair.heading).toBe('¿Prefieres que lo hagamos por ti?');
    expect(model.pair.landing.slug).toBe('agentes-de-ia');
  });

  it('a un servicio le ofrece aprender a hacerlo él mismo', () => {
    const model = relatedLinksFor(getLanding('agentes-de-ia'));

    expect(PAIR_HEADING.servicio).toBe('¿Quieres aprender a hacerlo tú mismo?');
    expect(model.pair.heading).toBe('¿Quieres aprender a hacerlo tú mismo?');
    expect(model.pair.landing.slug).toBe('clases-de-ia');
  });

  it.each([
    ['curso-de-aws', 'Ver todos los cursos', 'clases-de-programacion'],
    ['consultoria-aws', 'Ver todos los servicios', 'servicios'],
    ['publicidad-en-meta-ads', 'Ver servicios de marketing', 'marketing-digital'],
    // Un curso de marketing es un curso: vuelve al hub de clases, no al de marketing.
    ['curso-de-marketing-digital', 'Ver todos los cursos', 'clases-de-programacion'],
  ])('%s enlaza de vuelta a su hub con "%s"', (slug, label, hubSlug) => {
    const { hub } = relatedLinksFor(getLanding(slug));

    expect(hub.label).toBe(label);
    expect(hub.hub.slug).toBe(hubSlug);
  });

  it('cada hub tiene su texto de regreso', () => {
    expect(Object.keys(HUB_LINK_LABEL).sort()).toEqual(HUBS.map((hub) => hub.slug).sort());
  });

  describe.each(LANDINGS.map((landing) => [landing.slug, landing] as const))('%s', (_slug, landing) => {
    const model = relatedLinksFor(landing);

    it('su contraparte es del tipo opuesto (curso <-> servicio)', () => {
      expect(model.pair.landing.kind).not.toBe(landing.kind);
    });

    it('resuelve las hermanas del registro sin repetirlas ni incluir la propia página', () => {
      const related = slugs(model.related);

      expect(related.length).toBeGreaterThan(0);
      expect(new Set(related).size).toBe(related.length);
      expect(related).not.toContain(landing.slug);
      expect(related).not.toContain(model.pair.landing.slug);
    });
  });

  it('descarta duplicados, la contraparte y la propia página si el registro los repite', () => {
    const messy: Landing = {
      ...getLanding('clases-de-ia'),
      related: ['clases-de-ia', 'agentes-de-ia', 'clases-de-python', 'clases-de-python', 'curso-de-n8n'],
    };

    expect(slugs(relatedLinksFor(messy).related)).toEqual(['clases-de-python', 'curso-de-n8n']);
  });

  it('lanza si la contraparte no existe en el registro', () => {
    expect(() => relatedLinksFor({ ...getLanding('clases-de-ia'), pair: 'no-existe' })).toThrow(
      'Unknown landing "no-existe"'
    );
  });

  it('lanza si una hermana no existe en el registro', () => {
    expect(() => relatedLinksFor({ ...getLanding('clases-de-ia'), related: ['clases-de-python', 'fantasma'] })).toThrow(
      'Unknown landing "fantasma"'
    );
  });
});
