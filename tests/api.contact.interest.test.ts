import Database from 'better-sqlite3';
import type DatabaseType from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '~/pages/api/contact';
import { applySchema, dbHelpers, setDb } from '~/lib/database';
import { emailHelpers } from '~/lib/email';
import { closeTestDb, createTestDb, jsonRequest, readJson } from './helpers';

const ENDPOINT = 'https://sonmyd.co/api/contact';

const base = {
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  message: 'Necesito habilitar la API de WhatsApp para mi empresa.',
};

const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

describe('POST /api/contact — campo de interés', () => {
  let db: DatabaseType.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(() => closeTestDb(db));

  it('persiste un interés válido', async () => {
    const response = await call({ ...base, interest: 'whatsapp-business-api' });
    expect(response.status).toBe(200);

    const [lead] = dbHelpers.getContactForms();
    expect(lead.interest).toBe('whatsapp-business-api');
  });

  // Un interés inválido NO puede costarnos el lead: se guarda como null.
  it('acepta el lead y guarda null cuando el interés es desconocido', async () => {
    const response = await call({ ...base, interest: 'algo-que-no-existe' });
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(dbHelpers.getContactForms()[0].interest).toBeNull();
  });

  it('guarda null cuando no se manda interés', async () => {
    await call(base);
    expect(dbHelpers.getContactForms()[0].interest).toBeNull();
  });

  it('no permite inyectar texto arbitrario en la columna', async () => {
    await call({ ...base, interest: "'; DROP TABLE contact_forms; --" });

    expect(dbHelpers.getContactForms()[0].interest).toBeNull();
    // La tabla sigue viva: la consulta es parametrizada.
    expect(dbHelpers.getContactForms()).toHaveLength(1);
  });

  it('ignora un interés que no sea texto', async () => {
    await call({ ...base, interest: { value: 'ciberseguridad' } });
    expect(dbHelpers.getContactForms()[0].interest).toBeNull();
  });
});

describe('POST /api/contact — página de origen', () => {
  let db: DatabaseType.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(() => closeTestDb(db));

  it('usa la ruta que manda el formulario', async () => {
    await call({ ...base, sourcePage: '/ciberseguridad' }, { referer: 'https://sonmyd.co/otra' });
    expect(dbHelpers.getContactForms()[0].source_page).toBe('/ciberseguridad');
  });

  // El referer se pierde con ciertas políticas del navegador; por eso el
  // formulario manda la ruta, y el header queda solo como respaldo.
  it('cae al referer cuando el formulario no manda la ruta', async () => {
    await call(base, { referer: 'https://sonmyd.co/clases-de-python' });
    expect(dbHelpers.getContactForms()[0].source_page).toBe('https://sonmyd.co/clases-de-python');
  });

  it('guarda null cuando no hay ninguno de los dos', async () => {
    await call(base);
    expect(dbHelpers.getContactForms()[0].source_page).toBeNull();
  });
});

describe('migración de la columna interest', () => {
  afterEach(() => setDb(null));

  it('agrega la columna a una base que ya existía sin ella', () => {
    // Simula el volumen de producción: tabla creada por un despliegue previo.
    const legacy = new Database(':memory:');
    legacy.exec(`
      CREATE TABLE contact_forms (
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
    `);
    legacy.prepare('INSERT INTO contact_forms (name, email, message) VALUES (?, ?, ?)').run('Vieja', 'v@e.com', 'Hola');

    const columnsBefore = (legacy.prepare('PRAGMA table_info(contact_forms)').all() as Array<{ name: string }>).map(
      (column) => column.name
    );
    expect(columnsBefore).not.toContain('interest');

    applySchema(legacy);

    const columnsAfter = (legacy.prepare('PRAGMA table_info(contact_forms)').all() as Array<{ name: string }>).map(
      (column) => column.name
    );
    expect(columnsAfter).toContain('interest');

    // Y lo más importante: los datos que ya estaban siguen ahí.
    const rows = legacy.prepare('SELECT name, interest FROM contact_forms').all() as Array<{
      name: string;
      interest: string | null;
    }>;
    expect(rows).toEqual([{ name: 'Vieja', interest: null }]);

    legacy.close();
  });

  it('es idempotente: correrla dos veces no falla', () => {
    const db = applySchema(new Database(':memory:'));
    expect(() => applySchema(db)).not.toThrow();
    expect(() => applySchema(db)).not.toThrow();
    db.close();
  });

  it('crea el índice sobre interest para poder filtrar por silo', () => {
    const db = applySchema(new Database(':memory:'));
    const indexes = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'contact_forms'").all() as Array<{
        name: string;
      }>
    ).map((index) => index.name);

    expect(indexes).toContain('idx_contact_forms_interest');
    db.close();
  });
});
