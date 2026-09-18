import type { APIRoute } from 'astro';
import { addHours, isBefore, isValid, parse } from 'date-fns';
import { dbHelpers } from '../../lib/database';
import { emailHelpers } from '../../lib/email';
import {
  EMAIL_REGEX,
  asOptionalString,
  asTrimmedString,
  badRequest,
  conflict,
  getClientIp,
  ok,
  parseBody,
  rateLimit,
  serverError,
  tooManyRequests,
} from '../../lib/http';

export const prerender = false;

const OPENING_HOUR = 9;
const CLOSING_HOUR = 18;
const MIN_LEAD_TIME_HOURS = 2;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^\d{2}:\d{2}$/;

export const buildDaySlots = (): string[] =>
  Array.from(
    { length: CLOSING_HOUR - OPENING_HOUR + 1 },
    (_, index) => `${(OPENING_HOUR + index).toString().padStart(2, '0')}:00`
  );

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await parseBody(request);

    if (asTrimmedString(body.website) !== '') return ok({ message: 'Cita agendada correctamente.' });

    const ip = getClientIp(request);
    if (!rateLimit({ key: `appointments:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 })) return tooManyRequests();

    const name = asTrimmedString(body.name);
    const email = asTrimmedString(body.email).toLowerCase();
    const serviceType = asTrimmedString(body.serviceType);
    const date = asTrimmedString(body.date);
    const time = asTrimmedString(body.time);

    if (!name || !email || !serviceType || !date || !time) {
      return badRequest('Nombre, email, tipo de servicio, fecha y hora son obligatorios');
    }

    if (!EMAIL_REGEX.test(email)) return badRequest('Formato de email inválido');
    if (!DATE_FORMAT.test(date) || !TIME_FORMAT.test(time)) return badRequest('Formato de fecha u hora inválido');

    const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(appointmentDateTime)) return badRequest('Formato de fecha u hora inválido');

    if (isBefore(appointmentDateTime, addHours(new Date(), MIN_LEAD_TIME_HOURS))) {
      return badRequest(`La cita debe agendarse con al menos ${MIN_LEAD_TIME_HOURS} horas de anticipación`);
    }

    if (!buildDaySlots().includes(time)) {
      return badRequest(`El horario de atención es de ${OPENING_HOUR}:00 a ${CLOSING_HOUR}:00`);
    }

    const isTaken = dbHelpers
      .getAppointmentsByDate(date)
      .some((appointment) => appointment.time === time && appointment.status !== 'cancelled');

    if (isTaken) return conflict('Ese horario ya no está disponible. Elegí otro, por favor.');

    const appointmentData = {
      name,
      email,
      phone: asOptionalString(body.phone),
      company: asOptionalString(body.company),
      serviceType,
      date,
      time,
      timezone: asTrimmedString(body.timezone) || 'America/Bogota',
      duration: Number.parseInt(asTrimmedString(body.duration), 10) || 60,
      message: asOptionalString(body.message),
    };

    const result = dbHelpers.insertAppointment(appointmentData);

    void emailHelpers.sendAppointmentConfirmation(appointmentData);
    void emailHelpers.sendAppointmentNotification(appointmentData);

    return ok({
      message: 'Cita agendada correctamente. Vas a recibir un email de confirmación.',
      appointment: { id: result.lastInsertRowid, date, time, duration: appointmentData.duration },
    });
  } catch (error) {
    console.error('[api/appointments] Error procesando cita:', error);
    return serverError();
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const date = url.searchParams.get('date');

    if (!date) return badRequest('La fecha es requerida');
    if (!DATE_FORMAT.test(date)) return badRequest('Formato de fecha inválido');

    const bookedSlots = dbHelpers
      .getAppointmentsByDate(date)
      .filter((appointment) => appointment.status !== 'cancelled')
      .map((appointment) => appointment.time);

    return ok({
      date,
      availableSlots: buildDaySlots().filter((slot) => !bookedSlots.includes(slot)),
      bookedSlots,
    });
  } catch (error) {
    console.error('[api/appointments] Error obteniendo disponibilidad:', error);
    return serverError();
  }
};
