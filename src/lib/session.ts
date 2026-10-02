import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sesión sin estado: el servidor no guarda nada. La cookie lleva los datos de
 * la sesión (quién y hasta cuándo) y una firma HMAC-SHA256 hecha con
 * SESSION_SECRET; para validarla basta recalcular la firma.
 *
 *   token = base64url(JSON de los datos) + "." + base64url(HMAC-SHA256)
 *
 * Es lo que permite correr en funciones serverless, donde no hay base de datos
 * ni memoria compartida entre peticiones.
 *
 * Consecuencia a tener presente: una sesión no se puede revocar de forma
 * individual. Antes de `exp` es válida en todas partes. Para invalidar TODAS
 * (por ejemplo, tras filtrarse una cookie) se cambia SESSION_SECRET.
 */

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Debajo de esto, el secreto es adivinable por fuerza bruta. `openssl rand -hex 32` da 64. */
export const MIN_SECRET_LENGTH = 32;

export interface SessionClaims {
  /** Email del administrador. */
  sub: string;
  role: 'admin';
  /** Emitida en (segundos desde 1970). */
  iat: number;
  /** Vence en (segundos desde 1970). */
  exp: number;
}

export interface SignOptions {
  /** Milisegundos desde 1970. Solo se reemplaza en los tests. */
  now?: number;
  ttlSeconds?: number;
}

export const isUsableSecret = (secret: unknown): secret is string =>
  typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH;

const signature = (data: string, secret: string): Buffer => createHmac('sha256', secret).update(data).digest();

const isClaims = (value: unknown): value is SessionClaims => {
  if (typeof value !== 'object' || value === null) return false;

  const claims = value as Record<string, unknown>;

  return (
    typeof claims.sub === 'string' &&
    claims.sub !== '' &&
    claims.role === 'admin' &&
    typeof claims.iat === 'number' &&
    Number.isFinite(claims.iat) &&
    typeof claims.exp === 'number' &&
    Number.isFinite(claims.exp)
  );
};

/** Firma una sesión. Lanza si el secreto falta o es demasiado corto: es un error de configuración. */
export const signSession = (
  subject: string,
  secret: string | undefined,
  { now = Date.now(), ttlSeconds = SESSION_TTL_SECONDS }: SignOptions = {}
): string => {
  if (!isUsableSecret(secret)) {
    throw new Error(
      `SESSION_SECRET no está configurado o es demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres).`
    );
  }

  const issuedAt = Math.floor(now / 1000);
  const claims: SessionClaims = { sub: subject, role: 'admin', iat: issuedAt, exp: issuedAt + ttlSeconds };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');

  return `${payload}.${signature(payload, secret).toString('base64url')}`;
};

/**
 * Valida un token y devuelve sus datos, o `null` si no sirve por cualquier
 * motivo (mal formado, firma que no coincide, vencido, secreto no válido).
 * Nunca lanza: un token roto es una petición sin sesión, no un error del servidor.
 */
export const verifySession = (
  token: string | null | undefined,
  secret: string | undefined,
  now: number = Date.now()
): SessionClaims | null => {
  if (!token || !isUsableSecret(secret)) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;

  const [payload, providedSignature] = parts;

  const provided = Buffer.from(providedSignature, 'base64url');
  // Buffer.from descarta en silencio los caracteres que no son base64url: si al
  // volver a codificar no sale lo mismo, la firma venía con relleno ajeno.
  if (provided.toString('base64url') !== providedSignature) return null;

  const expected = signature(payload, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let claims: unknown;

  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isClaims(claims)) return null;
  if (claims.exp * 1000 <= now) return null;

  return claims;
};
