import { SILOS } from '~/data/landings';
import type { PostJsonMessages } from '~/utils/forms';

/** Opción para quien no encaja en ninguna línea de servicio. */
export const OTHER_SERVICE_TYPE = 'Otro';

/**
 * Tipos de servicio del formulario de citas: las líneas del registro de
 * landings (`SILOS`) más "Otro". Derivarlas del registro evita mantener una
 * segunda lista que se desfase cuando cambie la oferta. El valor guardado es el
 * mismo nombre que se ve, así el panel y los correos se leen sin traducción.
 */
export const SERVICE_TYPE_OPTIONS: readonly string[] = [
  ...Object.values(SILOS).map((silo) => silo.name),
  OTHER_SERVICE_TYPE,
];

/** Duración de cada cita: la API agenda turnos de una hora. */
export const BOOKING_DURATION_MINUTES = 60;

export const BOOKING_MESSAGES: PostJsonMessages = {
  rejected: 'Error al agendar la cita. Inténtalo más tarde.',
  network: 'Error de conexión. Inténtalo más tarde.',
};

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const formatMonthYear = (date: Date): string => `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * `yyyy-MM-dd` en la zona horaria de la persona. NO usar `toISOString()`: convierte
 * a UTC y, con un offset negativo como el de Colombia, a las 7 p. m. ya devuelve
 * el día siguiente al elegido.
 */
export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export interface AppointmentFormValues {
  name: string;
  email: string;
  phone: string;
  company: string;
  serviceType: string;
  message: string;
  /** Honeypot: lo completa un bot, nunca una persona. */
  website: string;
}

/** Cuerpo que espera `POST /api/appointments`. */
export const buildAppointmentPayload = (values: AppointmentFormValues, date: Date, time: string) => ({
  name: values.name.trim(),
  email: values.email.trim(),
  phone: values.phone.trim(),
  company: values.company.trim(),
  serviceType: values.serviceType.trim(),
  date: toLocalIsoDate(date),
  time,
  message: values.message.trim(),
  duration: BOOKING_DURATION_MINUTES,
  website: values.website.trim(),
});
