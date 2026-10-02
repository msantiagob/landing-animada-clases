import { createHmac } from 'node:crypto';
import { addDays, format, parseISO } from 'date-fns';
import { vi } from 'vitest';
import { AUTH_COOKIE } from '~/lib/auth';
import { resetRateLimit } from '~/lib/http';
import { hashPassword, type ScryptParams } from '~/lib/password';
import { SESSION_TTL_SECONDS, signSession, type SignOptions } from '~/lib/session';
import { createMemoryStore, setLeadStore, type LeadStore } from '~/lib/storage';
import type { MemoryStoreOptions } from '~/lib/storage/memory';
import { businessDateOf } from '~/utils/business-time';

/* -------------------------------------------------------------------------- */
/* Almacenamiento                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Un store en memoria nuevo, ya instalado en los endpoints (`getLeadStore`
 * devuelve este), y el rate limit en cero. Cada test arranca sin leads.
 *
 * Es el MISMO `KeyValueLeadStore` que usa Netlify Blobs, solo que sobre un Map:
 * los tests ejercitan la lógica real de ids, orden y reserva de horarios.
 * Acepta un reloj y un generador de ids para los tests que necesiten fijarlos.
 */
export const createTestStore = (options: MemoryStoreOptions = {}): LeadStore => {
  const store = createMemoryStore(options);

  setLeadStore(store);
  resetRateLimit();

  return store;
};

/**
 * Deshace lo que instalaron los helpers: descarta el store, vacía el rate limit,
 * restaura las variables de entorno (incluida la zona horaria) y suelta el reloj
 * congelado. Va en el `afterEach` de cada archivo.
 */
export const resetTestEnvironment = (): void => {
  setLeadStore(null);
  resetRateLimit();
  vi.unstubAllEnvs();
  vi.useRealTimers();
};

/* -------------------------------------------------------------------------- */
/* Panel de administración                                                    */
/* -------------------------------------------------------------------------- */

export const TEST_ADMIN_EMAIL = 'admin@sonmyd.test';
export const TEST_ADMIN_PASSWORD = 'una-password-larga-123';
export const TEST_SESSION_SECRET = 'secreto-de-pruebas-de-al-menos-32-caracteres';

/** Otro secreto igual de largo: sirve para firmar lo que el servidor NO debe aceptar. */
export const OTHER_SESSION_SECRET = 'otro-secreto-distinto-de-al-menos-32-caracteres';

/**
 * Costos mínimos de scrypt. El formato y la verificación son los de producción
 * (los costos viajan dentro del hash), pero cada login tarda ~1 ms y no ~300 ms:
 * los tests de fuerza bruta hacen decenas.
 */
const TEST_SCRYPT_PARAMS: ScryptParams = { N: 1024, r: 8, p: 1 };

let passwordHash: Promise<string> | undefined;

/** Hash de `TEST_ADMIN_PASSWORD`, generado con `password.ts` una sola vez por archivo de tests. */
export const testPasswordHash = (): Promise<string> =>
  (passwordHash ??= hashPassword(TEST_ADMIN_PASSWORD, TEST_SCRYPT_PARAMS));

export interface AdminEnvironment {
  email?: string;
  passwordHash?: string;
  secret?: string;
}

/**
 * Deja el panel configurado como en Netlify: ADMIN_EMAIL, ADMIN_PASSWORD_HASH y
 * SESSION_SECRET. Cada campo se puede pisar (también con '' para simular que
 * falta). `resetTestEnvironment` restaura el entorno.
 */
export const configureAdminEnv = async ({
  email = TEST_ADMIN_EMAIL,
  passwordHash: hash,
  secret = TEST_SESSION_SECRET,
}: AdminEnvironment = {}): Promise<void> => {
  vi.stubEnv('ADMIN_EMAIL', email);
  vi.stubEnv('ADMIN_PASSWORD_HASH', hash ?? (await testPasswordHash()));
  vi.stubEnv('SESSION_SECRET', secret);
};

export interface AdminCookieOptions extends SignOptions {
  /** Correo de la sesión. Por defecto, el administrador configurado. */
  subject?: string;
  /** Secreto con el que se firma. Por defecto, el que deja `configureAdminEnv`. */
  secret?: string;
}

/** `auth-token=<token>`, listo para el encabezado `Cookie`. */
export const cookieHeader = (token: string): string => `${AUTH_COOKIE}=${token}`;

/** El token de una cookie `auth-token=<token>`. */
const tokenOf = (cookie: string): string => cookie.slice(`${AUTH_COOKIE}=`.length);

/**
 * Cookie de sesión del administrador, firmada por `session.ts` como lo hace el
 * login. Con `now` se emite en otro momento (`now` en el pasado da una sesión
 * vencida); con `secret` o `subject` se emiten sesiones que el servidor debe rechazar.
 */
export const adminCookie = ({
  subject = TEST_ADMIN_EMAIL,
  secret = TEST_SESSION_SECRET,
  ...options
}: AdminCookieOptions = {}): string => cookieHeader(signSession(subject, secret, options));

/** Contenido de una sesión válida. Cada campo se puede pisar para fabricar sesiones inválidas. */
export const sessionClaims = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  const issuedAt = Math.floor(Date.now() / 1000);

  return { sub: TEST_ADMIN_EMAIL, role: 'admin', iat: issuedAt, exp: issuedAt + 3600, ...overrides };
};

/**
 * Firma CUALQUIER contenido con el formato de la sesión
 * (`base64url(JSON).base64url(HMAC-SHA256)`), sin pasar por `signSession`. Sirve
 * para fabricar tokens con firma correcta que el servidor jamás emitiría, como
 * uno con un rol distinto de admin. Es un oráculo independiente a propósito: si
 * el formato cambiara en `session.ts`, los tests lo notarían.
 */
export const signRawClaims = (claims: unknown, secret: string = TEST_SESSION_SECRET): string => {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');

  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
};

const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60;

/**
 * La misma cookie con el contenido alterado (vence diez años más tarde) y la
 * firma original: lo que haría quien intenta alargar su propia sesión.
 */
export const tamperedCookie = (cookie: string): string => {
  const [payload, signature] = tokenOf(cookie).split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
  const forged = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + TEN_YEARS_SECONDS })).toString('base64url');

  return cookieHeader(`${forged}.${signature}`);
};

/**
 * Las maneras de presentarse al panel que NO deben abrirlo. Una sola lista para
 * todos los endpoints protegidos: cada uno tiene que rechazarlas todas. La
 * cookie es `undefined` cuando la petición no lleva ninguna.
 */
export const rejectedSessions = (): Array<[label: string, cookie: string | undefined]> => [
  ['una petición sin cookie', undefined],
  ['un token que no es una sesión', cookieHeader('basura')],
  ['una sesión vencida', adminCookie({ now: Date.now() - (SESSION_TTL_SECONDS + 24 * 60 * 60) * 1000 })],
  ['una sesión firmada con otro secreto', adminCookie({ secret: OTHER_SESSION_SECRET })],
  ['una sesión con el contenido alterado', tamperedCookie(adminCookie())],
  ['una sesión con firma válida pero de rol "editor"', cookieHeader(signRawClaims(sessionClaims({ role: 'editor' })))],
  ['una sesión con firma válida sin rol', cookieHeader(signRawClaims(sessionClaims({ role: undefined })))],
  ['una sesión de un correo que no es el del administrador configurado', adminCookie({ subject: 'otro@sonmyd.test' })],
];

/* -------------------------------------------------------------------------- */
/* Peticiones y respuestas                                                    */
/* -------------------------------------------------------------------------- */

export const jsonRequest = (url: string, body: unknown, init: RequestInit = {}) => {
  const { headers, ...rest } = init;

  return new Request(url, {
    method: 'POST',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
    body: JSON.stringify(body),
  });
};

export const withCookie = (request: Request, cookie: string) => {
  const next = new Request(request);
  next.headers.set('Cookie', cookie);
  return next;
};

// Los tests inspeccionan JSON arbitrario de respuestas; tiparlo en serio acá
// solo agregaría ruido sin aportar seguridad.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readJson = async (response: Response) => (await response.json()) as Record<string, any>;

/**
 * Mañana en Colombia (yyyy-MM-dd). El endpoint lee fecha y hora como hora de Colombia, así que
 * cualquier turno de ese día queda a más de 2 horas de anticipación sin importar a qué hora
 * corran los tests ni en qué zona horaria esté la máquina que los corre.
 */
export const tomorrow = (): string => format(addDays(parseISO(businessDateOf()), 1), 'yyyy-MM-dd');

/* -------------------------------------------------------------------------- */
/* Zona horaria del servidor                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Zonas en las que podría estar corriendo el servidor. UTC es la de Netlify y America/Bogota la
 * del negocio (y de quien desarrolla). Las demás cubren lo que una lectura de la hora LOCAL
 * del servidor hace mal: ir por delante (Tokio, Auckland), por detrás (Los Ángeles, y sobre
 * todo Honolulu, que aceptaría turnos que ya pasaron en Colombia) o con medias horas (Calcuta).
 */
export const SERVER_TIMEZONES = [
  'UTC',
  'America/Bogota',
  'America/Los_Angeles',
  'Pacific/Honolulu',
  'Europe/Madrid',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Pacific/Auckland',
] as const;

const hourIn = (timeZone: string, instant: Date): number =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(instant));

/**
 * Hace que el proceso crea estar en `timeZone` (cambia `process.env.TZ`, que Node relee al
 * asignarla). `resetTestEnvironment` lo deshace.
 *
 * Comprueba que el cambio surtió efecto: si alguna plataforma ignorara TZ, los tests de
 * zona horaria pasarían en vacío sin que nadie lo notara.
 */
export const stubServerTimezone = (timeZone: string): void => {
  vi.stubEnv('TZ', timeZone);

  const probe = new Date(Date.UTC(2026, 9, 5, 12, 0));

  if (probe.getHours() !== hourIn(timeZone, probe)) {
    throw new Error(`El proceso ignoró TZ=${timeZone}: los tests de zona horaria no probarían nada.`);
  }
};

/**
 * Congela solo `Date` en `instant` (los timers siguen reales: los endpoints esperan promesas).
 * `resetTestEnvironment` lo suelta.
 */
export const freezeClock = (instant: string | number | Date): void => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(instant));
};
