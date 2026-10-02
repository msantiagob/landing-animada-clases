import { HUBS, LANDINGS, SILOS, type SiloId } from '~/data/landings';

/**
 * Titles, descriptions and topic links for the blog listing, category and tag pages.
 * Pure functions: the .astro pages stay thin and the copy can be unit tested.
 */

const BRAND = 'Sonmyd';

/** Google truncates around 155-160 characters. */
const MAX_DESCRIPTION = 158;

export interface PageSeo {
  title: string;
  description: string;
}

export interface TaxonomySeo extends PageSeo {
  /** Visible <h1> */
  heading: string;
}

export interface TaxonomyInput {
  /** Slug as built by `getNormalizedPost`: `cleanSlug(category)` */
  slug?: string;
  title: string;
}

export interface TopicLink {
  name: string;
  path: string;
}

export interface TopicGroup {
  silo: SiloId;
  name: string;
  links: TopicLink[];
}

export interface BlogTopics {
  /** Hub pages: the entry points of each silo */
  hubs: TopicLink[];
  /** Landings grouped by silo, in the order declared in SILOS */
  groups: TopicGroup[];
}

const withPage = (title: string, page: number): string => (page > 1 ? `${title} — Página ${page}` : title);

/** Cuts at a word boundary so a long category name can never push a description past the limit. */
const fit = (text: string, max = MAX_DESCRIPTION): string => {
  if (text.length <= max) return text;

  const cut = text.slice(0, max - 1);
  const end = cut.lastIndexOf(' ');

  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s,;:.\-—]+$/, '')}…`;
};

// ── Blog index ────────────────────────────────────────────────────────────────

export const BLOG_INDEX_TITLE = 'Blog de programación, IA y marketing digital';

export const BLOG_INDEX_DESCRIPTION =
  'Blog de programación, inteligencia artificial y marketing digital en español: guías sobre Python, automatización, WhatsApp, servidores, apps y SEO.';

/**
 * Only page 1 competes in search (the paginated ones are noindex), so only page 1
 * carries the brand: the rest just need a title that tells them apart.
 */
export const getBlogIndexSeo = (currentPage = 1): PageSeo => ({
  title: currentPage > 1 ? withPage(BLOG_INDEX_TITLE, currentPage) : `${BLOG_INDEX_TITLE} | ${BRAND}`,
  description: BLOG_INDEX_DESCRIPTION,
});

// ── Categories (indexable) ────────────────────────────────────────────────────

/**
 * One real description per category, keyed by slug. Keep each one under ~145
 * characters so the " Página N." suffix of paginated pages still fits.
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  whatsapp:
    'Artículos sobre WhatsApp Business API: diferencias con la app, costos, requisitos de Meta, integraciones y automatización de la atención.',
  automatizacion:
    'Guías para automatizar procesos con IA, Google Workspace, n8n y código propio: cuándo conviene cada herramienta, costos reales y errores comunes.',
  python:
    'Artículos de Python para quien empieza: qué conceptos necesitas, en qué orden aprenderlos y cómo automatizar tareas reales de tu trabajo.',
  'inteligencia-artificial':
    'Artículos de inteligencia artificial: cómo aprenderla desde cero, qué son los agentes de IA y cómo usarla en tu trabajo o en tu empresa.',
  infraestructura:
    'Artículos de infraestructura: servidores VPS, hosting, nube y Linux, con criterios para elegir bien y errores comunes que conviene evitar.',
  seguridad:
    'Artículos de ciberseguridad para pymes: medidas de impacto real, respaldos, control de accesos y capacitación del equipo, sin gastar de más.',
  desarrollo:
    'Artículos de desarrollo de software: cuánto cuesta una página web o una app en Colombia, app nativa o híbrida y cómo aprender JavaScript.',
  'marketing-digital':
    'Artículos de marketing digital: cuánto invertir en Meta Ads, SEO local en Medellín y cómo vender con Google Shopping en Colombia.',
};

/** Curated copy when there is one; otherwise a generic Spanish sentence built from the category name. */
export const getCategoryDescription = ({ slug, title }: TaxonomyInput): string =>
  (slug && CATEGORY_DESCRIPTIONS[slug]) ||
  `Artículos de la categoría ${title} en el blog de Sonmyd: guías prácticas, comparativas y criterios para tomar buenas decisiones.`;

export const getCategorySeo = (category: TaxonomyInput, currentPage = 1): TaxonomySeo => {
  const heading = `Artículos de ${category.title}`;
  const description = getCategoryDescription(category);

  return {
    heading,
    title: `${withPage(heading, currentPage)} | ${BRAND}`,
    description: fit(currentPage > 1 ? `${description} Página ${currentPage}.` : description),
  };
};

// ── Tags (noindex) ────────────────────────────────────────────────────────────

export const getTagSeo = (tag: TaxonomyInput, currentPage = 1): TaxonomySeo => {
  const description = `Todos los artículos del blog de Sonmyd con la etiqueta «${tag.title}»: guías prácticas sobre programación, IA, automatización y marketing digital.`;

  return {
    heading: `Etiqueta: ${tag.title}`,
    title: `${withPage(`Artículos con la etiqueta «${tag.title}»`, currentPage)} | ${BRAND}`,
    description: fit(currentPage > 1 ? `${description} Página ${currentPage}.` : description),
  };
};

// ── Topics derived from the landing registry ──────────────────────────────────

const toPath = (slug: string): string => `/${slug}`;

/**
 * Links shown on the blog index. Derived from the registry, never hand-written:
 * a new landing or hub shows up here without touching the page.
 */
export const getBlogTopics = (): BlogTopics => ({
  hubs: HUBS.map(({ name, slug }) => ({ name, path: toPath(slug) })),
  groups: (Object.keys(SILOS) as SiloId[])
    .map((silo) => ({
      silo,
      name: SILOS[silo].name,
      links: LANDINGS.filter((landing) => landing.silo === silo).map(({ name, slug }) => ({
        name,
        path: toPath(slug),
      })),
    }))
    .filter((group) => group.links.length > 0),
});

/** Flat list, hubs first: what the ItemList JSON-LD declares must match the links on screen. */
export const flattenBlogTopics = ({ hubs, groups }: BlogTopics): TopicLink[] => [
  ...hubs,
  ...groups.flatMap((group) => group.links),
];
