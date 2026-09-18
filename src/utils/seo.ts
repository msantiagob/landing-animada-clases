import { SITE } from 'astrowind:config';

export const SITE_URL = (SITE?.site ?? 'https://sonmyd.com').replace(/\/$/, '');

export const absoluteUrl = (path = '/'): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

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
    'Clases de inteligencia artificial, asistentes de WhatsApp con IA y agentes de voz para llamadas de marketing y gestión de llamadas.',
  slogan: 'Inteligencia artificial aplicada a tu negocio',
  areaServed: ['CO', 'AR', 'MX', 'ES', 'CL', 'PE'],
  knowsAbout: [
    'Inteligencia artificial',
    'Clases de IA',
    'Asistente de WhatsApp con IA',
    'Llamadas de marketing con IA',
    'Gestión de llamadas',
    'Automatización de procesos',
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

export const breadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    item: absoluteUrl(path),
  })),
});
