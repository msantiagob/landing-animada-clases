import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '~/pages/api/contact';
import { dbHelpers } from '~/lib/database';
import { emailHelpers } from '~/lib/email';
import { closeTestDb, createTestDb, jsonRequest, readJson } from './helpers';

const ENDPOINT = 'https://sonmyd.co/api/contact';

const validBody = {
  name: 'Ana Pérez',
  email: 'Ana@Example.com',
  message: 'Quiero clases de IA para mi equipo.',
  phone: '+57 300 000 0000',
  company: 'Acme',
};

const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

describe('POST /api/contact', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(() => closeTestDb(db));

  it('guarda el lead y responde 200', async () => {
    const response = await call(validBody);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.id).toBeTypeOf('number');

    const [saved] = dbHelpers.getContactForms();
    expect(saved.name).toBe('Ana Pérez');
    expect(saved.email).toBe('ana@example.com'); // normalizado a minúsculas
    expect(saved.company).toBe('Acme');
    expect(saved.status).toBe('new');
  });

  it('dispara la notificación por email sin bloquear la respuesta', async () => {
    await call(validBody);

    expect(emailHelpers.sendContactFormNotification).toHaveBeenCalledTimes(1);
    expect(emailHelpers.sendContactFormNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com' })
    );
  });

  it('responde 200 aunque falle el envío de email, porque el lead ya está guardado', async () => {
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockRejectedValue(new Error('SMTP caído'));

    const response = await call(validBody);

    expect(response.status).toBe(200);
    expect(dbHelpers.getContactForms()).toHaveLength(1);
  });

  it.each([
    ['sin nombre', { ...validBody, name: '' }],
    ['sin email', { ...validBody, email: '' }],
    ['sin mensaje', { ...validBody, message: '   ' }],
  ])('rechaza con 400 %s', async (_label, body) => {
    const response = await call(body);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(dbHelpers.getContactForms()).toHaveLength(0);
  });

  it('rechaza un email con formato inválido', async () => {
    const response = await call({ ...validBody, email: 'no-es-un-email' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/email inválido/i);
  });

  it('rechaza mensajes desmedidos', async () => {
    const response = await call({ ...validBody, message: 'a'.repeat(5001) });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/demasiado largo/i);
  });

  it('descarta bots que completan el honeypot sin guardar nada', async () => {
    const response = await call({ ...validBody, website: 'http://spam.example' });

    expect(response.status).toBe(200);
    expect(dbHelpers.getContactForms()).toHaveLength(0);
    expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
  });

  it('corta el flood: al sexto envío desde la misma IP responde 429', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.7' };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await call(validBody, headers)).status).toBe(200);
    }

    const blocked = await call(validBody, headers);

    expect(blocked.status).toBe(429);
    expect(dbHelpers.getContactForms()).toHaveLength(5);
  });

  it('el rate limit es por IP, no global', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.8' };
    for (let attempt = 0; attempt < 5; attempt += 1) await call(validBody, headers);

    const other = await call(validBody, { 'x-forwarded-for': '203.0.113.9' });

    expect(other.status).toBe(200);
  });

  it('devuelve 500 sin filtrar detalles internos si la base falla', async () => {
    vi.spyOn(dbHelpers, 'insertContactForm').mockImplementation(() => {
      throw new Error('SQLITE_READONLY: attempt to write a readonly database');
    });

    const response = await call(validBody);
    const payload = await readJson(response);

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('SQLITE_READONLY');
  });
});
