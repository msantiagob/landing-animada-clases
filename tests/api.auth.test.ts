import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GET, POST } from '~/pages/api/auth';
import { authHelpers } from '~/lib/auth';
import { resetRateLimit } from '~/lib/http';
import * as passwordModule from '~/lib/password';
import { SESSION_TTL_SECONDS, verifySession } from '~/lib/session';
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD as PASSWORD,
  TEST_SESSION_SECRET,
  configureAdminEnv,
  jsonRequest,
  readJson,
  rejectedSessions,
  resetTestEnvironment,
  testPasswordHash,
} from './helpers';
import { findVoseo } from './voseo';

const ENDPOINT = 'https://sonmyd.co/api/auth';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

const login = (headers: Record<string, string> = {}) =>
  post({ action: 'login', email: TEST_ADMIN_EMAIL, password: PASSWORD }, headers);

const failedLogin = (headers: Record<string, string> = {}) =>
  post({ action: 'login', email: TEST_ADMIN_EMAIL, password: 'mala' }, headers);

/** `Set-Cookie` de una respuesta: el valor y sus atributos por separado. */
const parseSetCookie = (response: Response) => {
  const [pair, ...attributes] = (response.headers.get('set-cookie') ?? '').split('; ');
  const [name, ...value] = pair.split('=');

  return { name, value: value.join('='), attributes };
};

describe('POST /api/auth', () => {
  beforeEach(async () => {
    resetRateLimit();
    await configureAdminEnv();
  });

  afterEach(resetTestEnvironment);

  it('loguea con credenciales válidas y setea una cookie de sesión httpOnly, Secure y firmada', async () => {
    const response = await login();
    const payload = await readJson(response);
    const cookie = parseSetCookie(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, user: { email: TEST_ADMIN_EMAIL, role: 'admin' } });
    expect(cookie.name).toBe('auth-token');
    expect(cookie.attributes.sort()).toEqual(['HttpOnly', 'Max-Age=604800', 'Path=/', 'SameSite=Lax', 'Secure'].sort());

    // La cookie lleva una sesión que el servidor reconoce: del administrador y por 7 días.
    const claims = verifySession(cookie.value, TEST_SESSION_SECRET);
    expect(claims).toMatchObject({ sub: TEST_ADMIN_EMAIL, role: 'admin' });
    expect(claims!.exp - claims!.iat).toBe(SESSION_TTL_SECONDS);
  });

  // Secure siempre, salvo en el servidor de desarrollo (Safari no guarda cookies Secure en http://localhost).
  // Que NODE_ENV falte no puede dejar la cookie sin proteger.
  it.each(['test', 'production', undefined])('con NODE_ENV=%s la cookie de sesión lleva Secure', async (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv);

    const { attributes } = parseSetCookie(await login());

    expect(attributes).toContain('Secure');
    expect(attributes).toContain('HttpOnly');
  });

  it('en el servidor de desarrollo (NODE_ENV=development) la cookie va sin Secure para funcionar en http://localhost', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { attributes } = parseSetCookie(await login());

    expect(attributes).not.toContain('Secure');
    expect(attributes).toContain('HttpOnly');
  });

  it('nunca devuelve el token, el hash ni el secreto en el body', async () => {
    const response = await login();
    const body = JSON.stringify(await readJson(response));

    expect(body).not.toContain(parseSetCookie(response).value);
    expect(body).not.toContain(await testPasswordHash());
    expect(body).not.toContain(TEST_SESSION_SECRET);
    expect(body).not.toMatch(/token|password|hash/i);
  });

  it('normaliza el email: mayúsculas y espacios no rompen el login', async () => {
    const response = await post({ action: 'login', email: `  ${TEST_ADMIN_EMAIL.toUpperCase()} `, password: PASSWORD });

    expect(response.status).toBe(200);
    expect((await readJson(response)).user.email).toBe(TEST_ADMIN_EMAIL);
  });

  it('devuelve 401 con contraseña incorrecta, sin cookie', async () => {
    const response = await failedLogin();

    expect(response.status).toBe(401);
    expect((await readJson(response)).error).toBe('Credenciales inválidas');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('la contraseña se compara tal cual: un espacio de más ya es otra contraseña', async () => {
    const response = await post({ action: 'login', email: TEST_ADMIN_EMAIL, password: `${PASSWORD} ` });

    expect(response.status).toBe(401);
  });

  it('devuelve 401 con un usuario inexistente, con el mismo mensaje que una contraseña mala', async () => {
    const unknown = await post({ action: 'login', email: 'nadie@sonmyd.test', password: PASSWORD });
    const wrong = await failedLogin();

    // No debe filtrar qué emails existen.
    expect(unknown.status).toBe(401);
    expect((await readJson(unknown)).error).toBe((await readJson(wrong)).error);
    expect(unknown.headers.get('set-cookie')).toBeNull();
  });

  // Si un correo desconocido cortara el login antes de calcular el hash, el tiempo de
  // respuesta delataría cuál de los dos datos falló.
  it('verifica la contraseña aunque el correo no coincida, para no revelar cuál de los dos falló', async () => {
    const verify = vi.spyOn(passwordModule, 'verifyPassword');

    await post({ action: 'login', email: 'nadie@sonmyd.test', password: PASSWORD });

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('exige email y contraseña', async () => {
    expect((await post({ action: 'login', email: TEST_ADMIN_EMAIL })).status).toBe(400);
    expect((await post({ action: 'login', password: PASSWORD })).status).toBe(400);
    expect((await post({ action: 'login', email: '   ', password: PASSWORD })).status).toBe(400);
  });

  it.each([
    ['un número', 12345],
    ['un objeto', { $ne: '' }],
    ['un arreglo', [PASSWORD]],
  ])('trata una contraseña que es %s como si faltara', async (_caso, password) => {
    const response = await post({ action: 'login', email: TEST_ADMIN_EMAIL, password });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toBe('Email y contraseña son obligatorios');
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
    expect(response.headers.get('set-cookie')).toBeNull();

    // Y esas credenciales no abren nada: el único administrador sale del entorno.
    const attempt = await post({ action: 'login', email: 'atacante@evil.test', password: 'password-larga-123' });
    expect(attempt.status).toBe(401);
  });

  it('rechaza cualquier acción desconocida', async () => {
    expect((await post({ action: 'promote' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  // Un cuerpo ilegible es un error del cliente: 400 sin sesión y sin un 500 que
  // ensucie los logs cada vez que un bot golpea el login.
  it.each([
    ['un JSON roto', '{"action": "login", ', 'application/json'],
    ['un JSON vacío', '', 'application/json'],
    ['un JSON que no es un objeto', 'null', 'application/json'],
    ['un Content-Type desconocido', 'action=login', 'text/plain'],
  ])('responde 400, y no 500, ante %s', async (_caso, body, contentType) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: new Request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': contentType }, body }),
    } as never);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/no válida/i);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('el logout limpia la cookie con los mismos atributos de protección', async () => {
    const response = await post({ action: 'logout' });
    const cookie = parseSetCookie(response);

    expect(response.status).toBe(200);
    expect(cookie.name).toBe('auth-token');
    expect(cookie.value).toBe('');
    expect(cookie.attributes).toEqual(expect.arrayContaining(['Max-Age=0', 'HttpOnly', 'Path=/', 'SameSite=Lax']));
  });

  describe('freno de fuerza bruta', () => {
    it('frena tras 8 intentos desde la misma IP, aunque el noveno lleve la contraseña correcta', async () => {
      const headers = { 'x-forwarded-for': '192.0.2.50' };

      for (let attempt = 0; attempt < 8; attempt += 1) {
        expect((await failedLogin(headers)).status).toBe(401);
      }

      const blocked = await login(headers);

      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('set-cookie')).toBeNull();
    });

    // La pantalla de login pinta este texto tal cual.
    it('el bloqueo por intentos le pide esperar con "tú"', async () => {
      const headers = { 'x-forwarded-for': '192.0.2.51' };
      for (let attempt = 0; attempt < 8; attempt += 1) await failedLogin(headers);

      const { error } = await readJson(await login(headers));

      expect(error).toBe('Demasiados envíos. Espera unos minutos e inténtalo de nuevo.');
      expect(findVoseo(error)).toEqual([]);
    });

    it('el límite es por IP: otra IP sigue pudiendo entrar', async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) await failedLogin({ 'x-forwarded-for': '192.0.2.52' });

      expect((await login({ 'x-forwarded-for': '192.0.2.53' })).status).toBe(200);
    });

    // x-forwarded-for lo escribe el cliente; la IP de x-nf-client-connection-ip la pone Netlify.
    it('no se esquiva rotando x-forwarded-for: manda la IP que informa la plataforma', async () => {
      const platformIp = '192.0.2.60';

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const headers = { 'x-nf-client-connection-ip': platformIp, 'x-forwarded-for': `10.0.0.${attempt}` };
        expect((await failedLogin(headers)).status).toBe(401);
      }

      const blocked = await login({ 'x-nf-client-connection-ip': platformIp, 'x-forwarded-for': '10.9.9.9' });

      expect(blocked.status).toBe(429);
    });
  });

  // Sin las variables de Netlify nadie puede entrar: se avisa con claridad (503) en vez de
  // contestar "credenciales inválidas", que mandaría a buscar el problema en la contraseña.
  describe('con el panel sin configurar', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it.each<[string, Parameters<typeof configureAdminEnv>[0], string]>([
      ['ADMIN_EMAIL', { email: '' }, 'ADMIN_EMAIL'],
      ['ADMIN_PASSWORD_HASH', { passwordHash: '' }, 'ADMIN_PASSWORD_HASH'],
      [
        'un ADMIN_PASSWORD_HASH con el formato de bcrypt',
        { passwordHash: '$2b$10$abcdefghijklmnopqrstuv' },
        'formato no válido',
      ],
      ['SESSION_SECRET', { secret: '' }, 'SESSION_SECRET'],
      ['un SESSION_SECRET demasiado corto', { secret: 'corto' }, 'mínimo 32'],
    ])('responde 503, y no 401, si falta %s', async (_caso, missing, inLog) => {
      await configureAdminEnv(missing);

      const response = await login();
      const payload = await readJson(response);

      expect(response.status).toBe(503);
      expect(payload).toEqual({
        success: false,
        error: 'El acceso al panel todavía no está configurado en el servidor.',
      });
      expect(findVoseo(payload.error)).toEqual([]);
      expect(response.headers.get('set-cookie')).toBeNull();
      // La respuesta no dice qué variable falta; el log sí, pero solo nombres, nunca valores.
      expect(JSON.stringify(payload)).not.toMatch(/ADMIN_|SESSION_/);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(inLog));
      const logs = JSON.stringify(consoleError.mock.calls);
      expect(logs).not.toContain(await testPasswordHash());
      expect(logs).not.toContain(TEST_SESSION_SECRET);
    });

    it('el log enumera TODAS las variables que faltan, no solo la primera', async () => {
      await configureAdminEnv({ email: '', passwordHash: '', secret: '' });

      await login();

      const [message] = consoleError.mock.calls[0];
      expect(message).toContain('ADMIN_EMAIL');
      expect(message).toContain('ADMIN_PASSWORD_HASH');
      expect(message).toContain('SESSION_SECRET');
    });

    it('el logout sigue funcionando, para poder borrar una cookie vieja', async () => {
      await configureAdminEnv({ secret: '' });

      const response = await post({ action: 'logout' });

      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    });
  });

  describe('cuando algo falla por dentro', () => {
    it('devuelve 500 genérico, sin filtrar el error, si el login lanza una excepción inesperada', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(authHelpers, 'login').mockRejectedValue(new Error('scrypt: memory limit exceeded 0xDEADBEEF'));

      const response = await login();
      const payload = await readJson(response);

      expect(response.status).toBe(500);
      expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(JSON.stringify(payload)).not.toMatch(/scrypt|DEADBEEF/);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(consoleError).toHaveBeenCalledWith('[api/auth] Error en autenticación:', expect.any(Error));
    });
  });
});

describe('GET /api/auth (sesión actual)', () => {
  beforeEach(async () => {
    resetRateLimit();
    await configureAdminEnv();
  });

  afterEach(resetTestEnvironment);

  const get = (cookie?: string) =>
    GET({ request: new Request(ENDPOINT, { headers: cookie ? { Cookie: cookie } : {} }) } as never);

  /** La cookie que el navegador guardaría tras un login real. */
  const loggedInCookie = async () => `auth-token=${parseSetCookie(await login()).value}`;

  it.each(rejectedSessions())('devuelve 401 ante %s', async (_label, cookie) => {
    const response = await get(cookie);

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ success: false, error: 'No autorizado' });
  });

  it('devuelve el usuario, y nada más, con la cookie que entrega el login', async () => {
    const payload = await readJson(await get(await loggedInCookie()));

    expect(payload).toEqual({ success: true, user: { email: TEST_ADMIN_EMAIL, role: 'admin' } });
  });

  it('deja de valer si cambia el administrador configurado (ADMIN_EMAIL)', async () => {
    const cookie = await loggedInCookie();
    expect((await get(cookie)).status).toBe(200);

    await configureAdminEnv({ email: 'nuevo-admin@sonmyd.test' });

    expect((await get(cookie)).status).toBe(401);
  });

  it('deja de valer al rotar SESSION_SECRET, que es la forma de cerrar todas las sesiones', async () => {
    const cookie = await loggedInCookie();

    await configureAdminEnv({ secret: 'secreto-rotado-de-al-menos-32-caracteres-xx' });

    expect((await get(cookie)).status).toBe(401);
  });

  it('devuelve 401 si el panel queda sin configurar', async () => {
    const cookie = await loggedInCookie();

    await configureAdminEnv({ passwordHash: '' });

    expect((await get(cookie)).status).toBe(401);
  });

  it('devuelve 500 genérico, sin filtrar el error, si verificar la sesión lanza una excepción', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(authHelpers, 'requireAuthFromCookies').mockImplementation(() => {
      throw new Error('HMAC backend exploded 0xDEADBEEF');
    });

    const response = await get(await loggedInCookie());
    const payload = await readJson(response);

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
    expect(JSON.stringify(payload)).not.toMatch(/HMAC|DEADBEEF/);
    expect(consoleError).toHaveBeenCalledWith('[api/auth] Error verificando autenticación:', expect.any(Error));
  });
});
