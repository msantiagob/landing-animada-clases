import { SITE } from 'astrowind:config';
import { BUSINESS } from '~/data/business';

export const SITE_URL = (SITE?.site ?? 'https://sonmyd.co').replace(/\/$/, '');

export const absoluteUrl = (path = '/'): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const AUTHOR_ID = `${SITE_URL}/autor#person`;

/** Acepta una URL absoluta o una ruta del sitio y devuelve siempre una URL absoluta. */
const toAbsoluteUrl = (value: string): string => (/^https?:\/\//.test(value) ? value : absoluteUrl(value));

/**
 * Dirección postal SIN calle: el negocio no tiene una sede pública, y publicar
 * una dirección inventada o ajena en el marcado es peor que no tenerla.
 */
const postalAddress = () => ({
  '@type': 'PostalAddress',
  addressLocality: BUSINESS.address.locality,
  addressRegion: BUSINESS.address.region,
  addressCountry: BUSINESS.address.country,
});

/**
 * Dónde se presta el servicio: los municipios que se atienden en persona y
 * Colombia completa, porque las clases y los servicios también se dan en línea.
 * Reemplaza a la lista de países (AR, MX, ES, CL, PE) que no sustentábamos.
 */
const areaServed = () => [
  ...BUSINESS.areaServed.map((name) => ({ '@type': 'City', name })),
  { '@type': 'Country', name: 'Colombia' },
];

/**
 * Identidad de la marca. Se emite en todas las páginas para que Google
 * consolide las señales bajo una sola entidad en lugar de tratar cada URL
 * como si fuera de un negocio distinto.
 *
 * Es un `ProfessionalService` (subtipo de LocalBusiness) porque el negocio
 * está en Medellín y esa señal local es la que se quiere posicionar. El `@id`
 * se conserva: todos los demás nodos (cursos, servicios, artículos) apuntan a él.
 * No lleva `sameAs`: solo se declaran perfiles verificados.
 */
export const organizationSchema = () => ({
  '@type': 'ProfessionalService',
  '@id': ORGANIZATION_ID,
  name: BUSINESS.name,
  url: SITE_URL,
  logo: absoluteUrl('/favicon.svg'),
  description:
    'Negocio de tecnología en Medellín, Colombia: enseña inteligencia artificial, programación, AWS, Linux, n8n y marketing digital, y desarrolla software, páginas web, apps, bots, agentes de IA, automatizaciones, servidores, ciberseguridad y publicidad en Meta Ads, Google Shopping y SEO.',
  slogan: 'Inteligencia artificial aplicada a tu negocio',
  telephone: BUSINESS.telephone,
  address: postalAddress(),
  geo: {
    '@type': 'GeoCoordinates',
    latitude: BUSINESS.geo.latitude,
    longitude: BUSINESS.geo.longitude,
  },
  areaServed: areaServed(),
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: BUSINESS.telephone,
    contactType: 'customer service',
    availableLanguage: 'es',
    areaServed: 'CO',
  },
  knowsAbout: [
    'Inteligencia artificial',
    'Clases de IA',
    'Agentes de IA',
    'Python',
    'JavaScript',
    'Desarrollo web',
    'Desarrollo de aplicaciones móviles',
    'Desarrollo de software a medida',
    'Bots y chatbots',
    'Asistente de WhatsApp con IA',
    'WhatsApp Business API',
    'Llamadas de marketing con IA',
    'Gestión de llamadas',
    'n8n',
    'Automatización de procesos',
    'AWS',
    'Linux',
    'Administración de servidores y VPS',
    'Ciberseguridad',
    'Meta Ads',
    'Google Shopping',
    'Posicionamiento SEO',
    'Marketing digital',
  ],
});

/**
 * Autor de los artículos. Google evalúa E-E-A-T (experiencia, pericia,
 * autoridad, confianza) y en temas técnicos —ciberseguridad sobre todo— un
 * artículo sin autor identificable rankea peor que uno firmado.
 */
export const personSchema = () => ({
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: 'Santiago Bedoya',
  url: absoluteUrl('/autor'),
  jobTitle: 'Ingeniero de software e instructor de inteligencia artificial',
  worksFor: { '@id': ORGANIZATION_ID },
  knowsAbout: [
    'Inteligencia artificial',
    'Python',
    'WhatsApp Business API',
    'Automatización de procesos',
    'Administración de servidores',
    'Ciberseguridad',
  ],
});

export const websiteSchema = () => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Sonmyd',
  inLanguage: 'es',
  publisher: { '@id': ORGANIZATION_ID },
});

export const serviceSchema = ({
  name,
  description,
  path,
  serviceType,
  image,
}: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  /** URL absoluta o ruta del sitio; se emite siempre como URL absoluta. */
  image?: string;
}) => ({
  '@type': 'Service',
  '@id': `${absoluteUrl(path)}#service`,
  name,
  description,
  serviceType,
  url: absoluteUrl(path),
  provider: { '@id': ORGANIZATION_ID },
  areaServed: areaServed(),
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceUrl: absoluteUrl('/contact'),
  },
  ...(image ? { image: toAbsoluteUrl(image) } : {}),
});

/**
 * Curso con dos modalidades: en línea (toda Colombia) y presencial en Medellín.
 *
 * Deliberadamente NO emite carga horaria (`courseWorkload`), duración ni
 * precios: nunca se verificaron y en el marcado serían afirmaciones públicas.
 * `offers` solo declara que el curso es de pago (`category: 'Paid'`), sin monto.
 * El instructor va en cada `CourseInstance`, que es donde schema.org define la
 * propiedad (en `Course` no existe).
 */
export const courseSchema = ({
  name,
  description,
  path,
  image,
}: {
  name: string;
  description: string;
  path: string;
  /** URL absoluta o ruta del sitio; se emite siempre como URL absoluta. */
  image?: string;
}) => ({
  '@type': 'Course',
  '@id': `${absoluteUrl(path)}#course`,
  name,
  description,
  url: absoluteUrl(path),
  inLanguage: 'es',
  provider: { '@id': ORGANIZATION_ID },
  offers: { '@type': 'Offer', category: 'Paid' },
  hasCourseInstance: [
    {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      instructor: { '@id': AUTHOR_ID },
    },
    {
      '@type': 'CourseInstance',
      courseMode: 'Onsite',
      instructor: { '@id': AUTHOR_ID },
      location: {
        '@type': 'Place',
        name: BUSINESS.address.locality,
        address: postalAddress(),
      },
    },
  ],
  ...(image ? { image: toAbsoluteUrl(image) } : {}),
});

/** Las FAQs son la vía más directa a un rich result en buscadores en español. */
export const faqSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
});

/**
 * Artículos del blog. El `mainEntityOfPage` le dice a Google cuál es la URL
 * canónica de la pieza, y el autor enlaza al Person para que la autoridad se
 * acumule en una entidad y no se disperse artículo por artículo.
 */
export const articleSchema = ({
  headline,
  description,
  path,
  datePublished,
  dateModified,
  image,
}: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}) => ({
  '@type': 'Article',
  '@id': `${absoluteUrl(path)}#article`,
  headline,
  description,
  inLanguage: 'es',
  mainEntityOfPage: absoluteUrl(path),
  datePublished,
  dateModified: dateModified ?? datePublished,
  author: { '@id': AUTHOR_ID },
  publisher: { '@id': ORGANIZATION_ID },
  ...(image ? { image: toAbsoluteUrl(image) } : {}),
});

/**
 * Lista de enlaces de una página pilar hacia su silo. Ayuda a que el buscador
 * lea el bloque como una jerarquía y no como enlaces sueltos.
 */
export const itemListSchema = (items: Array<{ name: string; path: string }>) => ({
  '@type': 'ItemList',
  itemListElement: items.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    url: absoluteUrl(path),
  })),
});

export const breadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    item: absoluteUrl(path),
  })),
});
