import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';

export interface ContactFormInput {
  name: string;
  email: string;
  message: string;
  phone?: string | null;
  company?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sourcePage?: string | null;
}

export interface AppointmentInput {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  serviceType: string;
  date: string;
  time: string;
  timezone?: string;
  duration?: number;
  message?: string | null;
}

export interface AppointmentRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service_type: string;
  date: string;
  time: string;
  timezone: string;
  duration: number;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContactFormRow {
  id: number;
  name: string;
  email: string;
  message: string;
  phone: string | null;
  company: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  source_page: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Crea el esquema. Es idempotente, así que se puede correr en cada arranque
 * y también sobre una base en memoria dentro de los tests.
 */
export const applySchema = (database: Database.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      ip_address TEXT,
      user_agent TEXT,
      source_page TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      service_type TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Bogota',
      duration INTEGER NOT NULL DEFAULT 60,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contact_forms_status ON contact_forms(status);
    CREATE INDEX IF NOT EXISTS idx_contact_forms_created_at ON contact_forms(created_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
  `);

  return database;
};

const resolveDbPath = () => process.env.DATABASE_PATH || join(process.cwd(), 'data', 'database.sqlite');

let instance: Database.Database | null = null;

/**
 * Singleton perezoso. Importante que sea perezoso: si se abriera la base al
 * importar el módulo, cualquier test o build que toque este archivo crearía
 * un .sqlite en disco sin quererlo.
 */
export const getDb = (): Database.Database => {
  if (instance) return instance;

  const dbPath = resolveDbPath();

  // better-sqlite3 no crea directorios: si la ruta apunta a una carpeta que no
  // existe (primer arranque local, o un volumen recién montado) falla con
  // SQLITE_CANTOPEN antes de llegar a cualquier consulta.
  mkdirSync(dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  instance = applySchema(database);

  return instance;
};

/** Solo para tests: permite inyectar una base en memoria. */
export const setDb = (database: Database.Database | null) => {
  instance = database;
};

export const dbHelpers = {
  insertContactForm: (data: ContactFormInput) =>
    getDb()
      .prepare(
        `INSERT INTO contact_forms (name, email, message, phone, company, ip_address, user_agent, source_page)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.name,
        data.email,
        data.message,
        data.phone ?? null,
        data.company ?? null,
        data.ip ?? null,
        data.userAgent ?? null,
        data.sourcePage ?? null
      ),

  getContactForms: (limit = 50, offset = 0) =>
    getDb()
      .prepare('SELECT * FROM contact_forms ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as ContactFormRow[],

  updateContactFormStatus: (id: number, status: string) =>
    getDb().prepare('UPDATE contact_forms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id),

  insertAppointment: (data: AppointmentInput) =>
    getDb()
      .prepare(
        `INSERT INTO appointments (name, email, phone, company, service_type, date, time, timezone, duration, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.name,
        data.email,
        data.phone ?? null,
        data.company ?? null,
        data.serviceType,
        data.date,
        data.time,
        data.timezone ?? 'America/Bogota',
        data.duration ?? 60,
        data.message ?? null
      ),

  getAppointments: (limit = 50, offset = 0) =>
    getDb()
      .prepare('SELECT * FROM appointments ORDER BY date DESC, time DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as AppointmentRow[],

  getAppointmentsByDate: (date: string) =>
    getDb().prepare('SELECT * FROM appointments WHERE date = ? ORDER BY time').all(date) as AppointmentRow[],

  updateAppointmentStatus: (id: number, status: string) =>
    getDb().prepare('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id),

  getStats: () => {
    const database = getDb();
    const count = (sql: string, ...params: unknown[]) =>
      (database.prepare(sql).get(...params) as { count: number }).count;

    return {
      contactForms: {
        total: count('SELECT COUNT(*) as count FROM contact_forms'),
        new: count("SELECT COUNT(*) as count FROM contact_forms WHERE status = 'new'"),
      },
      appointments: {
        total: count('SELECT COUNT(*) as count FROM appointments'),
        pending: count("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'"),
      },
    };
  },
};
