import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dbHelpers, getDb, setDb } from '~/lib/database';

describe('getDb', () => {
  let tempRoot: string;
  const originalPath = process.env.DATABASE_PATH;

  beforeEach(() => {
    setDb(null);
    tempRoot = mkdtempSync(join(tmpdir(), 'sonmyd-db-'));
  });

  afterEach(() => {
    setDb(null);
    rmSync(tempRoot, { recursive: true, force: true });
    if (originalPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalPath;
  });

  it('crea el directorio de la base si todavía no existe', () => {
    // Caso real: primer arranque, o volumen de Railway recién montado.
    const dbPath = join(tempRoot, 'data', 'anidado', 'database.sqlite');
    process.env.DATABASE_PATH = dbPath;

    expect(existsSync(join(tempRoot, 'data'))).toBe(false);

    const db = getDb();

    expect(existsSync(dbPath)).toBe(true);
    expect(db.prepare('SELECT 1 AS ok').get()).toEqual({ ok: 1 });
  });

  it('aplica el esquema al crear la base', () => {
    process.env.DATABASE_PATH = join(tempRoot, 'database.sqlite');

    const tables = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain('users');
    expect(tables).toContain('contact_forms');
    expect(tables).toContain('appointments');
  });

  it('descarta las tablas del panel viejo que ya no se usan', () => {
    process.env.DATABASE_PATH = join(tempRoot, 'database.sqlite');

    const tables = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).not.toContain('blog_posts');
    expect(tables).not.toContain('landing_pages');
    expect(tables).not.toContain('analytics');
    expect(tables).not.toContain('email_campaigns');
  });

  it('devuelve siempre la misma instancia', () => {
    process.env.DATABASE_PATH = join(tempRoot, 'database.sqlite');

    expect(getDb()).toBe(getDb());
  });

  it('no crea ningún usuario por defecto', () => {
    // El esquema anterior sembraba admin@sonmyd.com / admin123 en cada arranque.
    process.env.DATABASE_PATH = join(tempRoot, 'database.sqlite');

    const { count } = getDb().prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };

    expect(count).toBe(0);
  });

  it('getStats cuenta por estado', () => {
    process.env.DATABASE_PATH = join(tempRoot, 'database.sqlite');
    getDb();

    dbHelpers.insertContactForm({ name: 'A', email: 'a@x.com', message: 'hola' });
    dbHelpers.insertContactForm({ name: 'B', email: 'b@x.com', message: 'hola' });
    dbHelpers.updateContactFormStatus(1, 'closed');

    expect(dbHelpers.getStats().contactForms).toEqual({ total: 2, new: 1 });
  });
});
