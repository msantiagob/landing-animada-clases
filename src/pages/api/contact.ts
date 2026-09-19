import type { APIRoute } from 'astro';
import { dbHelpers } from '../../lib/database';
import { emailHelpers } from '../../lib/email';
import { normalizeInterest } from '../../lib/interests';
import {
  EMAIL_REGEX,
  asOptionalString,
  asTrimmedString,
  badRequest,
  getClientIp,
  ok,
  parseBody,
  rateLimit,
  serverError,
  tooManyRequests,
} from '../../lib/http';

export const prerender = false;

const MAX_MESSAGE_LENGTH = 5000;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await parseBody(request);

    // Honeypot: un campo oculto que solo un bot completa.
    if (asTrimmedString(body.website) !== '') return ok({ message: 'Formulario enviado correctamente.' });

    const ip = getClientIp(request);
    if (!rateLimit({ key: `contact:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 })) return tooManyRequests();

    const name = asTrimmedString(body.name);
    const email = asTrimmedString(body.email).toLowerCase();
    const message = asTrimmedString(body.message);

    if (!name || !email || !message) return badRequest('Nombre, email y mensaje son obligatorios');
    if (!EMAIL_REGEX.test(email)) return badRequest('Formato de email inválido');
    if (message.length > MAX_MESSAGE_LENGTH) return badRequest('El mensaje es demasiado largo');

    const formData = {
      name,
      email,
      message,
      phone: asOptionalString(body.phone),
      company: asOptionalString(body.company),
      interest: normalizeInterest(body.interest),
      // El formulario manda la ruta real donde se completó. El referer sirve de
      // respaldo, pero se pierde si el navegador lo recorta por política.
      sourcePage: asOptionalString(body.sourcePage) ?? request.headers.get('referer'),
      ip,
      userAgent: request.headers.get('user-agent'),
    };

    const result = dbHelpers.insertContactForm(formData);

    // El mail es best-effort: el lead ya está persistido.
    void emailHelpers.sendContactFormNotification(formData);

    return ok({
      message: 'Formulario enviado correctamente. Te contactamos pronto.',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('[api/contact] Error procesando formulario:', error);
    return serverError();
  }
};
