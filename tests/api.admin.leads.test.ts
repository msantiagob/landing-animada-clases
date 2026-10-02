import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GET, PATCH } from '~/pages/api/admin/leads';
import { authHelpers } from '~/lib/auth';
import { SESSION_TTL_SECONDS } from '~/lib/session';
import { StorageUnavailableError, type AppointmentRecord, type ContactRecord, type LeadStore } from '~/lib/storage';
import { newId } from '~/lib/storage/ids';
import {
  TEST_ADMIN_EMAIL,
  adminCookie,
  configureAdminEnv,
  cookieHeader,
  createTestStore,
  jsonRequest,
  readJson,
  rejectedSessions,
  resetTestEnvironment,
  sessionClaims,
  signRawClaims,
  tomorrow,
} from './helpers';
import { findVoseo } from './voseo';

const ENDPOINT = 'https://sonmyd.co/api/admin/leads';

const get = (cookie?: string, query = '') =>
  GET({
    request: new Request(`${ENDPOINT}${query}`, { headers: cookie ? { Cookie: cookie } : {} }),
    url: new URL(`${ENDPOINT}${query}`),
  } as never);

const patch = (cookie: string | undefined, body: unknown) =>
  PATCH({
    request: jsonRequest(ENDPOINT, body, { method: 'PATCH', headers: cookie ? { Cookie: cookie } : {} }),
  } as never);

interface Seeded {
  contact: ContactRecord;
  appointment: AppointmentRecord;
}

/** Un contacto y una cita, ya guardados en el store. */
const seed = async (store: LeadStore): Promise<Seeded> => {
  const contact = await store.createContact({ name: 'Ana', email: 'ana@example.com', message: 'Hola' });
  const result = await store.createAppointment({
    name: 'Carlos',
    email: 'carlos@example.com',
    serviceType: 'Clases de IA',
    date: tomorrow(),
    time: '10:00',
  });

  if (!result.created) throw new Error('El horario de la semilla ya estaba ocupado');

  return { contact, appointment: result.appointment };
};

const seedContacts = async (store: LeadStore, count: number) => {
  for (let index = 0; index < count; index += 1) {
    await store.createContact({ name: `Lead ${index}`, email: `lead${index}@example.com`, message: 'Hola' });
  }
};

describe('Control de acceso a /api/admin/leads', () => {
  let store: LeadStore;
  let seeded: Seeded;

  beforeEach(async () => {
    store = createTestStore();
    await configureAdminEnv();
    seeded = await seed(store);
  });

  afterEach(resetTestEnvironment);

  it.each(rejectedSessions())('GET rechaza %s con 401 y no filtra ningún dato', async (_label, cookie) => {
    const response = await get(cookie);
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ success: false, error: 'No autorizado' });
    expect(JSON.stringify(payload)).not.toContain('ana@example.com');
  });

  it.each(rejectedSessions())('PATCH rechaza %s con 401 y no modifica nada', async (_label, cookie) => {
    const contact = await patch(cookie, { type: 'contact', id: seeded.contact.id, status: 'closed' });
    const appointment = await patch(cookie, { type: 'appointment', id: seeded.appointment.id, status: 'cancelled' });

    expect(contact.status).toBe(401);
    expect(appointment.status).toBe(401);
    expect((await store.listContacts())[0].status).toBe('new');
    expect((await store.listAppointments())[0].status).toBe('pending');
    // Cancelar libera el horario: tampoco puede haber pasado.
    expect(await store.getTakenSlots(seeded.appointment.date)).toEqual(['10:00']);
  });

  it('rechaza antes de tocar el store: una petición sin sesión no lee ni escribe nada', async () => {
    const reads = [vi.spyOn(store, 'listContacts'), vi.spyOn(store, 'listAppointments')];
    const writes = [vi.spyOn(store, 'updateContactStatus'), vi.spyOn(store, 'updateAppointmentStatus')];

    await get();
    await patch(undefined, { type: 'contact', id: seeded.contact.id, status: 'closed' });
    await patch(undefined, { type: 'appointment', id: seeded.appointment.id, status: 'cancelled' });

    [...reads, ...writes].forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  // Sin las tres variables de Netlify no hay forma de validar una sesión: nadie entra.
  it.each([
    ['ADMIN_EMAIL', { email: '' }],
    ['ADMIN_PASSWORD_HASH', { passwordHash: '' }],
    [
      'ADMIN_PASSWORD_HASH con el formato de otro algoritmo (bcrypt)',
      { passwordHash: '$2b$10$abcdefghijklmnopqrstuv' },
    ],
    ['SESSION_SECRET', { secret: '' }],
    ['SESSION_SECRET demasiado corto', { secret: 'corto' }],
  ])('con %s sin configurar, ni una sesión bien firmada abre el panel', async (_caso, missing) => {
    const cookie = adminCookie();
    await configureAdminEnv(missing);

    const read = await get(cookie);
    const write = await patch(cookie, { type: 'contact', id: seeded.contact.id, status: 'closed' });

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
    expect((await store.listContacts())[0].status).toBe('new');
  });

  it('una sesión firmada con el secreto anterior deja de valer al rotar SESSION_SECRET', async () => {
    const before = adminCookie();
    expect((await get(before)).status).toBe(200);

    await configureAdminEnv({ secret: 'secreto-rotado-de-al-menos-32-caracteres-xx' });

    expect((await get(before)).status).toBe(401);
  });

  it('el correo del administrador se compara sin importar mayúsculas ni espacios en ADMIN_EMAIL', async () => {
    await configureAdminEnv({ email: `  ${TEST_ADMIN_EMAIL.toUpperCase()} ` });

    expect((await get(adminCookie())).status).toBe(200);
  });

  it('una sesión válida entra aunque la petición lleve otras cookies', async () => {
    const token = adminCookie().slice('auth-token='.length);

    const response = await get(`theme=dark; auth-token=${token}; consent=1`);

    expect(response.status).toBe(200);
  });
});

describe('authHelpers.requireAdmin', () => {
  beforeEach(async () => {
    await configureAdminEnv();
  });

  afterEach(resetTestEnvironment);

  const requestWith = (cookie: string) => new Request(ENDPOINT, { headers: { Cookie: cookie } });

  it('rechaza una sesión con firma válida cuyo rol no es admin', () => {
    const cookie = cookieHeader(signRawClaims(sessionClaims({ role: 'editor' })));

    expect(authHelpers.requireAdmin(requestWith(cookie))).toBeNull();
  });

  it('acepta una sesión de admin y devuelve quién es y cuándo vence', () => {
    const before = Math.floor(Date.now() / 1000);

    const session = authHelpers.requireAdmin(requestWith(adminCookie()));

    expect(session).toEqual({ email: TEST_ADMIN_EMAIL, role: 'admin', exp: expect.any(Number) });
    expect(session?.exp).toBeGreaterThanOrEqual(before + SESSION_TTL_SECONDS);
    expect(session?.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  });

  it('lee la cookie correcta aunque vengan varias', () => {
    const token = adminCookie().slice('auth-token='.length);
    const request = requestWith(`theme=dark; auth-token=${token}; consent=1`);

    expect(authHelpers.requireAdmin(request)?.email).toBe(TEST_ADMIN_EMAIL);
  });

  it('ignora una cookie que se llama parecido a la de sesión', () => {
    const token = adminCookie().slice('auth-token='.length);

    expect(authHelpers.requireAdmin(requestWith(`x-auth-token=${token}`))).toBeNull();
  });
});

describe('GET /api/admin/leads (admin autenticado)', () => {
  let store: LeadStore;
  let seeded: Seeded;
  let cookie: string;

  beforeEach(async () => {
    store = createTestStore();
    await configureAdminEnv();
    seeded = await seed(store);
    cookie = adminCookie();
  });

  afterEach(resetTestEnvironment);

  it('devuelve leads, citas y estadísticas', async () => {
    const payload = await readJson(await get(cookie));

    expect(payload.success).toBe(true);
    expect(payload.contactForms).toHaveLength(1);
    expect(payload.appointments).toHaveLength(1);
    expect(payload.contactForms[0]).toMatchObject({
      id: seeded.contact.id,
      name: 'Ana',
      email: 'ana@example.com',
      status: 'new',
    });
    expect(payload.appointments[0]).toMatchObject({
      id: seeded.appointment.id,
      name: 'Carlos',
      service_type: 'Clases de IA',
      time: '10:00',
      status: 'pending',
    });
    expect(payload.stats).toEqual({
      contactForms: { total: 1, new: 1 },
      appointments: { total: 1, pending: 1 },
    });
  });

  it('con el store vacío devuelve listas vacías y las estadísticas en cero', async () => {
    createTestStore();

    const payload = await readJson(await get(cookie));

    expect(payload.success).toBe(true);
    expect(payload.contactForms).toEqual([]);
    expect(payload.appointments).toEqual([]);
    expect(payload.stats).toEqual({
      contactForms: { total: 0, new: 0 },
      appointments: { total: 0, pending: 0 },
    });
  });

  it('ordena los contactos del más nuevo al más antiguo y las citas por fecha y hora, la más lejana primero', async () => {
    await store.createContact({ name: 'Beto', email: 'beto@example.com', message: 'Segundo' });
    await store.createContact({ name: 'Carla', email: 'carla@example.com', message: 'Tercero' });
    await store.createAppointment({
      name: 'Dani',
      email: 'd@example.com',
      serviceType: 'Otro',
      date: tomorrow(),
      time: '15:00',
    });
    await store.createAppointment({
      name: 'Eva',
      email: 'e@example.com',
      serviceType: 'Otro',
      date: '2099-03-02',
      time: '09:00',
    });

    const payload = await readJson(await get(cookie));

    expect(payload.contactForms.map((row: ContactRecord) => row.name)).toEqual(['Carla', 'Beto', 'Ana']);
    expect(payload.appointments.map((row: AppointmentRecord) => row.name)).toEqual(['Eva', 'Dani', 'Carlos']);
  });

  it('las estadísticas cuentan solo los contactos "new" y las citas "pending"', async () => {
    await store.updateContactStatus(seeded.contact.id, 'contacted');
    await store.updateAppointmentStatus(seeded.appointment.id, 'confirmed');

    const payload = await readJson(await get(cookie));

    expect(payload.stats).toEqual({
      contactForms: { total: 1, new: 0 },
      appointments: { total: 1, pending: 0 },
    });
  });

  describe('paginación', () => {
    beforeEach(async () => {
      await seedContacts(store, 204); // con el "Ana" de la semilla son 205
    });

    it('sin parámetros devuelve 50 por defecto, y las estadísticas son de TODOS los leads', async () => {
      const payload = await readJson(await get(cookie));

      expect(payload.contactForms).toHaveLength(50);
      expect(payload.stats.contactForms.total).toBe(205);
    });

    it('respeta limit y offset, y los aplica a contactos y a citas', async () => {
      const page = await readJson(await get(cookie, '?limit=2&offset=1'));

      expect(page.contactForms.map((row: ContactRecord) => row.name)).toEqual(['Lead 202', 'Lead 201']);
      // Hay una sola cita: el offset 1 la deja fuera.
      expect(page.appointments).toEqual([]);
      expect(page.stats.appointments.total).toBe(1);
    });

    it('topea el limit en 200 para que nadie se traiga todo el store de una vez', async () => {
      const payload = await readJson(await get(cookie, '?limit=99999'));

      expect(payload.contactForms).toHaveLength(200);
      expect(payload.stats.contactForms.total).toBe(205);
    });

    it('la última página trae solo lo que queda', async () => {
      const payload = await readJson(await get(cookie, '?limit=10&offset=200'));

      expect(payload.contactForms.map((row: ContactRecord) => row.name)).toEqual([
        'Lead 3',
        'Lead 2',
        'Lead 1',
        'Lead 0',
        'Ana',
      ]);
    });

    it('un offset más allá del final devuelve la lista vacía y las estadísticas intactas', async () => {
      const payload = await readJson(await get(cookie, '?offset=5000'));

      expect(payload.success).toBe(true);
      expect(payload.contactForms).toEqual([]);
      expect(payload.stats.contactForms.total).toBe(205);
    });

    it.each([
      ['un limit que no es un número', '?limit=abc&offset=-5'],
      ['un limit en cero', '?limit=0'],
      ['un limit negativo', '?limit=-5'],
      ['un offset negativo', '?offset=-5'],
    ])('ignora %s en vez de romper o devolver de más', async (_caso, query) => {
      const payload = await readJson(await get(cookie, query));

      expect(payload.success).toBe(true);
      expect(payload.contactForms).toHaveLength(50);
      expect(payload.contactForms[0].name).toBe('Lead 203');
    });
  });

  describe('cuando el almacenamiento falla', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('devuelve 500 genérico, sin filtrar el error del store, ante un fallo inesperado', async () => {
      vi.spyOn(store, 'listContacts').mockRejectedValue(new Error('EIO: i/o error, read /var/task/contact'));

      const response = await get(cookie);
      const payload = await readJson(response);

      expect(response.status).toBe(500);
      expect(JSON.stringify(payload)).not.toMatch(/EIO|\/var\/task/);
      expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(consoleError).toHaveBeenCalledWith('[api/admin/leads] Error obteniendo leads:', expect.any(Error));
    });

    it('devuelve 503 reintentable, sin datos parciales, si Netlify Blobs no responde', async () => {
      vi.spyOn(store, 'listAppointments').mockRejectedValue(
        new StorageUnavailableError('Netlify Blobs falló al listar appointment/')
      );

      const response = await get(cookie);
      const payload = await readJson(response);

      expect(response.status).toBe(503);
      expect(payload.error).toBe('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(payload.contactForms).toBeUndefined();
      expect(JSON.stringify(payload)).not.toContain('Blobs');
    });
  });
});

describe('PATCH /api/admin/leads (admin autenticado)', () => {
  let store: LeadStore;
  let seeded: Seeded;
  let cookie: string;
  let now: Date;

  beforeEach(async () => {
    now = new Date('2026-10-01T12:00:00.000Z');
    store = createTestStore({ now: () => now });
    await configureAdminEnv();
    seeded = await seed(store);
    cookie = adminCookie();
  });

  afterEach(resetTestEnvironment);

  const contactStatus = async () => (await store.listContacts())[0].status;
  const appointmentStatus = async () => (await store.listAppointments())[0].status;

  it('cambia el estado de un contacto y registra cuándo, sin tocar created_at', async () => {
    now = new Date('2026-10-01T12:05:00.000Z');

    const response = await patch(cookie, { type: 'contact', id: seeded.contact.id, status: 'contacted' });

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ success: true, id: seeded.contact.id, status: 'contacted' });

    const [saved] = await store.listContacts();
    expect(saved.status).toBe('contacted');
    expect(saved.created_at).toBe('2026-10-01T12:00:00.000Z');
    expect(saved.updated_at).toBe('2026-10-01T12:05:00.000Z');
  });

  it('cambia el estado de una cita', async () => {
    const response = await patch(cookie, { type: 'appointment', id: seeded.appointment.id, status: 'confirmed' });

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ success: true, id: seeded.appointment.id, status: 'confirmed' });
    expect(await appointmentStatus()).toBe('confirmed');
  });

  it.each(['new', 'contacted', 'closed'])('acepta el estado "%s" para un contacto', async (status) => {
    expect((await patch(cookie, { type: 'contact', id: seeded.contact.id, status })).status).toBe(200);
    expect(await contactStatus()).toBe(status);
  });

  it.each(['pending', 'confirmed', 'cancelled', 'completed'])('acepta el estado "%s" para una cita', async (status) => {
    expect((await patch(cookie, { type: 'appointment', id: seeded.appointment.id, status })).status).toBe(200);
    expect(await appointmentStatus()).toBe(status);
  });

  it('solo cambia el registro pedido: los demás quedan como estaban', async () => {
    const second = await store.createContact({ name: 'Beto', email: 'beto@example.com', message: 'Segundo' });

    await patch(cookie, { type: 'contact', id: second.id, status: 'closed' });

    const byName = Object.fromEntries((await store.listContacts()).map((row) => [row.name, row.status]));
    expect(byName).toEqual({ Ana: 'new', Beto: 'closed' });
  });

  it.each([
    ['una inyección SQL', "'; DROP TABLE users; --"],
    ['otra capitalización', 'CLOSED'],
    ['un estado vacío', ''],
    ['un nombre de propiedad de Object', 'constructor'],
  ])('rechaza un estado de contacto fuera de la lista blanca: %s', async (_caso, status) => {
    const response = await patch(cookie, { type: 'contact', id: seeded.contact.id, status });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toBe('Estado inválido para un contacto');
    expect(await contactStatus()).toBe('new');
  });

  it('rechaza una petición sin estado', async () => {
    const response = await patch(cookie, { type: 'contact', id: seeded.contact.id });

    expect(response.status).toBe(400);
    expect(await contactStatus()).toBe('new');
  });

  it('no deja usar un estado de cita en un contacto, ni uno de contacto en una cita', async () => {
    const contact = await patch(cookie, { type: 'contact', id: seeded.contact.id, status: 'confirmed' });
    const appointment = await patch(cookie, { type: 'appointment', id: seeded.appointment.id, status: 'closed' });

    expect(contact.status).toBe(400);
    expect(appointment.status).toBe(400);
    expect(await contactStatus()).toBe('new');
    expect(await appointmentStatus()).toBe('pending');
  });

  it('rechaza un tipo desconocido', async () => {
    const response = await patch(cookie, { type: 'usuarios', id: seeded.contact.id, status: 'new' });

    expect(response.status).toBe(400);
  });

  it.each([
    ['un texto cualquiera', 'abc'],
    ['un número, como eran los ids anteriores', 1],
    ['cero', 0],
    ['un negativo', -3],
    ['un texto vacío', ''],
    ['un id en minúsculas', '01arz3ndektsv4rrffq69g5fav'],
    ['un id con un carácter de menos', '01ARZ3NDEKTSV4RRFFQ69G5FA'],
    ['un id con un carácter de más', '01ARZ3NDEKTSV4RRFFQ69G5FAVV'],
    ['un id con una letra que Crockford excluye (U)', '01ARZ3NDEKTSV4RRFFQ69G5FAU'],
    ['una clave del store en vez de un id', 'contact/01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    ['un recorrido de rutas', '../appointment/01ARZ3NDEKTSV4RRFFQ69G5F'],
    ['una inyección SQL', '1; DROP TABLE contact_forms'],
  ])('rechaza con 400 un id inválido: %s', async (_caso, id) => {
    const response = await patch(cookie, { type: 'contact', id, status: 'closed' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toBe('Id inválido');
    expect(await contactStatus()).toBe('new');
  });

  // Un cuerpo ilegible es un error del cliente: 400, nada modificado y sin 500.
  it.each([
    ['un JSON roto', '{"type": "contact", ', 'application/json'],
    ['un JSON vacío', '', 'application/json'],
    ['un JSON que no es un objeto', 'null', 'application/json'],
    ['un Content-Type desconocido', 'type=contact', 'text/plain'],
  ])('responde 400, y no 500, ante %s', async (_caso, body, contentType) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await PATCH({
      request: new Request(ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': contentType, Cookie: cookie },
        body,
      }),
    } as never);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toBe('Id inválido');
    expect(await contactStatus()).toBe('new');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el registro no existe', async () => {
    const contact = await patch(cookie, { type: 'contact', id: newId(), status: 'closed' });
    const appointment = await patch(cookie, { type: 'appointment', id: newId(), status: 'confirmed' });

    expect(contact.status).toBe(404);
    expect(appointment.status).toBe(404);
  });

  it('un id de contacto no sirve para una cita, ni al revés', async () => {
    const asAppointment = await patch(cookie, { type: 'appointment', id: seeded.contact.id, status: 'confirmed' });
    const asContact = await patch(cookie, { type: 'contact', id: seeded.appointment.id, status: 'closed' });

    expect(asAppointment.status).toBe(404);
    expect(asContact.status).toBe(404);
    expect(await contactStatus()).toBe('new');
    expect(await appointmentStatus()).toBe('pending');
  });

  // El panel pinta `error` tal cual: cada motivo es copy y tiene que estar en
  // español de Colombia con "tú" ("usa", no "usá").
  it.each<[string, (seeded: Seeded) => unknown, number, string]>([
    ['un id inválido', () => ({ type: 'contact', id: 'abc', status: 'closed' }), 400, 'Id inválido'],
    [
      'un estado de cita en un contacto',
      (s) => ({ type: 'contact', id: s.contact.id, status: 'confirmed' }),
      400,
      'Estado inválido para un contacto',
    ],
    [
      'un estado de contacto en una cita',
      (s) => ({ type: 'appointment', id: s.appointment.id, status: 'new' }),
      400,
      'Estado inválido para una cita',
    ],
    [
      'un contacto que no existe',
      () => ({ type: 'contact', id: newId(), status: 'closed' }),
      404,
      'Contacto no encontrado',
    ],
    [
      'una cita que no existe',
      () => ({ type: 'appointment', id: newId(), status: 'confirmed' }),
      404,
      'Cita no encontrada',
    ],
    [
      'un tipo desconocido',
      (s) => ({ type: 'usuarios', id: s.contact.id, status: 'new' }),
      400,
      'Tipo inválido: usa "contact" o "appointment"',
    ],
  ])('responde con el motivo exacto ante %s y sin voseo', async (_caso, body, status, motivo) => {
    const response = await patch(cookie, body(seeded));
    const { error } = await readJson(response);

    expect(response.status).toBe(status);
    expect(error).toBe(motivo);
    expect(findVoseo(error)).toEqual([]);
  });

  describe('al cambiar el estado de una cita, su horario se libera o se vuelve a reservar', () => {
    const cancel = () => patch(cookie, { type: 'appointment', id: seeded.appointment.id, status: 'cancelled' });
    const reactivate = () => patch(cookie, { type: 'appointment', id: seeded.appointment.id, status: 'pending' });

    /** Otra persona reserva el mismo horario que la cita de la semilla. */
    const bookSameSlot = async () => {
      const { date, time } = seeded.appointment;
      const result = await store.createAppointment({
        name: 'Otra persona',
        email: 'otra@example.com',
        serviceType: 'Otro',
        date,
        time,
      });

      return result;
    };

    it('cancelar libera el horario para que otra persona lo reserve', async () => {
      const response = await cancel();

      expect(response.status).toBe(200);
      expect(await store.getTakenSlots(seeded.appointment.date)).toEqual([]);
      expect((await bookSameSlot()).created).toBe(true);
    });

    it.each(['confirmed', 'completed'])('pasar la cita a "%s" NO libera su horario', async (status) => {
      await patch(cookie, { type: 'appointment', id: seeded.appointment.id, status });

      expect(await store.getTakenSlots(seeded.appointment.date)).toEqual(['10:00']);
      expect((await bookSameSlot()).created).toBe(false);
    });

    it('reactivar una cita cancelada vuelve a ocupar su horario', async () => {
      await cancel();

      const response = await reactivate();

      expect(response.status).toBe(200);
      expect(await appointmentStatus()).toBe('pending');
      expect(await store.getTakenSlots(seeded.appointment.date)).toEqual(['10:00']);
      expect((await bookSameSlot()).created).toBe(false);
    });

    it('reactivar una cita cuyo horario ya tomó otra responde 409 y no la reactiva', async () => {
      await cancel();
      const other = await bookSameSlot();
      if (!other.created) throw new Error('El horario liberado debía poder reservarse');

      const response = await reactivate();
      const { error } = await readJson(response);

      expect(response.status).toBe(409);
      expect(error).toBe('Ese horario ya lo tomó otra cita, así que esta no se puede reactivar.');
      expect(findVoseo(error)).toEqual([]);

      const statuses = Object.fromEntries((await store.listAppointments()).map((row) => [row.id, row.status]));
      expect(statuses).toEqual({ [seeded.appointment.id]: 'cancelled', [other.appointment.id]: 'pending' });
      expect(await store.getTakenSlots(seeded.appointment.date)).toEqual(['10:00']);
    });

    it('cancelar una cita ya cancelada no libera el horario que otra persona tomó entre medio', async () => {
      await cancel();
      const other = await bookSameSlot();
      expect(other.created).toBe(true);

      const again = await cancel();

      expect(again.status).toBe(200);
      expect(await store.getTakenSlots(seeded.appointment.date)).toEqual(['10:00']);
      expect((await bookSameSlot()).created).toBe(false);
    });
  });

  describe('cuando el almacenamiento falla', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('un 500 no filtra el error del store y le pide reintentar con "tú"', async () => {
      vi.spyOn(store, 'updateContactStatus').mockRejectedValue(new Error('EIO: i/o error, write /var/task/contact'));

      const response = await patch(cookie, { type: 'contact', id: seeded.contact.id, status: 'closed' });
      const { error } = await readJson(response);

      expect(response.status).toBe(500);
      expect(error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(findVoseo(error)).toEqual([]);
      expect(error).not.toMatch(/EIO|\/var\/task/);
      expect(consoleError).toHaveBeenCalledWith('[api/admin/leads] Error actualizando estado:', expect.any(Error));
    });

    it.each([
      ['un contacto', 'updateContactStatus', () => ({ type: 'contact', id: seeded.contact.id, status: 'closed' })],
      [
        'una cita',
        'updateAppointmentStatus',
        () => ({ type: 'appointment', id: seeded.appointment.id, status: 'confirmed' }),
      ],
    ] as const)(
      'devuelve 503 reintentable, sin filtrar el fallo de Blobs, al actualizar %s',
      async (_caso, method, body) => {
        vi.spyOn(store, method).mockRejectedValue(
          new StorageUnavailableError('Netlify Blobs falló al escribir contact/')
        );

        const response = await patch(cookie, body());
        const { error } = await readJson(response);

        expect(response.status).toBe(503);
        expect(error).toBe('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');
        expect(findVoseo(error)).toEqual([]);
        expect(error).not.toContain('Blobs');
      }
    );
  });
});
