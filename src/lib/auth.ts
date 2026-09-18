import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './database';

/**
 * 10 rondas en producción. Configurable porque en los tests hacer decenas de
 * hashes a 10 rondas cuesta segundos y provoca timeouts intermitentes; con un
 * costo menor se sigue ejercitando bcrypt de verdad, solo que más rápido.
 */
const SALT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '', 10) || 10;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const AUTH_COOKIE = 'auth-token';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: string;
}

/**
 * Nunca hay un secreto por defecto. Un fallback tipo 'change-me' hace que en
 * producción cualquiera pueda firmarse un token válido de admin.
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no está configurado o es demasiado corto (mínimo 32 caracteres).');
  }

  return secret;
};

export const authHelpers = {
  hashPassword: (password: string): Promise<string> => bcrypt.hash(password, SALT_ROUNDS),

  verifyPassword: (password: string, hashedPassword: string): Promise<boolean> =>
    bcrypt.compare(password, hashedPassword),

  generateToken: (payload: AuthTokenPayload): string =>
    jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS }),

  verifyToken: (token: string): AuthTokenPayload | null => {
    try {
      return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    } catch {
      return null;
    }
  },

  /**
   * No hay endpoint público de registro. Los usuarios se crean únicamente
   * desde el script de seed (`scripts/create-admin.mjs`).
   */
  createUser: async (email: string, password: string, name: string, role = 'admin'): Promise<number> => {
    const hashedPassword = await authHelpers.hashPassword(password);
    const result = getDb()
      .prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
      .run(email.trim().toLowerCase(), hashedPassword, name, role);

    return result.lastInsertRowid as number;
  },

  getUserByEmail: (email: string): (User & { password: string }) | null =>
    (getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
      | (User & { password: string })
      | undefined) ?? null,

  getUserById: (id: number): User | null =>
    (getDb().prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?').get(id) as
      | User
      | undefined) ?? null,

  login: async (email: string, password: string): Promise<{ user: User; token: string } | null> => {
    const user = authHelpers.getUserByEmail(email);

    if (!user) {
      // Hash de descarte: iguala el tiempo de respuesta con el de un usuario
      // existente para no filtrar qué emails están registrados.
      await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      return null;
    }

    if (!(await authHelpers.verifyPassword(password, user.password))) return null;

    const userWithoutPassword: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return {
      user: userWithoutPassword,
      token: authHelpers.generateToken({ userId: user.id, email: user.email, role: user.role }),
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

  requireAuthFromCookies: (request: Request): AuthTokenPayload | null => {
    const token = authHelpers.getTokenFromCookies(request);
    if (!token) return null;

    return authHelpers.verifyToken(token);
  },

  /** Autenticación + control de rol para endpoints de administración. */
  requireAdmin: (request: Request): AuthTokenPayload | null => {
    const payload = authHelpers.requireAuthFromCookies(request);
    if (!payload || payload.role !== 'admin') return null;

    return payload;
  },
};

export const buildAuthCookie = (token: string): string => {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${AUTH_COOKIE}=${token}; HttpOnly;${secure} Path=/; Max-Age=${TOKEN_TTL_SECONDS}; SameSite=Strict`;
};

export const buildLogoutCookie = (): string => {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${AUTH_COOKIE}=; HttpOnly;${secure} Path=/; Max-Age=0; SameSite=Strict`;
};
