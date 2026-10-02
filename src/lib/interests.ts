import { LANDINGS, SILOS } from '../data/landings';
import type { Landing, SiloId } from '../data/landings';

/**
 * Catálogo de servicios por los que puede entrar un lead.
 *
 * Se deriva del registro de landings (src/data/landings.ts): cada landing es un
 * interés cuyo valor es su slug, que coincide con la ruta de la página y con el
 * `interest` que esa página manda al formulario. Registrar una landing nueva
 * basta para que el formulario la ofrezca, la API la acepte y el panel la
 * muestre; no hay una segunda lista que mantener.
 *
 * Vive en un solo lugar a propósito: el formulario lo usa para pintar el
 * desplegable, la API para validar y el panel para filtrar. Si cada capa
 * tuviera su propia lista, alcanzaría con renombrar una opción para que los
 * leads empezaran a caer en una categoría que el panel no sabe mostrar.
 */

export interface InterestOption {
  value: string;
  label: string;
}

/** Salida para quien no sabe qué necesita. No es una landing, siempre va al final. */
export const OTHER_INTEREST = { value: 'otro', label: 'Otro' } as const;

export const INTERESTS: ReadonlyArray<InterestOption> = [
  ...LANDINGS.map(({ slug, name }) => ({ value: slug, label: name })),
  OTHER_INTEREST,
];

export interface InterestGroup {
  silo: SiloId;
  /** Nombre del silo tal como lo ve la persona: es el rótulo del `<optgroup>`. */
  label: string;
  options: ReadonlyArray<InterestOption>;
}

export interface GroupedInterests {
  /** Un grupo por silo con landings, en el orden de `SILOS`; dentro, el orden del registro. */
  groups: InterestGroup[];
  /** "Otro" no es una landing ni pertenece a un silo: va suelto, después de todos los grupos. */
  other: InterestOption;
}

/**
 * Los intereses del formulario agrupados por silo, para pintar un `<select>` con
 * `<optgroup>`. Con una opción por landing el desplegable plano tiene más de
 * veinte entradas seguidas y obliga a leerlas todas para encontrar la suya; los
 * grupos reproducen las mismas líneas de servicio que el menú y el pie de página.
 *
 * Es una función pura sobre el registro: no mantiene una segunda lista. Los
 * parámetros existen para poder probarla con datos propios; en el sitio se llama
 * sin argumentos.
 *
 * - Un silo sin landings no genera un `<optgroup>` vacío.
 * - Una landing de un silo desconocido LANZA en vez de omitirse: callarla haría
 *   desaparecer una opción del formulario sin que nada falle.
 */
export const groupInterestsBySilo = (
  landings: ReadonlyArray<Pick<Landing, 'slug' | 'name' | 'silo'>> = LANDINGS,
  silos: Readonly<Record<string, { name: string }>> = SILOS
): GroupedInterests => {
  const siloIds = Object.keys(silos) as SiloId[];

  landings.forEach(({ slug, silo }) => {
    if (!siloIds.includes(silo)) throw new Error(`Unknown silo "${silo}" (used by "${slug}")`);
  });

  const groups = siloIds
    .map((silo) => ({
      silo,
      label: silos[silo].name,
      options: landings
        .filter((landing) => landing.silo === silo)
        .map(({ slug, name }) => ({ value: slug, label: name })),
    }))
    .filter((group) => group.options.length > 0);

  return { groups, other: OTHER_INTEREST };
};

export type InterestValue = string;

const VALUES = new Set<string>(INTERESTS.map((interest) => interest.value));

export const isValidInterest = (value: unknown): value is InterestValue =>
  typeof value === 'string' && VALUES.has(value);

/**
 * Normaliza lo que llega del formulario. Un interés desconocido no invalida el
 * lead: un contacto real vale mucho más que un campo de taxonomía prolijo, así
 * que se guarda como null y el lead entra igual.
 */
export const normalizeInterest = (value: unknown): InterestValue | null => (isValidInterest(value) ? value : null);

export const interestLabel = (value: string | null | undefined): string =>
  INTERESTS.find((interest) => interest.value === value)?.label ?? 'Sin especificar';
