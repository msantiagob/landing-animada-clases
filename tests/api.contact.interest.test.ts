import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '~/pages/api/contact';
import { emailHelpers } from '~/lib/email';
import { INTERESTS } from '~/lib/interests';
import type { LeadStore } from '~/lib/storage';
import { createTestStore, jsonRequest, readJson, resetTestEnvironment } from './helpers';

const ENDPOINT = 'https://sonmyd.co/api/contact';

const base = {
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  message: 'Necesito habilitar la API de WhatsApp para mi empresa.',
};

const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

describe('POST /api/contact — campo de interés', () => {
  let store: LeadStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(resetTestEnvironment);

  const savedInterest = async () => (await store.listContacts())[0].interest;

  it('persiste un interés válido', async () => {
    const response = await call({ ...base, interest: 'whatsapp-business-api' });
    expect(response.status).toBe(200);

    const [lead] = await store.listContacts();
    expect(lead.interest).toBe('whatsapp-business-api');
  });

  // El catálogo sale del registro de landings: el formulario ofrece cada opción,
  // la API tiene que aceptarla tal cual y el panel mostrarla.
  it.each(INTERESTS.map((interest) => interest.value))(
    'persiste el interés "%s" que ofrece el formulario',
    async (value) => {
      expect((await call({ ...base, interest: value })).status).toBe(200);
      expect(await savedInterest()).toBe(value);
    }
  );

  // Un interés inválido NO puede costarnos el lead: se guarda como null.
  it('acepta el lead y guarda null cuando el interés es desconocido', async () => {
    const response = await call({ ...base, interest: 'algo-que-no-existe' });
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(await savedInterest()).toBeNull();
    expect(emailHelpers.sendContactFormNotification).toHaveBeenCalledWith(expect.objectContaining({ interest: null }));
  });

  it('guarda null (y el campo existe en el registro) cuando no se manda interés', async () => {
    await call(base);

    const [lead] = await store.listContacts();
    expect(lead).toHaveProperty('interest', null);
  });

  // La lista blanca es lo único que decide qué texto llega al registro: nada de
  // lo que mande el cliente se guarda en este campo.
  it.each([
    ['una inyección SQL', "'; DROP TABLE contact_forms; --"],
    ['una ruta de clave del store', '../appointment/01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    ['HTML', '<script>alert(1)</script>'],
    ['un slug con otra capitalización', 'WhatsApp-Business-API'],
    ['un texto vacío', ''],
  ])('no permite guardar texto arbitrario en el campo: %s', async (_caso, interest) => {
    const response = await call({ ...base, interest });

    expect(response.status).toBe(200);
    expect(await savedInterest()).toBeNull();
    // El lead entró completo y el store sigue consistente.
    expect(await store.listContacts()).toHaveLength(1);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it('ignora un interés que no sea texto', async () => {
    await call({ ...base, interest: { value: 'ciberseguridad' } });
    expect(await savedInterest()).toBeNull();

    await call({ ...base, interest: ['ciberseguridad'] });
    expect((await store.listContacts()).every((lead) => lead.interest === null)).toBe(true);
  });
});

describe('POST /api/contact — página de origen', () => {
  let store: LeadStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(resetTestEnvironment);

  const savedSourcePage = async () => (await store.listContacts())[0].source_page;

  it('usa la ruta que manda el formulario', async () => {
    await call({ ...base, sourcePage: '/ciberseguridad' }, { referer: 'https://sonmyd.co/otra' });
    expect(await savedSourcePage()).toBe('/ciberseguridad');
  });

  // El referer se pierde con ciertas políticas del navegador; por eso el
  // formulario manda la ruta, y el header queda solo como respaldo.
  it('cae al referer cuando el formulario no manda la ruta', async () => {
    await call(base, { referer: 'https://sonmyd.co/clases-de-python' });
    expect(await savedSourcePage()).toBe('https://sonmyd.co/clases-de-python');
  });

  it('cae al referer cuando la ruta del formulario viene vacía', async () => {
    await call({ ...base, sourcePage: '   ' }, { referer: 'https://sonmyd.co/clases-de-python' });
    expect(await savedSourcePage()).toBe('https://sonmyd.co/clases-de-python');
  });

  it('guarda null cuando no hay ninguno de los dos', async () => {
    await call(base);
    expect(await savedSourcePage()).toBeNull();
  });
});
