import type { APIRoute } from 'astro';
import { authHelpers } from '../../../lib/auth';
import { getLeadStore, isAppointmentStatus, isContactStatus, summarizeLeads } from '../../../lib/storage';
import { isValidId } from '../../../lib/storage/ids';
import {
  asTrimmedString,
  badRequest,
  conflict,
  failureResponse,
  json,
  ok,
  parseBody,
  unauthorized,
} from '../../../lib/http';

export const prerender = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Única pantalla de administración: leads de contacto + citas agendadas. */
export const GET: APIRoute = async ({ request, url, locals }) => {
  try {
    if (!authHelpers.requireAdmin(request)) return unauthorized();

    // Todo lo que no sea un entero positivo (texto, 0, negativos) vuelve al valor por defecto: un
    // `limit` negativo llegaba intacto a `slice(0, -n)` y devolvía casi todo, saltándose el tope.
    const requested = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit = requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    // Las estadísticas son de TODOS los leads, no de la página que se pide: por
    // eso se lee la lista completa y se recorta después. Cuesta una lectura por
    // lead; para el volumen de este sitio (decenas al mes) es despreciable.
    const store = getLeadStore(locals);
    const [contacts, appointments] = await Promise.all([store.listContacts(), store.listAppointments()]);

    return ok({
      stats: summarizeLeads(contacts, appointments),
      contactForms: contacts.slice(offset, offset + limit),
      appointments: appointments.slice(offset, offset + limit),
    });
  } catch (error) {
    console.error('[api/admin/leads] Error obteniendo leads:', error);
    return failureResponse(error);
  }
};

/** Cambia el estado de un lead o de una cita. */
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    if (!authHelpers.requireAdmin(request)) return unauthorized();

    const body = await parseBody(request);
    const type = asTrimmedString(body.type);
    const status = asTrimmedString(body.status);
    const id = asTrimmedString(body.id);

    if (!isValidId(id)) return badRequest('Id inválido');

    const store = getLeadStore(locals);

    if (type === 'contact') {
      if (!isContactStatus(status)) return badRequest('Estado inválido para un contacto');

      const updated = await store.updateContactStatus(id, status);
      if (!updated) return json({ success: false, error: 'Contacto no encontrado' }, 404);

      return ok({ id, status });
    }

    if (type === 'appointment') {
      if (!isAppointmentStatus(status)) return badRequest('Estado inválido para una cita');

      const result = await store.updateAppointmentStatus(id, status);

      if (result.outcome === 'not-found') return json({ success: false, error: 'Cita no encontrada' }, 404);
      if (result.outcome === 'slot-taken') {
        return conflict('Ese horario ya lo tomó otra cita, así que esta no se puede reactivar.');
      }

      return ok({ id, status });
    }

    return badRequest('Tipo inválido: usa "contact" o "appointment"');
  } catch (error) {
    console.error('[api/admin/leads] Error actualizando estado:', error);
    return failureResponse(error);
  }
};
