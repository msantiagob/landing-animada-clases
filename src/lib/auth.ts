import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const SALT_ROUNDS = 10;

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

// Funciones de autenticación
export const authHelpers = {
  // Crear hash de contraseña
  hashPassword: async (password: string): Promise<string> => {
    return await bcrypt.hash(password, SALT_ROUNDS);
  },

  // Verificar contraseña
  verifyPassword: async (password: string, hashedPassword: string): Promise<boolean> => {
    return await bcrypt.compare(password, hashedPassword);
  },

  // Generar JWT token
  generateToken: (payload: AuthTokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  },

  // Verificar JWT token
  verifyToken: (token: string): AuthTokenPayload | null => {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      return null;
    }
  },

  // Crear usuario admin
  createUser: async (email: string, password: string, name: string): Promise<number | null> => {
    try {
      const hashedPassword = await authHelpers.hashPassword(password);
      const stmt = db.prepare(`
        INSERT INTO users (email, password, name, role)
        VALUES (?, ?, ?, 'admin')
      `);
      const result = stmt.run(email, hashedPassword, name);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },

  // Obtener usuario por email
  getUserByEmail: (email: string): User | null => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  },

  // Obtener usuario por ID
  getUserById: (id: number): User | null => {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  },

  // Login
  login: async (email: string, password: string): Promise<{ user: User; token: string } | null> => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email) as any;
    
    if (!user) {
      return null;
    }

    const isValidPassword = await authHelpers.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    const tokenPayload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = authHelpers.generateToken(tokenPayload);
    
    // Remover password del objeto user
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token
    };
  },

  // Middleware para verificar autenticación en APIs
  requireAuth: (request: Request): AuthTokenPayload | null => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    return authHelpers.verifyToken(token);
  },

  // Obtener token desde cookies
  getTokenFromCookies: (request: Request): string | null => {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies['auth-token'] || null;
  },

  // Verificar autenticación desde cookies
  requireAuthFromCookies: (request: Request): AuthTokenPayload | null => {
    const token = authHelpers.getTokenFromCookies(request);
    if (!token) return null;
    
    return authHelpers.verifyToken(token);
  }
};

// Función para inicializar usuario admin por defecto
export const initializeDefaultAdmin = async () => {
  const adminEmail = 'admin@sonmyd.com';
  const existingAdmin = authHelpers.getUserByEmail(adminEmail);
  
  if (!existingAdmin) {
    const defaultPassword = 'admin123'; // Cambiar en producción
    const adminId = await authHelpers.createUser(adminEmail, defaultPassword, 'Administrador');
    
    if (adminId) {
      console.log('🔐 Usuario admin creado:');
      console.log('Email:', adminEmail);
      console.log('Password:', defaultPassword);
      console.log('⚠️  IMPORTANTE: Cambia la contraseña en producción');
    }
  }
};