#!/usr/bin/env node
/**
 * Crea (o actualiza) el usuario administrador.
 *
 * Reemplaza al viejo `initializeDefaultAdmin`, que sembraba
 * admin@sonmyd.com / admin123 en cada arranque del servidor.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... node scripts/create-admin.mjs
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'Administrador';

if (!email || !password) {
  console.error('Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD.');
  process.exit(1);
}

if (password.length < 12) {
  console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const hashed = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE users SET password = ?, name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hashed,
    name,
    'admin',
    existing.id
  );
  console.log(`Contraseña actualizada para ${email}`);
} else {
  db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'admin')").run(email, hashed, name);
  console.log(`Usuario admin creado: ${email}`);
}

db.close();
