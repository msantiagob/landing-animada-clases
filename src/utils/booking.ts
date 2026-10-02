import { SILOS } from '~/data/landings';
import { businessDateTimeToInstant } from '~/utils/business-time';
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

/**
 * Franja de atención y anticipación mínima. Los turnos son de una hora, en punto, y la hora es
 * siempre la de Colombia (ver business-time.ts): ni la zona del servidor ni la de quien reserva
 * cambian qué turnos existen.
 */
export const BOOKING_OPENING_HOUR = 9;
export const BOOKING_CLOSING_HOUR = 18;
export const BOOKING_MIN_LEAD_HOURS = 2;

const HOUR_MS = 60 * 60 * 1000;

/** Los turnos de un día, de la apertura al cierre: `09:00`, `10:00` ... `18:00`. */
export const buildDaySlots = (): string[] =>
  Array.from(
    { length: BOOKING_CLOSING_HOUR - BOOKING_OPENING_HOUR + 1 },
    (_, index) => `${String(BOOKING_OPENING_HOUR + index).padStart(2, '0')}:00`
  );

export type BookingRejection =
  /** La fecha o la hora no existen (o no tienen el formato `yyyy-MM-dd` / `HH:mm`). */
  | 'invalid-datetime'
  /** El turno ya pasó o falta menos de `BOOKING_MIN_LEAD_HOURS` para que empiece. */
  | 'too-soon'
  /** La hora no es uno de los turnos del día. */
  | 'outside-hours';

export type BookingCheck = { ok: true; startsAt: Date } | { ok: false; reason: BookingRejection };

/**
 * ¿Se puede agendar este turno? `date` y `time` son hora de Colombia, tal como los eligió la
 * persona. Se comparan como instantes contra `now`, así que el resultado no depende de la
 * zona del servidor: a las 08:00 en Colombia las 11:00 de hoy tienen tres horas de
 * anticipación, sea cual sea el reloj que tenga la máquina que lo calcula.
 *
 * Una fecha que ya pasó también cae en `too-soon`: antes de la anticipación mínima y
 * antes de ahora son la misma comparación.
 */
export const checkBookingRequest = (date: string, time: string, now: Date = new Date()): BookingCheck => {
  const startsAt = businessDateTimeToInstant(date, time);

  if (!startsAt) return { ok: false, reason: 'invalid-datetime' };

  if (startsAt.getTime() < now.getTime() + BOOKING_MIN_LEAD_HOURS * HOUR_MS) return { ok: false, reason: 'too-soon' };

  if (!buildDaySlots().includes(time)) return { ok: false, reason: 'outside-hours' };

  return { ok: true, startsAt };
};

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

/**
 * ¿Se puede elegir este día en el calendario? `todayIso` es el "hoy" de Colombia
 * (`businessDateOf()`), no el del navegador. No se ofrecen los fines de semana ni hoy ni lo
 * que ya pasó: el primer día que se puede elegir es mañana. Los días son fechas de calendario,
 * así que se comparan como texto `yyyy-MM-dd`, y no como instantes de la zona del navegador.
 */
export const isSelectableDay = (day: Date, todayIso: string): boolean => {
  const weekday = day.getDay();

  return weekday !== 0 && weekday !== 6 && toLocalIsoDate(day) > todayIso;
};

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
