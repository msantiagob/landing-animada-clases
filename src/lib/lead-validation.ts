/**
 * Reglas de validación del formulario de leads en el navegador, y los topes de
 * longitud de los campos de texto, que comparten con el servidor.
 *
 * Están en un módulo propio y no dentro del <script> del componente por dos
 * razones: se pueden testear sin levantar un navegador, y el mensaje de error
 * que ve el usuario deja de ser una cadena perdida en el markup.
 *
 * Ojo: las reglas de formato son UX, NO seguridad. La validación que manda es
 * la del servidor (src/pages/api/contact.ts y appointments.ts); cualquiera
 * puede saltearse esto con la consola. Los topes de longitud (`FIELD_LIMITS`)
 * sí son una sola lista: el servidor rechaza lo que los formularios ya no dejan
 * escribir (`maxlength`), y los mensajes de error son los mismos en los dos lados.
 */

/**
 * Longitud máxima de cada campo de texto libre, ya sin los espacios de los extremos.
 *
 * Se mide en unidades UTF-16 (`string.length`), igual que el atributo `maxlength` de
 * HTML: lo que un campo deja escribir nunca lo rechaza el servidor por contar distinto.
 */
export const FIELD_LIMITS = {
  name: 100,
  /** RFC 5321: una dirección de correo no pasa de 254 caracteres. */
  email: 254,
  /** E.164 admite 15 dígitos; el resto es margen para el +, espacios, guiones, paréntesis y una extensión. */
  phone: 30,
  company: 100,
  message: 5000,
  /**
   * Solo la agenda: el tipo de servicio. Las opciones del formulario son nombres cortos;
   * el tope frena a quien llama a la API a mano.
   */
  serviceType: 100,
  /**
   * Ruta o URL desde la que se envió el formulario. No la escribe la persona: si un
   * `Referer` o un bot la manda más larga, se recorta y el lead se guarda igual.
   */
  sourcePage: 2048,
} as const;

/** Campos que escribe la persona y que se rechazan si pasan su tope (`sourcePage` se recorta). */
export type LimitedField = Exclude<keyof typeof FIELD_LIMITS, 'sourcePage'>;

/** Cómo nombra cada campo el mensaje de "demasiado largo". */
const FIELD_LABELS: Record<LimitedField, string> = {
  name: 'El nombre',
  email: 'El email',
  phone: 'El teléfono',
  company: 'El nombre de la empresa',
  message: 'El mensaje',
  serviceType: 'El tipo de servicio',
};

const LIMITED_FIELDS = Object.keys(FIELD_LABELS) as LimitedField[];

/** El aviso que ve la persona (debajo del campo, o en la respuesta 400 del servidor). */
export const tooLongMessage = (field: LimitedField): string =>
  `${FIELD_LABELS[field]} es demasiado largo. Usa máximo ${FIELD_LIMITS[field]} caracteres.`;

/** El primer campo (en el orden de `FIELD_LABELS`) que pasa su tope, o `null` si ninguno. */
export const findTooLongField = (
  values: Partial<Record<LimitedField, string | null | undefined>>
): LimitedField | null => LIMITED_FIELDS.find((field) => (values[field]?.length ?? 0) > FIELD_LIMITS[field]) ?? null;

/** Recorta un texto a `max` unidades UTF-16. */
export const clip = (value: string | null | undefined, max: number): string | null => value?.slice(0, max) ?? null;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Acepta + inicial, dígitos, espacios, guiones y paréntesis. Mínimo 7 signos. */
export const PHONE_PATTERN = /^[+\d][\d\s()-]{6,}$/;

export const MESSAGE_MIN_LENGTH = 10;

export type LeadField = 'name' | 'email' | 'phone' | 'message';

export type Validator = (value: string) => string | null;

export const validators: Record<LeadField, Validator> = {
  name: (value) => {
    if (!value) return 'Escribe tu nombre.';
    if (value.length < 2) return 'El nombre es demasiado corto.';
    if (value.length > FIELD_LIMITS.name) return tooLongMessage('name');
    return null;
  },

  // El tope va antes que el formato: no tiene sentido probar la expresión regular sobre un texto enorme.
  email: (value) => {
    if (!value) return 'Necesitamos un email para responderte.';
    if (value.length > FIELD_LIMITS.email) return tooLongMessage('email');
    if (!EMAIL_PATTERN.test(value)) return 'Revisa el email: parece incompleto.';
    return null;
  },

  // Opcional: vacío es válido. Pero si lo completan, tiene que servir para llamar.
  phone: (value) => {
    if (!value) return null;
    if (value.length > FIELD_LIMITS.phone) return tooLongMessage('phone');
    if (!PHONE_PATTERN.test(value)) return 'Revisa el teléfono: solo números, espacios y +.';
    return null;
  },

  message: (value) => {
    if (!value) return 'Cuéntanos brevemente qué necesitas.';
    if (value.length < MESSAGE_MIN_LENGTH) return 'Un poco más de detalle nos ayuda a responderte mejor.';
    if (value.length > FIELD_LIMITS.message) return tooLongMessage('message');
    return null;
  },
};

export const LEAD_FIELDS = Object.keys(validators) as LeadField[];

/** Devuelve los campos inválidos en el orden en que aparecen en el formulario. */
export const findInvalidFields = (values: Partial<Record<LeadField, string>>): LeadField[] =>
  LEAD_FIELDS.filter((field) => validators[field]((values[field] ?? '').trim()) !== null);
