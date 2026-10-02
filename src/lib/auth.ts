import { createHash, timingSafeEqual } from 'node:crypto';
import { isPasswordHash, verifyPassword } from './password';
import { MIN_SECRET_LENGTH, SESSION_TTL_SECONDS, isUsableSecret, signSession, verifySession } from './session';

/**
 * Autenticación del panel SIN base de datos.
 *
 * Hay un único administrador y sus credenciales viven en variables de entorno
 * de Netlify:
 * - ADMIN_EMAIL: su correo.
 * - ADMIN_PASSWORD_HASH: el hash de su contraseña (`npm run hash-password`).
 * - SESSION_SECRET: el secreto con el que se firma la cookie de sesión.
 *
 * La sesión es una cookie firmada sin estado (session.ts). Si falta alguna de
 * las tres variables, nadie puede entrar (el login responde 503) pero el resto
 * del sitio sigue funcionando.
 */

export const AUTH_COOKIE = 'auth-token';

export interface AdminConfig {
  email: string;
  passwordHash: string;
  secret: string;
}

export type AdminConfigStatus = { configured: true; config: AdminConfig } | { configured: false; missing: string[] };

export interface AdminSession {
  email: string;
  role: 'admin';
  /** Vence en (segundos desde 1970). */
  exp: number;
}

/** Se lee del entorno en cada llamada: cambiar una variable en Netlify no exige tocar el código. */
const readConfig = (): AdminConfigStatus => {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const passwordHash = (process.env.ADMIN_PASSWORD_HASH ?? '').trim();
  const secret = process.env.SESSION_SECRET ?? '';

  const missing: string[] = [];
  if (!email) missing.push('ADMIN_EMAIL');
  // Un hash con otro formato (p. ej. uno de bcrypt) se trata como "sin configurar": si no, todo
  // intento de login daría "credenciales inválidas" y parecería que la contraseña está mal.
  if (!passwordHash) missing.push('ADMIN_PASSWORD_HASH');
  else if (!isPasswordHash(passwordHash))
    missing.push('ADMIN_PASSWORD_HASH (formato no válido: usa npm run hash-password)');
  if (!isUsableSecret(secret))
    missing.push(secret ? `SESSION_SECRET (mínimo ${MIN_SECRET_LENGTH} caracteres)` : 'SESSION_SECRET');

  return missing.length > 0
    ? { configured: false, missing }
    : { configured: true, config: { email, passwordHash, secret } };
};

/** Compara en tiempo constante sin importar el largo: compara los SHA-256 de ambos textos. */
const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/**
 * `Secure` siempre, salvo en el servidor de desarrollo (http://localhost, donde
 * Safari no guarda cookies Secure). Se decide al revés que lo habitual (`=== 'production'`)
 * a propósito: si NODE_ENV no llega a la función serverless, la cookie debe
 * salir Secure igual, no sin protección.
 */
const cookieAttributes = (maxAgeSeconds: number): string =>
  [
    'HttpOnly',
    ...(process.env.NODE_ENV === 'development' ? [] : ['Secure']),
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax',
  ].join('; ');

export const buildAuthCookie = (token: string): string =>
  `${AUTH_COOKIE}=${token}; ${cookieAttributes(SESSION_TTL_SECONDS)}`;

export const buildLogoutCookie = (): string => `${AUTH_COOKIE}=; ${cookieAttributes(0)}`;

export const authHelpers = {
  /** Si el panel tiene todo lo necesario para funcionar. Nunca incluye valores, solo nombres de variables. */
  configStatus: (): AdminConfigStatus => readConfig(),

  login: async (
    email: string,
    password: string
  ): Promise<{ user: { email: string; role: 'admin' }; token: string } | null> => {
    const status = readConfig();
    if (!status.configured) return null;

    const { config } = status;

    // Las dos comprobaciones se hacen SIEMPRE, sin cortar en la primera que
    // falla: así el tiempo de respuesta no revela si el correo existe.
    const emailMatches = safeEqual(email.trim().toLowerCase(), config.email);
    const passwordMatches = await verifyPassword(password, config.passwordHash);

    if (!emailMatches || !passwordMatches) return null;

    return {
      user: { email: config.email, role: 'admin' },
      token: signSession(config.email, config.secret),
    };
  },

  getTokenFromCookies: (request: Request): string | null => {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(';')) {
      const separator = part.indexOf('=');
      if (separator === -1) continue;
      if (part.slice(0, separator).trim() === AUTH_COOKIE) return part.slice(separator + 1).trim();
    }

    return null;
  },

  /**
   * La sesión de la petición, o `null`. Además de la firma y el vencimiento se
   * exige que siga siendo el administrador configurado: cambiar ADMIN_EMAIL
   * cierra la sesión del anterior.
   */
  requireAuthFromCookies: (request: Request): AdminSession | null => {
    const token = authHelpers.getTokenFromCookies(request);
    if (!token) return null;

    const status = readConfig();
    if (!status.configured) return null;

    const claims = verifySession(token, status.config.secret);
    if (!claims || !safeEqual(claims.sub, status.config.email)) return null;

    return { email: claims.sub, role: claims.role, exp: claims.exp };
  },

  /** Autenticación + control de rol para endpoints y páginas de administración. */
  requireAdmin: (request: Request): AdminSession | null => {
    const session = authHelpers.requireAuthFromCookies(request);

    return session?.role === 'admin' ? session : null;
  },
};
