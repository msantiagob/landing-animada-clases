import { SITE } from 'astrowind:config';

export const SITE_URL = (SITE?.site ?? 'https://sonmyd.co').replace(/\/$/, '');

export const absoluteUrl = (path = '/'): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const AUTHOR_ID = `${SITE_URL}/autor#person`;

/**
 * Identidad de la marca. Se emite en todas las páginas para que Google
 * consolide las señales bajo una sola entidad en lugar de tratar cada URL
 * como si fuera de un negocio distinto.
 */
export const organizationSchema = () => ({
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Sonmyd',
  url: SITE_URL,
  logo: absoluteUrl('/favicon.svg'),
  description:
    'Clases de inteligencia artificial y Python, asistentes de WhatsApp sobre la API oficial de Meta, automatizaciones, desarrollo de software, administración de servidores y ciberseguridad.',
  slogan: 'Inteligencia artificial aplicada a tu negocio',
  areaServed: ['CO', 'AR', 'MX', 'ES', 'CL', 'PE'],
  knowsAbout: [
    'Inteligencia artificial',
    'Clases de IA',
    'Clases de Python',
    'Asistente de WhatsApp con IA',
    'WhatsApp Business API',
    'Meta Business',
    'Llamadas de marketing con IA',
    'Gestión de llamadas',
    'Automatización de procesos',
    'Automatización con Google Workspace',
    'Desarrollo de software a medida',
    'Desarrollo de APIs',
    'Administración de servidores y VPS',
    'Ciberseguridad',
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
}: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
}) => ({
  '@type': 'Service',
  '@id': `${absoluteUrl(path)}#service`,
  name,
  description,
  serviceType,
  url: absoluteUrl(path),
  provider: { '@id': ORGANIZATION_ID },
  areaServed: ['CO', 'AR', 'MX', 'ES', 'CL', 'PE'],
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceUrl: absoluteUrl('/contact'),
  },
});

export const courseSchema = ({
  name,
  description,
  path,
  modes,
}: {
  name: string;
  description: string;
  path: string;
  modes: Array<'online' | 'onsite' | 'blended'>;
}) => ({
  '@type': 'Course',
  '@id': `${absoluteUrl(path)}#course`,
  name,
  description,
  url: absoluteUrl(path),
  inLanguage: 'es',
  provider: { '@id': ORGANIZATION_ID },
  hasCourseInstance: modes.map((mode) => ({
    '@type': 'CourseInstance',
    courseMode: mode,
    courseWorkload: 'PT16H',
  })),
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
  ...(image ? { image: image.startsWith('http') ? image : absoluteUrl(image) } : {}),
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
