import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '~/pages/api/auth';
import { authHelpers } from '~/lib/auth';
import { closeTestDb, createTestDb, jsonRequest, readJson } from './helpers';

const ENDPOINT = 'https://sonmyd.co/api/auth';
const PASSWORD = 'una-password-larga-123';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

describe('POST /api/auth', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = createTestDb();
    await authHelpers.createUser('admin@sonmyd.test', PASSWORD, 'Admin');
  });

  afterEach(() => closeTestDb(db));

  it('loguea con credenciales válidas y setea la cookie httpOnly', async () => {
    const response = await post({ action: 'login', email: 'admin@sonmyd.test', password: PASSWORD });
    const payload = await readJson(response);
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(payload.user.email).toBe('admin@sonmyd.test');
    expect(cookie).toContain('auth-token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('nunca devuelve el token ni el hash de la contraseña en el body', async () => {
    const payload = await readJson(await post({ action: 'login', email: 'admin@sonmyd.test', password: PASSWORD }));

    expect(payload.token).toBeUndefined();
    expect(payload.user.password).toBeUndefined();
  });

  it('normaliza el email: mayúsculas y espacios no rompen el login', async () => {
    const response = await post({ action: 'login', email: '  ADMIN@SONMYD.TEST ', password: PASSWORD });

    expect(response.status).toBe(200);
  });

  it('devuelve 401 con contraseña incorrecta', async () => {
    const response = await post({ action: 'login', email: 'admin@sonmyd.test', password: 'incorrecta' });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('devuelve 401 con un usuario inexistente, con el mismo mensaje que una password mala', async () => {
    const unknown = await readJson(await post({ action: 'login', email: 'nadie@sonmyd.test', password: PASSWORD }));
    const wrong = await readJson(await post({ action: 'login', email: 'admin@sonmyd.test', password: 'x' }));

    // No debe filtrar qué emails existen.
    expect(unknown.error).toBe(wrong.error);
  });

  it('exige email y contraseña', async () => {
    expect((await post({ action: 'login', email: 'admin@sonmyd.test' })).status).toBe(400);
    expect((await post({ action: 'login', password: PASSWORD })).status).toBe(400);
  });

  it('NO expone registro público: la acción register ya no existe', async () => {
    const response = await post({
      action: 'register',
      email: 'atacante@evil.test',
      password: 'password-larga-123',
      name: 'Atacante',
    });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/no válida/i);
    expect(authHelpers.getUserByEmail('atacante@evil.test')).toBeNull();
  });

  it('rechaza cualquier acción desconocida', async () => {
    expect((await post({ action: 'promote' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it('el logout limpia la cookie', async () => {
    const response = await post({ action: 'logout' });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('frena la fuerza bruta tras 8 intentos desde la misma IP', async () => {
    const headers = { 'x-forwarded-for': '192.0.2.50' };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect((await post({ action: 'login', email: 'admin@sonmyd.test', password: 'mala' }, headers)).status).toBe(401);
    }

    const blocked = await post({ action: 'login', email: 'admin@sonmyd.test', password: PASSWORD }, headers);

    expect(blocked.status).toBe(429);
  });
});

describe('GET /api/auth (sesión actual)', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = createTestDb();
    await authHelpers.createUser('admin@sonmyd.test', PASSWORD, 'Admin');
  });

  afterEach(() => closeTestDb(db));

  const get = (cookie?: string) =>
    GET({ request: new Request(ENDPOINT, { headers: cookie ? { Cookie: cookie } : {} }) } as never);

  it('devuelve 401 sin cookie', async () => {
    expect((await get()).status).toBe(401);
  });

  it('devuelve 401 con un token corrupto', async () => {
    expect((await get('auth-token=esto.no.es.un.jwt')).status).toBe(401);
  });

  it('devuelve 401 con un token firmado con otro secreto', async () => {
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5Ac29ubXlkLnRlc3QiLCJyb2xlIjoiYWRtaW4ifQ.firma-falsa';

    expect((await get(`auth-token=${forged}`)).status).toBe(401);
  });

  it('devuelve el usuario con una cookie válida', async () => {
    const login = await post({ action: 'login', email: 'admin@sonmyd.test', password: PASSWORD });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];

    const payload = await readJson(await get(cookie));

    expect(payload.user.email).toBe('admin@sonmyd.test');
    expect(payload.user.password).toBeUndefined();
  });

  it('devuelve 401 si el usuario del token ya no existe', async () => {
    const token = authHelpers.generateToken({ userId: 9999, email: 'fantasma@sonmyd.test', role: 'admin' });

    expect((await get(`auth-token=${token}`)).status).toBe(401);
  });
});
