import Database from 'better-sqlite3';
import { applySchema, setDb } from '~/lib/database';
import { authHelpers } from '~/lib/auth';
import { resetRateLimit } from '~/lib/http';

/** Base en memoria: cada test arranca con un esquema limpio y no toca el disco. */
export const createTestDb = () => {
  const db = applySchema(new Database(':memory:'));
  setDb(db);
  resetRateLimit();

  return db;
};

export const closeTestDb = (db: Database.Database) => {
  setDb(null);
  db.close();
};

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

/** Crea un usuario y devuelve la cookie de sesión lista para usar. */
export const sessionCookieFor = async (role: 'admin' | 'editor' = 'admin') => {
  const email = `${role}@sonmyd.test`;
  const userId = await authHelpers.createUser(email, 'password-larguisima-123', 'Tester', role);
  const token = authHelpers.generateToken({ userId, email, role });

  return `auth-token=${token}`;
};

// Los tests inspeccionan JSON arbitrario de respuestas; tiparlo en serio acá
// solo agregaría ruido sin aportar seguridad.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readJson = async (response: Response) => (await response.json()) as Record<string, any>;

/** Fecha futura segura (mañana) en formato yyyy-MM-dd. */
export const tomorrow = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};
