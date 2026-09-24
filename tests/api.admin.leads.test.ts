import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from '~/pages/api/admin/leads';
import { authHelpers } from '~/lib/auth';
import { dbHelpers } from '~/lib/database';
import { closeTestDb, createTestDb, jsonRequest, readJson, sessionCookieFor, tomorrow } from './helpers';

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

const seed = () => {
  dbHelpers.insertContactForm({ name: 'Ana', email: 'ana@example.com', message: 'Hola' });
  dbHelpers.insertAppointment({
    name: 'Carlos',
    email: 'carlos@example.com',
    serviceType: 'Clases de IA',
    date: tomorrow(),
    time: '10:00',
  });
};

describe('Control de acceso a /api/admin/leads', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    seed();
  });

  afterEach(() => closeTestDb(db));

  it('GET sin cookie devuelve 401 y no filtra ningún dato', async () => {
    const response = await get();
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload.contactForms).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('ana@example.com');
  });

  it('GET con un token inválido devuelve 401', async () => {
    expect((await get('auth-token=basura')).status).toBe(401);
  });

  it('GET con un token expirado devuelve 401', async () => {
    const expired = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYUBiLmMiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjF9.no-vale';

    expect((await get(`auth-token=${expired}`)).status).toBe(401);
  });

  it('GET con un usuario de rol NO admin devuelve 401', async () => {
    const editorCookie = await sessionCookieFor('editor');

    const response = await get(editorCookie);

    expect(response.status).toBe(401);
    expect(JSON.stringify(await readJson(response))).not.toContain('ana@example.com');
  });

  it('PATCH sin cookie devuelve 401 y no modifica nada', async () => {
    const response = await patch(undefined, { type: 'contact', id: 1, status: 'closed' });

    expect(response.status).toBe(401);
    expect(dbHelpers.getContactForms()[0].status).toBe('new');
  });

  it('PATCH con rol NO admin devuelve 401 y no modifica nada', async () => {
    const editorCookie = await sessionCookieFor('editor');

    const response = await patch(editorCookie, { type: 'contact', id: 1, status: 'closed' });

    expect(response.status).toBe(401);
    expect(dbHelpers.getContactForms()[0].status).toBe('new');
  });
});

describe('GET /api/admin/leads (admin autenticado)', () => {
  let db: Database.Database;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    seed();
    cookie = await sessionCookieFor('admin');
  });

  afterEach(() => closeTestDb(db));

  it('devuelve leads, citas y estadísticas', async () => {
    const payload = await readJson(await get(cookie));

    expect(payload.success).toBe(true);
    expect(payload.contactForms).toHaveLength(1);
    expect(payload.appointments).toHaveLength(1);
    expect(payload.stats).toEqual({
      contactForms: { total: 1, new: 1 },
      appointments: { total: 1, pending: 1 },
    });
  });

  it('respeta limit y offset', async () => {
    dbHelpers.insertContactForm({ name: 'Beto', email: 'beto@example.com', message: 'Segundo' });

    const page = await readJson(await get(cookie, '?limit=1&offset=0'));

    expect(page.contactForms).toHaveLength(1);
    expect(page.stats.contactForms.total).toBe(2);
  });

  it('topea el limit para que nadie se traiga la base entera', async () => {
    const payload = await readJson(await get(cookie, '?limit=99999'));

    expect(payload.success).toBe(true);
    expect(payload.contactForms.length).toBeLessThanOrEqual(200);
  });

  it('ignora limit y offset basura en vez de romper', async () => {
    const payload = await readJson(await get(cookie, '?limit=abc&offset=-5'));

    expect(payload.success).toBe(true);
    expect(payload.contactForms).toHaveLength(1);
  });

  it('devuelve 500 genérico si la base falla', async () => {
    vi.spyOn(dbHelpers, 'getStats').mockImplementation(() => {
      throw new Error('database is locked');
    });

    const response = await get(cookie);

    expect(response.status).toBe(500);
    expect(JSON.stringify(await readJson(response))).not.toContain('database is locked');
  });
});

describe('PATCH /api/admin/leads (admin autenticado)', () => {
  let db: Database.Database;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    seed();
    cookie = await sessionCookieFor('admin');
  });

  afterEach(() => closeTestDb(db));

  it('cambia el estado de un contacto', async () => {
    const response = await patch(cookie, { type: 'contact', id: 1, status: 'contacted' });

    expect(response.status).toBe(200);
    expect(dbHelpers.getContactForms()[0].status).toBe('contacted');
  });

  it('cambia el estado de una cita', async () => {
    const response = await patch(cookie, { type: 'appointment', id: 1, status: 'confirmed' });

    expect(response.status).toBe(200);
    expect(dbHelpers.getAppointments()[0].status).toBe('confirmed');
  });

  it('rechaza estados que no están en la lista blanca', async () => {
    const response = await patch(cookie, { type: 'contact', id: 1, status: 'DROP TABLE users' });

    expect(response.status).toBe(400);
    expect(dbHelpers.getContactForms()[0].status).toBe('new');
  });

  it('no deja usar un estado de cita en un contacto', async () => {
    const response = await patch(cookie, { type: 'contact', id: 1, status: 'confirmed' });

    expect(response.status).toBe(400);
  });

  it('rechaza un tipo desconocido', async () => {
    expect((await patch(cookie, { type: 'usuarios', id: 1, status: 'new' })).status).toBe(400);
  });

  it('rechaza ids inválidos', async () => {
    expect((await patch(cookie, { type: 'contact', id: 'abc', status: 'closed' })).status).toBe(400);
    expect((await patch(cookie, { type: 'contact', id: 0, status: 'closed' })).status).toBe(400);
    expect((await patch(cookie, { type: 'contact', id: -3, status: 'closed' })).status).toBe(400);
  });

  it('devuelve 404 si el registro no existe', async () => {
    const response = await patch(cookie, { type: 'contact', id: 4242, status: 'closed' });

    expect(response.status).toBe(404);
  });
});

describe('authHelpers.requireAdmin', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => closeTestDb(db));

  it('rechaza un token válido cuyo rol no es admin', () => {
    const token = authHelpers.generateToken({ userId: 1, email: 'editor@sonmyd.test', role: 'editor' });
    const request = new Request(ENDPOINT, { headers: { Cookie: `auth-token=${token}` } });

    expect(authHelpers.requireAdmin(request)).toBeNull();
  });

  it('acepta un token de admin', () => {
    const token = authHelpers.generateToken({ userId: 1, email: 'admin@sonmyd.test', role: 'admin' });
    const request = new Request(ENDPOINT, { headers: { Cookie: `auth-token=${token}` } });

    expect(authHelpers.requireAdmin(request)?.role).toBe('admin');
  });

  it('lee la cookie correcta aunque vengan varias', () => {
    const token = authHelpers.generateToken({ userId: 1, email: 'admin@sonmyd.test', role: 'admin' });
    const request = new Request(ENDPOINT, {
      headers: { Cookie: `theme=dark; auth-token=${token}; consent=1` },
    });

    expect(authHelpers.requireAdmin(request)?.userId).toBe(1);
  });
});
