import type { APIRoute } from 'astro';
import { emailHelpers } from '../../lib/email';
import { normalizeInterest } from '../../lib/interests';
import { FIELD_LIMITS, clip, findTooLongField, tooLongMessage } from '../../lib/lead-validation';
import { runInBackground } from '../../lib/netlify';
import { getLeadStore } from '../../lib/storage';
import {
  EMAIL_REGEX,
  asOptionalString,
  asTrimmedString,
  badRequest,
  failureResponse,
  getClientIp,
  ok,
  parseBody,
  rateLimit,
  tooManyRequests,
} from '../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await parseBody(request);

    // Honeypot: un campo oculto que solo un bot completa.
    if (asTrimmedString(body.website) !== '') return ok({ message: 'Formulario enviado correctamente.' });

    const ip = getClientIp(request);
    if (!rateLimit({ key: `contact:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 })) return tooManyRequests();

    const name = asTrimmedString(body.name);
    const email = asTrimmedString(body.email).toLowerCase();
    const message = asTrimmedString(body.message);
    const phone = asOptionalString(body.phone);
    const company = asOptionalString(body.company);

    if (!name || !email || !message) return badRequest('Nombre, email y mensaje son obligatorios');

    // Los topes van ANTES que el formato del email: no tiene sentido probar la expresión regular
    // sobre un texto de megabytes, y cada campo que se guarda queda acotado.
    const tooLong = findTooLongField({ name, email, phone, company, message });
    if (tooLong) return badRequest(tooLongMessage(tooLong));

    if (!EMAIL_REGEX.test(email)) return badRequest('Formato de email inválido');

    const formData = {
      name,
      email,
      message,
      phone,
      company,
      interest: normalizeInterest(body.interest),
      // El formulario manda la ruta real donde se completó. El referer sirve de
      // respaldo, pero se pierde si el navegador lo recorta por política. No la
      // escribe la persona: si es desmedida se recorta en vez de perder el lead.
      sourcePage: clip(asOptionalString(body.sourcePage) ?? request.headers.get('referer'), FIELD_LIMITS.sourcePage),
      ip,
      userAgent: request.headers.get('user-agent'),
    };

    const contact = await getLeadStore(locals).createContact(formData);

    // El mail es best-effort: el lead ya está persistido. `runInBackground` lo
    // deja terminar después de responder, que en una función serverless no
    // ocurre solo.
    runInBackground(locals, emailHelpers.sendContactFormNotification(formData));

    return ok({
      message: 'Formulario enviado correctamente. Te contactamos pronto.',
      id: contact.id,
    });
  } catch (error) {
    console.error('[api/contact] Error procesando formulario:', error);
    return failureResponse(error);
  }
};
