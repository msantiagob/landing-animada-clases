import { BUSINESS } from './data/business';
import { LANDINGS, SILOS, type HubSlug, type Landing, type SiloId } from './data/landings';
import { getBlogPermalink, getPermalink } from './utils/permalinks';

/**
 * El enlazado interno es una señal directa de SEO: las páginas que apuntamos
 * desde el header y el footer son las que Google entiende como prioritarias.
 *
 * Ambos menús se derivan del registro de landings (src/data/landings.ts) y se
 * agrupan por SILO, no por capricho de diseño. Cada grupo es un bloque temático
 * cerrado con su página pilar (hub). Mezclar silos distintos en un mismo
 * desplegable diluye justamente la señal que buscamos. Registrar una landing
 * nueva alcanza para que aparezca acá; no hay que tocar este archivo.
 */

const SILO_IDS = Object.keys(SILOS) as SiloId[];

const link = (text: string, path: string) => ({ text, href: getPermalink(path) });

const landingsOf = (silo: SiloId): Landing[] => LANDINGS.filter((landing) => landing.silo === silo);

const landingLinks = (landings: Landing[]) => landings.map(({ name, slug }) => link(name, `/${slug}`));

/**
 * Texto del enlace al hub dentro de cada desplegable. Es un Record sobre
 * HubSlug a propósito: sumar un hub al registro sin darle texto no compila.
 */
const HUB_LINK_TEXT: Record<HubSlug, string> = {
  'clases-de-programacion': 'Todos los cursos',
  servicios: 'Todos los servicios',
  'marketing-digital': 'Marketing digital',
};

/** Un desplegable por silo: primero el hub que lo agrupa, después sus landings. */
const dropdown = (silo: SiloId) => {
  const { name, hub } = SILOS[silo];

  return {
    text: name,
    links: [link(HUB_LINK_TEXT[hub], `/${hub}`), ...landingLinks(landingsOf(silo))],
  };
};

export const headerData = {
  links: [...SILO_IDS.map(dropdown), { text: 'Blog', href: getBlogPermalink() }],
  actions: [{ text: 'Asesoría gratuita', href: getPermalink('/booking'), target: '_self' }],
};

/** BUSINESS.address.country es el código ISO ("CO"); a las personas se les muestra el nombre. */
const COUNTRY_NAME = 'Colombia';

export const footerData = {
  links: [
    // Una columna por silo, con todas sus landings.
    ...SILO_IDS.map((silo) => ({ title: SILOS[silo].name, links: landingLinks(landingsOf(silo)) })),
    {
      title: BUSINESS.name,
      links: [
        link(`Sobre ${BUSINESS.name}`, '/about'),
        link('Autor', '/autor'),
        { text: 'Blog', href: getBlogPermalink() },
        link('Contacto', '/contact'),
        link('Agenda una asesoría', '/booking'),
        link('Privacidad', '/privacidad'),
        link('Términos', '/terminos'),
      ],
    },
  ],
  // Privacidad y Términos viven en la columna de la empresa.
  secondaryLinks: [],
  // Sin redes propias todavía. Se agregan cuando existan cuentas reales:
  // un enlace a un perfil vacío daña más la confianza que la ausencia.
  socialLinks: [],
  footNote: `© ${new Date().getFullYear()} ${BUSINESS.name}. Todos los derechos reservados.`,
  // Nombre, ciudad y teléfono salen de BUSINESS: repetirlos idénticos en todo el
  // sitio es una señal de SEO local, y escribirlos a mano en cada lugar es la
  // forma más rápida de que dejen de coincidir.
  description: `${BUSINESS.name} · ${BUSINESS.address.locality}, ${BUSINESS.address.region}, ${COUNTRY_NAME} · WhatsApp ${BUSINESS.telephone}`,
};
