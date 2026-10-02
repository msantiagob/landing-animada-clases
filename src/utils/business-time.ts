import { BUSINESS } from '~/data/business';

/**
 * La hora del negocio.
 *
 * Todo lo que lleva fecha y hora en este sitio (los turnos de la agenda, los avisos por
 * correo, el panel) está en hora de Colombia, y no en la del servidor ni en la de quien
 * mira. Netlify ejecuta las funciones en UTC: leer "2026-10-05 11:00" con la zona local
 * del servidor corría cada turno cinco horas, así que uno con tres horas de anticipación
 * se rechazaba y uno que ya había pasado podía aceptarse.
 *
 * Colombia no tiene horario de verano: su desfase es siempre UTC-5
 * (`BUSINESS.utcOffsetMinutes`). Por eso pasar de "fecha y hora de Colombia" a un instante
 * es una suma fija. El camino de vuelta, de un instante a fecha y hora, lo resuelve `Intl`
 * con el nombre de la zona (`BUSINESS.timezone`); tests/business-time.test.ts comprueba que
 * los dos caminos sigan coincidiendo.
 *
 * Ninguna función de acá lee la zona horaria del proceso: el resultado es el mismo en
 * cualquier servidor y en cualquier navegador.
 */

/** Cómo se nombra la zona en los textos para las personas. */
export const BUSINESS_TIME_LABEL = 'hora de Colombia';

const MINUTE_MS = 60_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * Campos numéricos y explícitos (`formatToParts`): el texto no depende de cómo escriba la
 * fecha el idioma ni de la versión de ICU. `hourCycle: 'h23'` evita las "24:00" de la medianoche.
 * Se crea una sola vez: construir un `Intl.DateTimeFormat` es lo caro, no usarlo.
 */
const businessClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const clockOf = (instant: Date) => {
  const fields: Record<string, string> = {};

  for (const { type, value } of businessClock.formatToParts(instant)) fields[type] = value;

  return fields as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
};

/**
 * `yyyy-MM-dd` + `HH:mm` en hora de Colombia → el instante exacto. `null` si no son una
 * fecha y una hora reales.
 *
 * Se valida a mano porque tanto `Date.UTC` como el parser de fechas ISO de V8 desbordan en
 * silencio en vez de fallar: "2027-02-31" pasa a marzo y "24:00" al día siguiente. Una
 * reserva con una fecha inexistente no puede terminar guardada en otro día.
 */
export const businessDateTimeToInstant = (date: string, time: string): Date | null => {
  const dateParts = DATE_PATTERN.exec(date);
  const timeParts = TIME_PATTERN.exec(time);

  if (!dateParts || !timeParts) return null;

  const [year, month, day] = dateParts.slice(1).map(Number);
  const [hour, minute] = timeParts.slice(1).map(Number);

  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const isReal =
    wallClock.getUTCFullYear() === year &&
    wallClock.getUTCMonth() === month - 1 &&
    wallClock.getUTCDate() === day &&
    wallClock.getUTCHours() === hour &&
    wallClock.getUTCMinutes() === minute;

  if (!isReal) return null;

  // El reloj de Colombia va cinco horas por detrás del de UTC (el desfase es negativo): las
  // 09:00 de allá son las 14:00 UTC. Restar un desfase negativo es sumar esas cinco horas.
  return new Date(wallClock.getTime() - BUSINESS.utcOffsetMinutes * MINUTE_MS);
};

/** `yyyy-MM-dd` del día en que está Colombia en ese instante (por defecto, ahora). */
export const businessDateOf = (instant: Date = new Date()): string => {
  const { year, month, day } = clockOf(instant);

  return `${year}-${month}-${day}`;
};

/**
 * `dd/MM/yyyy HH:mm` en hora de Colombia, para mostrar un instante guardado en ISO 8601
 * (UTC), como el `created_at` de un contacto. Si no es una fecha, devuelve el texto como llegó.
 */
export const formatBusinessDateTime = (value: string | Date): string => {
  const instant = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(instant.getTime())) return String(value);

  const { year, month, day, hour, minute } = clockOf(instant);

  return `${day}/${month}/${year} ${hour}:${minute}`;
};

/** `10:00` → `10:00 (hora de Colombia)`: quien reserva desde otro país no debe leerlo en la hora de su reloj. */
export const withBusinessTimeLabel = (time: string): string => `${time} (${BUSINESS_TIME_LABEL})`;
