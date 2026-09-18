import type { APIRoute } from 'astro';
import { authHelpers } from '../../../lib/auth';
import { dbHelpers } from '../../../lib/database';
import { asTrimmedString, badRequest, json, ok, parseBody, serverError, unauthorized } from '../../../lib/http';

export const prerender = false;

const CONTACT_STATUSES = new Set(['new', 'contacted', 'closed']);
const APPOINTMENT_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed']);
const MAX_LIMIT = 200;

/** Única pantalla de administración: leads de contacto + citas agendadas. */
export const GET: APIRoute = async ({ request, url }) => {
  try {
    if (!authHelpers.requireAdmin(request)) return unauthorized();

    const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, MAX_LIMIT);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    return ok({
      stats: dbHelpers.getStats(),
      contactForms: dbHelpers.getContactForms(limit, offset),
      appointments: dbHelpers.getAppointments(limit, offset),
    });
  } catch (error) {
    console.error('[api/admin/leads] Error obteniendo leads:', error);
    return serverError();
  }
};

/** Cambia el estado de un lead o de una cita. */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    if (!authHelpers.requireAdmin(request)) return unauthorized();

    const body = await parseBody(request);
    const type = asTrimmedString(body.type);
    const status = asTrimmedString(body.status);
    const id = Number.parseInt(asTrimmedString(body.id) || String(body.id ?? ''), 10);

    if (!Number.isInteger(id) || id <= 0) return badRequest('Id inválido');

    if (type === 'contact') {
      if (!CONTACT_STATUSES.has(status)) return badRequest('Estado inválido para un contacto');

      const result = dbHelpers.updateContactFormStatus(id, status);
      if (result.changes === 0) return json({ success: false, error: 'Contacto no encontrado' }, 404);

      return ok({ id, status });
    }

    if (type === 'appointment') {
      if (!APPOINTMENT_STATUSES.has(status)) return badRequest('Estado inválido para una cita');

      const result = dbHelpers.updateAppointmentStatus(id, status);
      if (result.changes === 0) return json({ success: false, error: 'Cita no encontrada' }, 404);

      return ok({ id, status });
    }

    return badRequest('Tipo inválido: usá "contact" o "appointment"');
  } catch (error) {
    console.error('[api/admin/leads] Error actualizando estado:', error);
    return serverError();
  }
};
