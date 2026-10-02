import { HUBS, LANDINGS, SILOS } from '~/data/landings';
import type { Hub, HubSlug, Landing, LandingKind, SiloId } from '~/data/landings';
import { getSeoImageMeta } from '~/data/seo-images';
import type { MetaData } from '~/types';

/**
 * Acceso tipado al registro de landings (`~/data/landings`).
 *
 * Las páginas, la navegación y los componentes consultan el registro por acá
 * en lugar de recorrer los arreglos a mano. Los accesores fallan fuerte ante un
 * slug desconocido: una landing que enlaza a una página inexistente es un bug
 * que tiene que romper el render y los tests, no un enlace roto en producción.
 */

export interface Breadcrumb {
  name: string;
  path: string;
}

/** Las imágenes sociales se guardan a 1600x900 (16:9). */
const OG_IMAGE_WIDTH = 1600;
const OG_IMAGE_HEIGHT = 900;

export const landingPath = (slug: string): string => `/${slug}`;

export function getLanding(slug: string): Landing {
  const landing = LANDINGS.find((entry) => entry.slug === slug);
  if (!landing) throw new Error(`Unknown landing "${slug}"`);

  return landing;
}

export function getHub(slug: string): Hub {
  const hub = HUBS.find((entry) => entry.slug === slug);
  if (!hub) throw new Error(`Unknown hub "${slug}"`);

  return hub;
}

const getSilo = (silo: SiloId) => {
  if (!Object.hasOwn(SILOS, silo)) throw new Error(`Unknown silo "${silo}"`);

  return SILOS[silo];
};

export function landingsBySilo(silo: SiloId): Landing[] {
  getSilo(silo);

  return LANDINGS.filter((landing) => landing.silo === silo);
}

/**
 * Todas las landings cuyo silo cuelga de ese hub (`SILOS[silo].hub`), en el
 * orden del registro. Cada landing pertenece a exactamente un hub: el que
 * aparece como su padre en las migas de pan.
 */
export function landingsForHub(hubSlug: string): Landing[] {
  const hub = getHub(hubSlug);

  return LANDINGS.filter((landing) => getSilo(landing.silo).hub === hub.slug);
}

/**
 * Landings que la PÁGINA de un hub lista: las de cada silo de `hub.silos`, en
 * el orden de esa lista.
 *
 * Difiere de `landingsForHub` solo en el hub de servicios: su página lista
 * también el silo de marketing, pero ese silo cuelga de `marketing-digital`
 * (su hub padre, el de las migas de pan). Para la página `/servicios` usa esta
 * función; para saber a qué hub pertenece una landing, `hubForLanding`.
 */
export function landingsListedInHub(hubSlug: string): Landing[] {
  return getHub(hubSlug).silos.flatMap(landingsBySilo);
}

export function hubForLanding(landing: Landing): Hub {
  return getHub(getSilo(landing.silo).hub);
}

/**
 * Metadata de página para una landing o un hub, lista para `<Layout metadata>`.
 *
 * - `ignoreTitleTemplate`: los títulos del registro ya traen la marca y miden
 *   30-60 caracteres; la plantilla global les sumaría " | Sonmyd" otra vez.
 * - `canonical` va relativo; `Metadata.astro` lo normaliza a URL absoluta.
 * - La imagen social se declara como `~/assets/...` y `adaptOpenGraphImages`
 *   la resuelve y optimiza (1200 px de ancho) al renderizar.
 */
export function landingMetadata(entry: Landing | Hub): MetaData {
  const image = getSeoImageMeta(entry.image);
  if (!image) throw new Error(`Missing SEO image metadata for "${entry.image}" (used by "${entry.slug}")`);

  return {
    title: entry.title,
    description: entry.description,
    ignoreTitleTemplate: true,
    canonical: landingPath(entry.slug),
    openGraph: {
      images: [{ url: `~/assets/images/seo/${image.file}`, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }],
    },
  };
}

export function hubBreadcrumbs(hub: Hub): Breadcrumb[] {
  return [
    { name: 'Inicio', path: '/' },
    { name: hub.name, path: landingPath(hub.slug) },
  ];
}

export function landingBreadcrumbs(landing: Landing): Breadcrumb[] {
  return [...hubBreadcrumbs(hubForLanding(landing)), { name: landing.name, path: landingPath(landing.slug) }];
}

/** Título del bloque que invita a pasar de aprender a contratar, y viceversa. */
export const PAIR_HEADING: Record<LandingKind, string> = {
  curso: '¿Prefieres que lo hagamos por ti?',
  servicio: '¿Quieres aprender a hacerlo tú mismo?',
};

/** Texto del enlace de regreso al hub, según el hub al que pertenece la landing. */
export const HUB_LINK_LABEL: Record<HubSlug, string> = {
  'clases-de-programacion': 'Ver todos los cursos',
  servicios: 'Ver todos los servicios',
  'marketing-digital': 'Ver servicios de marketing',
};

export interface RelatedLinksModel {
  pair: { heading: string; landing: Landing };
  related: Landing[];
  hub: { hub: Hub; label: string };
}

/**
 * Datos del bloque "También te puede interesar" de una landing: la contraparte
 * (aprender ↔ contratar), las hermanas del silo y el regreso al hub.
 *
 * Si el registro repitiera una hermana, o incluyera la contraparte o la propia
 * página dentro de `related`, se descartan: un enlace duplicado o a sí misma
 * no aporta nada y diluye los enlaces útiles.
 */
export function relatedLinksFor(landing: Landing): RelatedLinksModel {
  const pair = getLanding(landing.pair);
  const hub = hubForLanding(landing);

  const seen = new Set([landing.slug, pair.slug]);
  const related = landing.related.map(getLanding).filter((entry) => {
    if (seen.has(entry.slug)) return false;
    seen.add(entry.slug);
    return true;
  });

  return {
    pair: { heading: PAIR_HEADING[landing.kind], landing: pair },
    related,
    hub: { hub, label: HUB_LINK_LABEL[hub.slug] },
  };
}
