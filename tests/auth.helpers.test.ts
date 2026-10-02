import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COOKIE, authHelpers } from '~/lib/auth';
import { hashPassword, verifyPassword } from '~/lib/password';
import { SESSION_TTL_SECONDS, signSession, verifySession } from '~/lib/session';

// Se envuelve verifyPassword para comprobar que el login la ejecuta aunque el correo no coincida.
vi.mock('~/lib/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/password')>();

  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const PASSWORD = 'una-contraseña-larga-de-prueba';
const SECRET = '0f'.repeat(32);
const EMAIL = 'admin@sonmyd.co';
const VARIABLES = ['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'] as const;

let hash: string;

beforeAll(async () => {
  // Costos mínimos: el hash real tarda ~0,3 s y acá se calcula una vez.
  hash = await hashPassword(PASSWORD, { N: 1024, r: 8, p: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Deja el entorno como en Netlify con todo configurado; `overrides` cambia o quita (con undefined) variables. */
const configure = (overrides: Partial<Record<(typeof VARIABLES)[number], string | undefined>> = {}) => {
  const values = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: SECRET, ...overrides };

  for (const name of VARIABLES) vi.stubEnv(name, values[name]);
};

const requestWith = (cookie?: string) =>
  new Request('https://sonmyd.co/admin/dashboard', cookie === undefined ? {} : { headers: { Cookie: cookie } });

const cookieFor = (token: string) => `${AUTH_COOKIE}=${token}`;

describe('configStatus', () => {
  it('con todo configurado devuelve la configuración normalizada: correo en minúsculas y sin espacios', () => {
    configure({ ADMIN_EMAIL: '  Admin@Sonmyd.CO ', ADMIN_PASSWORD_HASH: ` ${hash}\n` });

    expect(authHelpers.configStatus()).toEqual({
      configured: true,
      config: { email: EMAIL, passwordHash: hash, secret: SECRET },
    });
  });

  it.each(VARIABLES)('si falta %s, dice cuál falta y las otras no', (name) => {
    configure({ [name]: undefined });

    const status = authHelpers.configStatus();

    expect(status).toEqual({ configured: false, missing: [expect.stringContaining(name)] });
  });

  it('sin ninguna variable, las nombra las tres', () => {
    configure({ ADMIN_EMAIL: undefined, ADMIN_PASSWORD_HASH: undefined, SESSION_SECRET: undefined });

    expect(authHelpers.configStatus()).toEqual({
      configured: false,
      missing: ['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'],
    });
  });

  it('un correo de solo espacios cuenta como ausente', () => {
    configure({ ADMIN_EMAIL: '   ' });

    expect(authHelpers.configStatus()).toEqual({ configured: false, missing: ['ADMIN_EMAIL'] });
  });

  it('un hash con otro formato (p. ej. bcrypt) se trata como sin configurar y dice cómo arreglarlo', () => {
    configure({ ADMIN_PASSWORD_HASH: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012' });

    expect(authHelpers.configStatus()).toEqual({
      configured: false,
      missing: ['ADMIN_PASSWORD_HASH (formato no válido: usa npm run hash-password)'],
    });
  });

  it('un secreto demasiado corto se trata como sin configurar', () => {
    configure({ SESSION_SECRET: 'x'.repeat(31) });

    expect(authHelpers.configStatus()).toEqual({
      configured: false,
      missing: ['SESSION_SECRET (mínimo 32 caracteres)'],
    });
  });

  it('el aviso nombra variables, nunca valores', () => {
    configure({ ADMIN_PASSWORD_HASH: 'VALOR-SECRETO-DEL-HASH', SESSION_SECRET: 'VALOR-SECRETO-CORTO' });

    const serialized = JSON.stringify(authHelpers.configStatus());

    expect(serialized).not.toContain('VALOR-SECRETO');
  });

  it('lee el entorno en cada llamada: cambiar una variable no exige reiniciar nada', () => {
    configure();
    expect(authHelpers.configStatus().configured).toBe(true);

    configure({ SESSION_SECRET: undefined });
    expect(authHelpers.configStatus().configured).toBe(false);
  });
});

describe('login', () => {
  it('con las credenciales correctas devuelve el usuario y un token que verifica y dura 7 días', async () => {
    configure();

    const result = await authHelpers.login(EMAIL, PASSWORD);

    expect(result?.user).toEqual({ email: EMAIL, role: 'admin' });
    const claims = verifySession(result!.token, SECRET);
    expect(claims).toMatchObject({ sub: EMAIL, role: 'admin' });
    expect(claims!.exp - claims!.iat).toBe(SESSION_TTL_SECONDS);
  });

  it('no distingue mayúsculas ni espacios alrededor del correo', async () => {
    configure();

    expect(await authHelpers.login('  ADMIN@Sonmyd.CO ', PASSWORD)).not.toBeNull();
  });

  it.each([
    ['contraseña incorrecta', EMAIL, 'otra-contraseña-larga-de-prueba'],
    ['contraseña con otra capitalización', EMAIL, PASSWORD.toUpperCase()],
    ['contraseña con un espacio de más', EMAIL, ` ${PASSWORD}`],
    ['contraseña vacía', EMAIL, ''],
    ['correo incorrecto', 'otra@sonmyd.co', PASSWORD],
    ['correo y contraseña incorrectos', 'otra@sonmyd.co', 'incorrecta-incorrecta'],
    ['correo vacío', '', PASSWORD],
  ])('rechaza con %s', async (_name, email, password) => {
    configure();

    expect(await authHelpers.login(email, password)).toBeNull();
  });

  it.each(VARIABLES)('con %s sin configurar nadie puede entrar, ni con las credenciales correctas', async (name) => {
    configure({ [name]: undefined });

    expect(await authHelpers.login(EMAIL, PASSWORD)).toBeNull();
  });

  it('comprueba la contraseña aunque el correo no coincida, para que el tiempo de respuesta no delate si el correo existe', async () => {
    configure();
    vi.mocked(verifyPassword).mockClear();

    await authHelpers.login('otra@sonmyd.co', PASSWORD);

    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('con un hash corrupto en el entorno responde "sin acceso" y no lanza', async () => {
    configure({ ADMIN_PASSWORD_HASH: 'scrypt:1:2:3' });

    await expect(authHelpers.login(EMAIL, PASSWORD)).resolves.toBeNull();
  });
});

describe('getTokenFromCookies', () => {
  it.each([
    ['la única cookie', 'auth-token=abc.def', 'abc.def'],
    ['entre otras cookies', 'tema=oscuro; auth-token=abc.def; idioma=es', 'abc.def'],
    ['con espacios alrededor', '  auth-token = abc.def  ', 'abc.def'],
    ['sin confundirla con otra de nombre parecido', 'xauth-token=falsa; auth-token=abc.def', 'abc.def'],
    ['sin confundirla con un valor que la contiene', 'otra=auth-token=falsa; auth-token=abc.def', 'abc.def'],
    ['con un "=" en el valor', 'auth-token=abc=def', 'abc=def'],
  ])('la encuentra %s', (_name, header, expected) => {
    expect(authHelpers.getTokenFromCookies(requestWith(header))).toBe(expected);
  });

  it.each([
    ['sin cabecera Cookie', undefined],
    ['con la cabecera vacía', ''],
    ['sin la cookie de sesión', 'tema=oscuro; idioma=es'],
    ['con el nombre en otra capitalización', 'Auth-Token=abc.def'],
    ['con una cookie sin "="', 'auth-token'],
  ])('devuelve null %s', (_name, header) => {
    expect(authHelpers.getTokenFromCookies(requestWith(header))).toBeNull();
  });
});

describe('requireAuthFromCookies y requireAdmin', () => {
  const valid = () => cookieFor(signSession(EMAIL, SECRET));

  it('una cookie válida da la sesión del administrador', () => {
    configure();
    const session = authHelpers.requireAuthFromCookies(requestWith(valid()));

    expect(session).toEqual({ email: EMAIL, role: 'admin', exp: expect.any(Number) });
    expect(authHelpers.requireAdmin(requestWith(valid()))).toEqual(session);
  });

  it.each([
    ['sin cookie', undefined],
    ['con un token que no es un token', cookieFor('basura')],
    ['con la cookie vacía', 'auth-token='],
    ['con un token vencido', cookieFor(signSession(EMAIL, SECRET, { now: Date.now() - 8 * 24 * 3600 * 1000 }))],
    ['con un token firmado con otro secreto', cookieFor(signSession(EMAIL, 'b2'.repeat(32)))],
    ['con la firma alterada', `${valid().slice(0, -2)}AA`],
  ])('%s no da sesión', (_name, cookie) => {
    configure();

    expect(authHelpers.requireAuthFromCookies(requestWith(cookie))).toBeNull();
    expect(authHelpers.requireAdmin(requestWith(cookie))).toBeNull();
  });

  it('cambiar ADMIN_EMAIL cierra la sesión de quien estaba antes', () => {
    configure({ ADMIN_EMAIL: 'nuevo@sonmyd.co' });

    expect(authHelpers.requireAdmin(requestWith(valid()))).toBeNull();
  });

  it('cambiar SESSION_SECRET cierra todas las sesiones', () => {
    configure({ SESSION_SECRET: 'c3'.repeat(32) });

    expect(authHelpers.requireAdmin(requestWith(valid()))).toBeNull();
  });

  it.each(VARIABLES)('con %s sin configurar no hay sesión aunque la cookie esté bien firmada', (name) => {
    const cookie = valid();
    configure({ [name]: undefined });

    expect(authHelpers.requireAdmin(requestWith(cookie))).toBeNull();
  });

  it('el correo de la sesión se compara sin importar mayúsculas de la configuración', () => {
    configure({ ADMIN_EMAIL: 'ADMIN@SONMYD.CO' });

    expect(authHelpers.requireAdmin(requestWith(valid()))).toMatchObject({ email: EMAIL });
  });
});
