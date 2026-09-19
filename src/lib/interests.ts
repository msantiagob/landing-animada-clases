/**
 * Catálogo de servicios por los que puede entrar un lead.
 *
 * Vive en un solo lugar a propósito: el formulario lo usa para pintar el
 * desplegable, la API para validar y el panel para filtrar. Si cada capa
 * tuviera su propia lista, alcanzaría con renombrar una opción para que los
 * leads empezaran a caer en una categoría que el panel no sabe mostrar.
 */
export const INTERESTS = [
  { value: 'clases-de-ia', label: 'Clases de IA' },
  { value: 'clases-de-python', label: 'Clases de Python' },
  { value: 'asistente-de-whatsapp', label: 'Asistente de WhatsApp con IA' },
  { value: 'whatsapp-business-api', label: 'WhatsApp Business API (Meta)' },
  { value: 'llamadas-de-marketing', label: 'Llamadas de marketing con IA' },
  { value: 'gestor-de-llamadas', label: 'Gestor de llamadas' },
  { value: 'automatizaciones', label: 'Automatizaciones e integraciones' },
  { value: 'desarrollo-de-software', label: 'Desarrollo de software' },
  { value: 'servidores-y-vps', label: 'Servidores y VPS' },
  { value: 'ciberseguridad', label: 'Ciberseguridad' },
  { value: 'otro', label: 'Otro / no estoy seguro' },
] as const;

export type InterestValue = (typeof INTERESTS)[number]['value'];

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
