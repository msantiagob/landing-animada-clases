/**
 * Reglas de validación del formulario de leads en el navegador.
 *
 * Están en un módulo propio y no dentro del <script> del componente por dos
 * razones: se pueden testear sin levantar un navegador, y el mensaje de error
 * que ve el usuario deja de ser una cadena perdida en el markup.
 *
 * Ojo: esto es UX, NO es seguridad. La validación que manda es la del servidor
 * (src/pages/api/contact.ts); cualquiera puede saltearse esto con la consola.
 */

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
    return null;
  },

  email: (value) => {
    if (!value) return 'Necesitamos un email para responderte.';
    if (!EMAIL_PATTERN.test(value)) return 'Revisa el email: parece incompleto.';
    return null;
  },

  // Opcional: vacío es válido. Pero si lo completan, tiene que servir para llamar.
  phone: (value) => {
    if (!value) return null;
    if (!PHONE_PATTERN.test(value)) return 'Revisa el teléfono: solo números, espacios y +.';
    return null;
  },

  message: (value) => {
    if (!value) return 'Cuéntanos brevemente qué necesitas.';
    if (value.length < MESSAGE_MIN_LENGTH) return 'Un poco más de detalle nos ayuda a responderte mejor.';
    return null;
  },
};

export const LEAD_FIELDS = Object.keys(validators) as LeadField[];

/** Devuelve los campos inválidos en el orden en que aparecen en el formulario. */
export const findInvalidFields = (values: Partial<Record<LeadField, string>>): LeadField[] =>
  LEAD_FIELDS.filter((field) => validators[field]((values[field] ?? '').trim()) !== null);
