import { BUSINESS } from '~/data/business';
import type { LandingKind } from '~/data/landings';

/**
 * Texto del bloque de SEO local ("En Medellín y en toda Colombia").
 *
 * Reglas del contenido, porque aquí se escribe una afirmación pública sobre
 * dónde está el negocio:
 * - Solo se dice lo que respalda `BUSINESS`: estamos en Medellín, atendemos en
 *   persona los municipios de `areaServed` y en línea toda Colombia.
 * - NUNCA se afirma una oficina, sede o dirección física: no hay una pública.
 * - Los municipios cercanos se listan por nombre y no como "área metropolitana",
 *   porque Rionegro no pertenece al Área Metropolitana del Valle de Aburrá.
 */

export const SERVICE_AREA_TITLE = 'En Medellín y en toda Colombia';

/** Municipios atendidos en persona, sin repetir la ciudad base. */
export const nearbyMunicipalities = (): string[] =>
  BUSINESS.areaServed.filter((municipality) => municipality !== BUSINESS.address.locality);

/** "A, B y C" con la conjunción correcta en español ("y" / "e" ante "i"). */
export const formatList = (items: readonly string[]): string =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(items);

export interface ServiceAreaCopy {
  title: string;
  paragraphs: [string, string];
  /** Mensaje prellenado del botón de WhatsApp cuando la página no aporta el suyo. */
  whatsappMessage: string;
}

export function serviceAreaCopy(kind: LandingKind): ServiceAreaCopy {
  const base = BUSINESS.address.locality;
  const nearby = formatList(nearbyMunicipalities());

  if (kind === 'curso') {
    return {
      title: SERVICE_AREA_TITLE,
      paragraphs: [
        `Estamos en ${base}. Damos clases en persona a estudiantes y empresas de ${base} y de municipios cercanos como ${nearby}.`,
        'Si vives en otra ciudad no hay problema: las clases también son online, en vivo, para estudiantes de toda Colombia.',
      ],
      whatsappMessage: 'Hola, quiero información sobre las clases en Medellín u online.',
    };
  }

  return {
    title: SERVICE_AREA_TITLE,
    paragraphs: [
      `Estamos en ${base}. Atendemos en persona a empresas y personas de ${base} y de municipios cercanos como ${nearby}.`,
      'Si tu empresa está en otra ciudad, trabajamos de forma remota con clientes de toda Colombia.',
    ],
    whatsappMessage: 'Hola, quiero información sobre un servicio para mi empresa.',
  };
}
