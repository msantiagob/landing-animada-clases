import { describe, expect, it, vi } from 'vitest';
import { LEAD_FORM_MESSAGES, buildLeadPayload, markBound, postJson } from '~/utils/forms';
import type { LeadFormValues, PostJsonMessages } from '~/utils/forms';

/**
 * Estos tests cubren la lógica que antes vivía enterrada en los <script> de
 * LeadForm y AppointmentBooking: la marca de "ya enlazado" que evita perder
 * leads tras una navegación suave, y el envío con sus mensajes de error.
 */

const MESSAGES: PostJsonMessages = { rejected: 'Rechazado por defecto', network: 'Sin conexión' };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('markBound', () => {
  it('marca un elemento nuevo y devuelve true', () => {
    const element = { dataset: {} as Record<string, string | undefined> };

    expect(markBound(element)).toBe(true);
    expect(element.dataset.bound).toBe('true');
  });

  // Es lo que hace seguro disparar la inicialización en cada `astro:page-load`.
  it('devuelve false si el elemento ya estaba enlazado, sin volver a tocarlo', () => {
    const element = { dataset: {} as Record<string, string | undefined> };

    expect(markBound(element)).toBe(true);
    expect(markBound(element)).toBe(false);
    expect(markBound(element)).toBe(false);
  });

  it('trata cada elemento por separado (un formulario en el hero y otro al pie)', () => {
    const hero = { dataset: {} as Record<string, string | undefined> };
    const footer = { dataset: {} as Record<string, string | undefined> };

    expect(markBound(hero)).toBe(true);
    expect(markBound(footer)).toBe(true);
    expect(markBound(hero)).toBe(false);
  });

  it('un DOM nuevo tras la navegación vuelve a enlazarse', () => {
    const before = { dataset: {} as Record<string, string | undefined> };
    markBound(before);

    // La navegación suave reemplaza el nodo: el nuevo no trae la marca.
    const after = { dataset: {} as Record<string, string | undefined> };

    expect(markBound(after)).toBe(true);
  });

  it('solo reconoce el valor "true"', () => {
    const element = { dataset: { bound: 'false' } as Record<string, string | undefined> };

    expect(markBound(element)).toBe(true);
    expect(element.dataset.bound).toBe('true');
  });
});

describe('postJson', () => {
  it('envía un POST con el cuerpo en JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }));

    await postJson('/api/contact', { name: 'Ana' }, MESSAGES, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Ana"}',
    });
  });

  it('devuelve ok y el cuerpo cuando la API responde success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: 'Listo', id: 7 }));

    const result = await postJson('/api/contact', {}, MESSAGES, fetchImpl);

    expect(result).toEqual({ ok: true, data: { success: true, message: 'Listo', id: 7 } });
  });

  // El backend explica el motivo en el cuerpo con 400, 409 y 429.
  it.each([
    [400, 'Formato de email inválido'],
    [409, 'Ese horario ya no está disponible.'],
    [429, 'Demasiados envíos.'],
  ])('muestra el motivo del servidor cuando responde %i', async (status, error) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false, error }, status));

    expect(await postJson('/api/contact', {}, MESSAGES, fetchImpl)).toEqual({ ok: false, error });
  });

  it('usa el mensaje genérico si el servidor rechaza sin dar motivo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false }, 500));

    expect(await postJson('/api/contact', {}, MESSAGES, fetchImpl)).toEqual({
      ok: false,
      error: 'Rechazado por defecto',
    });
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['un número', 500],
    ['un objeto', { code: 1 }],
  ])('descarta un motivo %s y usa el mensaje genérico', async (_caso, error) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false, error }));

    expect(await postJson('/api/contact', {}, MESSAGES, fetchImpl)).toEqual({
      ok: false,
      error: 'Rechazado por defecto',
    });
  });

  it('usa el mensaje genérico si el cuerpo no es JSON (por ejemplo, una página de error)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    expect(await postJson('/api/contact', {}, MESSAGES, fetchImpl)).toEqual({
      ok: false,
      error: 'Rechazado por defecto',
    });
  });

  it('no confía en el estado HTTP: un 200 sin success no cuenta como éxito', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: 'hola' }, 200));

    expect((await postJson('/api/contact', {}, MESSAGES, fetchImpl)).ok).toBe(false);
  });

  it('un cuerpo null no cuenta como éxito', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null));

    expect((await postJson('/api/contact', {}, MESSAGES, fetchImpl)).ok).toBe(false);
  });

  it('devuelve el mensaje de red, sin lanzar, cuando fetch falla', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await postJson('/api/contact', {}, MESSAGES, fetchImpl)).toEqual({ ok: false, error: 'Sin conexión' });
  });
});

describe('buildLeadPayload', () => {
  const values: LeadFormValues = {
    name: '  Ana Pérez ',
    email: ' ana@empresa.com ',
    phone: ' +57 300 123 4567 ',
    message: '  Necesito automatizar mi atención.  ',
    interest: 'automatizaciones',
    website: '',
  };

  it('arma el cuerpo que espera /api/contact', () => {
    expect(buildLeadPayload(values, '/automatizaciones')).toEqual({
      name: 'Ana Pérez',
      email: 'ana@empresa.com',
      phone: '+57 300 123 4567',
      message: 'Necesito automatizar mi atención.',
      interest: 'automatizaciones',
      website: '',
      sourcePage: '/automatizaciones',
    });
  });

  it('envía null en el teléfono opcional vacío', () => {
    expect(buildLeadPayload({ ...values, phone: '   ' }, '/').phone).toBeNull();
  });

  it('envía null cuando no se eligió un interés', () => {
    expect(buildLeadPayload({ ...values, interest: '' }, '/').interest).toBeNull();
  });

  it('conserva el honeypot para que el servidor descarte a los bots', () => {
    expect(buildLeadPayload({ ...values, website: 'http://spam.example' }, '/').website).toBe('http://spam.example');
  });

  it('registra la ruta donde se completó el formulario', () => {
    expect(buildLeadPayload(values, '/clases-de-python').sourcePage).toBe('/clases-de-python');
  });
});

describe('LEAD_FORM_MESSAGES', () => {
  it('están en español neutro con "tú", sin voseo', () => {
    const copy = Object.values(LEAD_FORM_MESSAGES).join(' ');

    expect(copy).not.toMatch(/\b(probá|revisá|intentá|contanos|podés|querés)\b/i);
    expect(LEAD_FORM_MESSAGES.rejected).toMatch(/Prueba/);
    expect(LEAD_FORM_MESSAGES.network).toMatch(/Revisa/);
  });
});
