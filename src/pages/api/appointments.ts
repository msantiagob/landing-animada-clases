import type { APIRoute } from 'astro';
import { BUSINESS_TIMEZONE } from '../../data/business';
import { emailHelpers } from '../../lib/email';
import { findTooLongField, tooLongMessage } from '../../lib/lead-validation';
import { runInBackground } from '../../lib/netlify';
import { getLeadStore } from '../../lib/storage';
import {
  BOOKING_CLOSING_HOUR,
  BOOKING_MIN_LEAD_HOURS,
  BOOKING_OPENING_HOUR,
  buildDaySlots,
  checkBookingRequest,
  type BookingRejection,
} from '../../utils/booking';
import { BUSINESS_TIME_LABEL } from '../../utils/business-time';
import {
  EMAIL_REGEX,
  asOptionalString,
  asTrimmedString,
  badRequest,
  conflict,
  failureResponse,
  getClientIp,
  ok,
  parseBody,
  rateLimit,
  tooManyRequests,
} from '../../lib/http';

export const prerender = false;

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Por qué se rechaza un turno. Las reglas viven en `checkBookingRequest` (utils/booking.ts):
 * fecha y hora son SIEMPRE hora de Colombia y se comparan como instantes, así que la zona
 * en la que corra el servidor (Netlify usa UTC) no cambia el veredicto.
 */
const REJECTION_MESSAGES: Record<BookingRejection, string> = {
  'invalid-datetime': 'Formato de fecha u hora inválido',
  'too-soon': `La cita debe agendarse con al menos ${BOOKING_MIN_LEAD_HOURS} horas de anticipación`,
  'outside-hours': `El horario de atención es de ${BOOKING_OPENING_HOUR}:00 a ${BOOKING_CLOSING_HOUR}:00 (${BUSINESS_TIME_LABEL})`,
};

export const POST: APIRoute = async ({ request, locals }) => {
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
    const phone = asOptionalString(body.phone);
    const company = asOptionalString(body.company);
    const message = asOptionalString(body.message);

    if (!name || !email || !serviceType || !date || !time) {
      return badRequest('Nombre, email, tipo de servicio, fecha y hora son obligatorios');
    }

    // Los topes van ANTES que el formato del email: no tiene sentido probar la expresión regular
    // sobre un texto de megabytes, y cada campo que se guarda queda acotado.
    const tooLong = findTooLongField({ name, email, phone, company, message, serviceType });
    if (tooLong) return badRequest(tooLongMessage(tooLong));

    if (!EMAIL_REGEX.test(email)) return badRequest('Formato de email inválido');

    const booking = checkBookingRequest(date, time);
    if (!booking.ok) return badRequest(REJECTION_MESSAGES[booking.reason]);

    const appointmentData = {
      name,
      email,
      phone,
      company,
      serviceType,
      date,
      time,
      // Fecha y hora son hora de Colombia, la mande el cliente como la mande: guardar otra zona
      // sería afirmar algo que no es cierto del turno.
      timezone: BUSINESS_TIMEZONE,
      duration: Number.parseInt(asTrimmedString(body.duration), 10) || 60,
      message,
    };

    // Reservar el horario y guardar la cita es una sola operación atómica del
    // store: no hay un "consultar si está libre" aparte, que dejaría una ventana
    // para que dos personas reserven a la vez el mismo turno.
    const result = await getLeadStore(locals).createAppointment(appointmentData);

    if (!result.created) return conflict('Ese horario ya no está disponible. Elige otro, por favor.');

    runInBackground(locals, emailHelpers.sendAppointmentConfirmation(appointmentData));
    runInBackground(locals, emailHelpers.sendAppointmentNotification(appointmentData));

    return ok({
      message: 'Cita agendada correctamente. Vas a recibir un email de confirmación.',
      appointment: { id: result.appointment.id, date, time, duration: appointmentData.duration },
    });
  } catch (error) {
    console.error('[api/appointments] Error procesando cita:', error);
    return failureResponse(error);
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const date = url.searchParams.get('date');

    if (!date) return badRequest('La fecha es requerida');
    if (!DATE_FORMAT.test(date)) return badRequest('Formato de fecha inválido');

    const bookedSlots = await getLeadStore(locals).getTakenSlots(date);

    return ok({
      date,
      availableSlots: buildDaySlots().filter((slot) => !bookedSlots.includes(slot)),
      bookedSlots,
    });
  } catch (error) {
    console.error('[api/appointments] Error obteniendo disponibilidad:', error);
    return failureResponse(error);
  }
};
