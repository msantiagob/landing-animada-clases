import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { POST } from '~/pages/api/contact';
import { emailHelpers } from '~/lib/email';
import { StorageUnavailableError, type LeadStore } from '~/lib/storage';
import { tooLongMessage } from '~/lib/lead-validation';
import { isValidId } from '~/lib/storage/ids';
import { createTestStore, jsonRequest, readJson, resetTestEnvironment } from './helpers';
import { findVoseo } from './voseo';

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
  let store: LeadStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockResolvedValue(true);
  });

  afterEach(resetTestEnvironment);

  it('guarda el lead en el store y responde 200 con su id', async () => {
    const response = await call(validBody);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);

    const contacts = await store.listContacts();
    expect(contacts).toHaveLength(1);

    const [saved] = contacts;
    expect(payload.id).toBe(saved.id);
    expect(isValidId(payload.id)).toBe(true);
    expect(saved.name).toBe('Ana Pérez');
    expect(saved.email).toBe('ana@example.com'); // normalizado a minúsculas
    expect(saved.phone).toBe('+57 300 000 0000');
    expect(saved.company).toBe('Acme');
    expect(saved.status).toBe('new');
    expect(new Date(saved.created_at).toISOString()).toBe(saved.created_at);
    expect(saved.updated_at).toBe(saved.created_at);
  });

  it('recorta los espacios de los campos antes de guardarlos', async () => {
    await call({ ...validBody, name: '  Ana Pérez  ', message: '\n Hola \n', phone: '   ', company: '' });

    const [saved] = await store.listContacts();
    expect(saved.name).toBe('Ana Pérez');
    expect(saved.message).toBe('Hola');
    expect(saved.phone).toBeNull();
    expect(saved.company).toBeNull();
  });

  // Son los datos técnicos que la política de privacidad declara (tests/legal.test.ts).
  it('guarda la IP que pone la plataforma, el navegador y la página de origen', async () => {
    await call(validBody, {
      'x-nf-client-connection-ip': '203.0.113.99',
      'user-agent': 'Vitest/1.0',
      referer: 'https://sonmyd.co/contacto',
    });

    const [saved] = await store.listContacts();
    expect(saved.ip_address).toBe('203.0.113.99');
    expect(saved.user_agent).toBe('Vitest/1.0');
    expect(saved.source_page).toBe('https://sonmyd.co/contacto');
  });

  it('dispara la notificación por email con los datos normalizados', async () => {
    await call(validBody);

    expect(emailHelpers.sendContactFormNotification).toHaveBeenCalledTimes(1);
    expect(emailHelpers.sendContactFormNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com', name: 'Ana Pérez' })
    );
  });

  it('no espera al email para responder: la notificación es en segundo plano', async () => {
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockReturnValue(new Promise(() => undefined));

    const response = await call(validBody);

    expect(response.status).toBe(200);
    expect(await store.listContacts()).toHaveLength(1);
  });

  // En una función serverless lo que sigue después de responder puede quedar congelado:
  // sin waitUntil, el aviso de un lead nuevo se perdería en silencio.
  it('le entrega el email a waitUntil de Netlify para que la función siga viva hasta enviarlo', async () => {
    const waitUntil = vi.fn();

    const response = await POST({
      request: jsonRequest(ENDPOINT, validBody),
      locals: { netlify: { context: { waitUntil } } },
    } as never);

    expect(response.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it('responde 200 aunque falle el envío de email, porque el lead ya está guardado, y deja el fallo en los logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(emailHelpers, 'sendContactFormNotification').mockRejectedValue(new Error('SMTP caído'));

    const response = await call(validBody);

    expect(response.status).toBe(200);
    expect(await store.listContacts()).toHaveLength(1);
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[background]'),
        expect.objectContaining({ message: 'SMTP caído' })
      )
    );
  });

  it.each([
    ['sin nombre', { ...validBody, name: '' }],
    ['sin email', { ...validBody, email: '' }],
    ['sin mensaje', { ...validBody, message: '   ' }],
  ])('rechaza con 400 %s', async (_label, body) => {
    const response = await call(body);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(await store.listContacts()).toHaveLength(0);
    expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
  });

  it('rechaza un email con formato inválido', async () => {
    const response = await call({ ...validBody, email: 'no-es-un-email' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/email inválido/i);
    expect(await store.listContacts()).toHaveLength(0);
  });

  it('rechaza mensajes desmedidos', async () => {
    const response = await call({ ...validBody, message: 'a'.repeat(5001) });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/demasiado largo/i);
    expect(await store.listContacts()).toHaveLength(0);
  });

  it('acepta un mensaje de exactamente 5000 caracteres', async () => {
    const response = await call({ ...validBody, message: 'a'.repeat(5000) });

    expect(response.status).toBe(200);
    expect((await store.listContacts())[0].message).toHaveLength(5000);
  });

  // Un cuerpo ilegible es un error del cliente (bots, clientes rotos): 400, nada
  // guardado y sin un `console.error` por cada intento, que es lo que dejaba el 500.
  it.each([
    ['un JSON roto', '{"name": "Ana", ', 'application/json'],
    ['un JSON vacío', '', 'application/json'],
    ['un JSON que no es un objeto', 'null', 'application/json'],
    ['un Content-Type desconocido', 'name=Ana', 'text/plain'],
  ])('responde 400, y no 500, ante %s', async (_caso, body, contentType) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: new Request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': contentType }, body }),
    } as never);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(await store.listContacts()).toHaveLength(0);
    expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('acepta el envío nativo de un formulario HTML (no solo JSON)', async () => {
    const form = new URLSearchParams({ name: 'Ana', email: 'ana@example.com', message: 'Hola' });

    const response = await POST({
      request: new Request(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      }),
    } as never);

    expect(response.status).toBe(200);
    expect((await store.listContacts())[0].name).toBe('Ana');
  });

  it('descarta bots que completan el honeypot sin guardar nada', async () => {
    const response = await call({ ...validBody, website: 'http://spam.example' });

    expect(response.status).toBe(200);
    expect(await store.listContacts()).toHaveLength(0);
    expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
  });

  it('corta el flood: al sexto envío desde la misma IP responde 429', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.7' };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await call(validBody, headers)).status).toBe(200);
    }

    const blocked = await call(validBody, headers);

    expect(blocked.status).toBe(429);
    expect(await store.listContacts()).toHaveLength(5);
  });

  // El formulario muestra este texto tal cual debajo del botón de envío.
  it('el aviso de demasiados envíos le habla de "tú"', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10' };
    for (let attempt = 0; attempt < 5; attempt += 1) await call(validBody, headers);

    const { error } = await readJson(await call(validBody, headers));

    expect(error).toBe('Demasiados envíos. Espera unos minutos e inténtalo de nuevo.');
    expect(findVoseo(error)).toEqual([]);
  });

  it('el rate limit es por IP, no global', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.8' };
    for (let attempt = 0; attempt < 5; attempt += 1) await call(validBody, headers);

    const other = await call(validBody, { 'x-forwarded-for': '203.0.113.9' });

    expect(other.status).toBe(200);
  });

  /**
   * Cada campo de texto tiene un tope (`FIELD_LIMITS`, el mismo que llevan los formularios como
   * `maxlength`): justo en el tope se acepta y se guarda completo; uno más se rechaza con un 400
   * que dice qué campo es y cuál es el máximo.
   */
  describe('topes de longitud', () => {
    const DOMINIO = '@ejemplo.com';

    /** Un valor de exactamente `length` caracteres que es válido para ese campo. */
    const deLongitud = (field: string, length: number): string =>
      field === 'email' ? 'a'.repeat(length - DOMINIO.length) + DOMINIO : 'a'.repeat(length);

    const CAMPOS = [
      ['name', 100],
      ['email', 254],
      ['phone', 30],
      ['company', 100],
      ['message', 5000],
    ] as const;

    it.each(CAMPOS)('%s: acepta exactamente %i caracteres y lo guarda completo', async (field, max) => {
      const response = await call({ ...validBody, [field]: deLongitud(field, max) });

      expect(response.status).toBe(200);
      const [saved] = await store.listContacts();
      expect(saved[field]).toHaveLength(max);
      expect(saved[field]).toBe(deLongitud(field, max));
    });

    it.each(CAMPOS)('%s: rechaza %i + 1 caracteres con un 400 que lo explica', async (field, max) => {
      const response = await call({ ...validBody, [field]: deLongitud(field, max + 1) });
      const payload = await readJson(response);

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe(tooLongMessage(field));
      expect(payload.error).toContain(`Usa máximo ${max} caracteres`);
      expect(findVoseo(payload.error)).toEqual([]);
      expect(await store.listContacts()).toHaveLength(0);
      expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
    });

    it('los espacios de los extremos no cuentan: 100 caracteres con espacios alrededor se aceptan', async () => {
      const response = await call({ ...validBody, name: `   ${'a'.repeat(100)}   ` });

      expect(response.status).toBe(200);
      expect((await store.listContacts())[0].name).toBe('a'.repeat(100));
    });

    it('un campo opcional vacío o ausente no se mide', async () => {
      expect((await call({ ...validBody, phone: '', company: undefined })).status).toBe(200);
    });

    it('con varios campos pasados de su tope, avisa del primero en el orden del formulario', async () => {
      const response = await call({ ...validBody, message: 'a'.repeat(5001), name: 'a'.repeat(101) });

      expect((await readJson(response)).error).toBe(tooLongMessage('name'));
    });

    it('el tope va antes que el formato: un email desmedido se rechaza por largo, no por mal escrito', async () => {
      const response = await call({ ...validBody, email: 'x'.repeat(300) });

      expect((await readJson(response)).error).toBe(tooLongMessage('email'));
    });

    // La expresión regular del email tarda un tiempo cuadrático ante un texto largo que no encaja
    // (50.000 caracteres son unos 7 segundos de CPU de la función, con una sola petición).
    it('un email adversario de 50.000 caracteres se rechaza al instante, sin llegar a la expresión regular', async () => {
      const inicio = performance.now();

      const response = await call({ ...validBody, email: `a@${'.'.repeat(50_000)} b` });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toBe(tooLongMessage('email'));
      expect(performance.now() - inicio).toBeLessThan(1000);
    });

    it('los obligatorios siguen primero: sin nombre responde "obligatorios" aunque otro campo sea desmedido', async () => {
      const response = await call({ ...validBody, name: '', message: 'a'.repeat(5001) });

      expect((await readJson(response)).error).toMatch(/obligatorios/i);
    });

    describe('la página de origen', () => {
      it('se guarda completa si mide exactamente 2048 caracteres', async () => {
        const sourcePage = `/${'a'.repeat(2047)}`;

        await call({ ...validBody, sourcePage });

        expect((await store.listContacts())[0].source_page).toBe(sourcePage);
      });

      // No la escribe la persona: se recorta en vez de rechazar y perder el lead.
      it('se recorta a 2048 caracteres y el lead se guarda igual', async () => {
        const response = await call({ ...validBody, sourcePage: `/${'a'.repeat(5000)}` });

        expect(response.status).toBe(200);
        expect((await store.listContacts())[0].source_page).toBe(`/${'a'.repeat(2047)}`);
      });

      it('el respaldo del Referer también se recorta', async () => {
        const response = await call(validBody, { referer: `https://sonmyd.co/${'a'.repeat(5000)}` });

        expect(response.status).toBe(200);
        const [saved] = await store.listContacts();
        expect(saved.source_page).toHaveLength(2048);
        expect(saved.source_page?.startsWith('https://sonmyd.co/aaa')).toBe(true);
      });
    });
  });

  describe('cuando el almacenamiento falla', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('devuelve 500 sin filtrar detalles internos ante un error inesperado', async () => {
      vi.spyOn(store, 'createContact').mockRejectedValue(new Error('EACCES: permission denied, open /var/task/leads'));

      const response = await call(validBody);
      const payload = await readJson(response);

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(JSON.stringify(payload)).not.toMatch(/EACCES|\/var\/task/);
      expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('[api/contact] Error procesando formulario:', expect.any(Error));
    });

    // Netlify Blobs caído no es un bug del sitio: la persona puede reintentar.
    it('devuelve 503 reintentable, sin filtrar el fallo de Blobs, y no avisa por email de un lead que no se guardó', async () => {
      const cause = new Error('connect ECONNRESET 10.0.0.1:443');
      vi.spyOn(store, 'createContact').mockRejectedValue(
        new StorageUnavailableError('Netlify Blobs falló al escribir contact/01H', { cause })
      );

      const response = await call(validBody);
      const payload = await readJson(response);

      expect(response.status).toBe(503);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(JSON.stringify(payload)).not.toMatch(/Blobs|ECONNRESET|contact\/01H/);
      expect(emailHelpers.sendContactFormNotification).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('[api/contact] Error procesando formulario:', expect.any(Error));
    });
  });
});
