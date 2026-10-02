import { beforeEach, describe, expect, it } from 'vitest';
import {
  asOptionalString,
  asTrimmedString,
  badRequest,
  conflict,
  getClientIp,
  json,
  ok,
  parseBody,
  rateLimit,
  resetRateLimit,
  serverError,
  tooManyRequests,
  unauthorized,
} from '~/lib/http';
import { findVoseo } from './voseo';

describe('json', () => {
  it('serializa el cuerpo con el content-type correcto', async () => {
    const response = json({ ok: true }, 201, { 'X-Custom': 'yes' });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-custom')).toBe('yes');
    expect(await response.json()).toEqual({ ok: true });
  });
});

/**
 * El formulario muestra el `error` del cuerpo tal cual (`postJson` no lo
 * reescribe), así que el texto de estas respuestas es copy del sitio: importa
 * tanto como el código de estado.
 */
describe('respuestas estándar de la API', () => {
  it('ok responde 200 con success y mezcla el cuerpo', async () => {
    const response = ok({ id: 7, message: 'Listo' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: 7, message: 'Listo' });
  });

  it('ok sin cuerpo responde solo success', async () => {
    expect(await ok().json()).toEqual({ success: true });
  });

  it('badRequest responde 400 con el motivo que se le pasa', async () => {
    const response = badRequest('Nombre, email y mensaje son obligatorios');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'Nombre, email y mensaje son obligatorios' });
  });

  it('conflict responde 409 con el motivo que se le pasa', async () => {
    const response = conflict('Ese horario ya no está disponible.');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'Ese horario ya no está disponible.' });
  });

  it('unauthorized responde 401 sin explicar por qué', async () => {
    const response = unauthorized();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'No autorizado' });
  });

  it('serverError responde 500 con un mensaje genérico que no filtra detalles internos', async () => {
    const response = serverError();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Error interno del servidor. Inténtalo más tarde.',
    });
  });

  it('tooManyRequests responde 429 y le pide a la persona esperar antes de reintentar', async () => {
    const response = tooManyRequests();

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Demasiados envíos. Espera unos minutos e inténtalo de nuevo.',
    });
  });

  // El sitio habla en español de Colombia: "tú", nunca voseo rioplatense.
  it.each([
    ['serverError', serverError],
    ['tooManyRequests', tooManyRequests],
    ['unauthorized', unauthorized],
  ])('el mensaje fijo de %s no usa voseo', async (_nombre, build) => {
    const { error } = await build().json();

    expect(findVoseo(error)).toEqual([]);
  });
});

describe('getClientIp', () => {
  it('toma la primera IP de x-forwarded-for, que es la del cliente real', () => {
    const request = new Request('https://sonmyd.co', {
      headers: { 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' },
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('cae a x-real-ip cuando no hay x-forwarded-for', () => {
    const request = new Request('https://sonmyd.co', { headers: { 'x-real-ip': '198.51.100.1' } });

    expect(getClientIp(request)).toBe('198.51.100.1');
  });

  it('devuelve unknown si no hay ninguna cabecera', () => {
    expect(getClientIp(new Request('https://sonmyd.co'))).toBe('unknown');
  });
});

describe('rateLimit', () => {
  beforeEach(() => resetRateLimit());

  it('permite hasta el límite y bloquea a partir de ahí', () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(rateLimit({ key: 'a', limit: 3, windowMs: 1000 })).toBe(true);
    }

    expect(rateLimit({ key: 'a', limit: 3, windowMs: 1000 })).toBe(false);
  });

  it('aísla las claves entre sí', () => {
    rateLimit({ key: 'a', limit: 1, windowMs: 1000 });

    expect(rateLimit({ key: 'a', limit: 1, windowMs: 1000 })).toBe(false);
    expect(rateLimit({ key: 'b', limit: 1, windowMs: 1000 })).toBe(true);
  });

  it('libera la cuota cuando la ventana expira', () => {
    const start = 1_000_000;

    expect(rateLimit({ key: 'a', limit: 1, windowMs: 1000, now: start })).toBe(true);
    expect(rateLimit({ key: 'a', limit: 1, windowMs: 1000, now: start + 500 })).toBe(false);
    expect(rateLimit({ key: 'a', limit: 1, windowMs: 1000, now: start + 1500 })).toBe(true);
  });

  it('no acumula intentos viejos indefinidamente', () => {
    const start = 1_000_000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      rateLimit({ key: 'a', limit: 5, windowMs: 1000, now: start });
    }

    // Ventana vencida: la cuota completa vuelve a estar disponible.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(rateLimit({ key: 'a', limit: 5, windowMs: 1000, now: start + 2000 })).toBe(true);
    }
  });
});

describe('parseBody', () => {
  it('parsea JSON', async () => {
    const request = new Request('https://sonmyd.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    });

    expect(await parseBody(request)).toEqual({ name: 'Ana' });
  });

  it('parsea un envío nativo de formulario, para que funcione sin JavaScript', async () => {
    const form = new URLSearchParams({ name: 'Ana', email: 'ana@example.com' });
    const request = new Request('https://sonmyd.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    expect(await parseBody(request)).toEqual({ name: 'Ana', email: 'ana@example.com' });
  });

  // Un body ilegible es un error del cliente, no del servidor: parseBody devuelve
  // `{}` y la validación de cada endpoint responde 400. Si lanzara, el `catch` del
  // handler lo convertiría en un 500 (y en un `console.error` por cada bot).
  describe('con un cuerpo que no se puede leer', () => {
    const post = (body: BodyInit | null, contentType?: string) =>
      new Request('https://sonmyd.co', {
        method: 'POST',
        headers: contentType ? { 'Content-Type': contentType } : {},
        body,
      });

    it('devuelve un objeto vacío si el JSON está roto', async () => {
      expect(await parseBody(post('{"name": "Ana", ', 'application/json'))).toEqual({});
    });

    it('devuelve un objeto vacío si el JSON viene vacío', async () => {
      expect(await parseBody(post('', 'application/json'))).toEqual({});
    });

    it('acepta el Content-Type JSON con charset', async () => {
      expect(await parseBody(post('{"name":"Ana"}', 'application/json; charset=utf-8'))).toEqual({ name: 'Ana' });
    });

    it.each([
      ['null', 'null'],
      ['un arreglo', '[{"name":"Ana"}]'],
      ['un texto', '"hola"'],
      ['un número', '42'],
      ['un booleano', 'true'],
    ])('devuelve un objeto vacío si el JSON válido es %s y no un objeto', async (_caso, json) => {
      expect(await parseBody(post(json, 'application/json'))).toEqual({});
    });

    it('devuelve un objeto vacío con un Content-Type que no es JSON ni formulario', async () => {
      expect(await parseBody(post('name=Ana', 'text/plain'))).toEqual({});
    });

    it('devuelve un objeto vacío si la petición no declara Content-Type', async () => {
      expect(await parseBody(post(new Uint8Array([110, 97, 109, 101])))).toEqual({});
    });

    it('devuelve un objeto vacío si el formulario multipart viene truncado', async () => {
      const truncated = post(
        '--frontera\r\nContent-Disposition: form-data; name="name"\r\n\r\nAna',
        'multipart/form-data; boundary=frontera'
      );

      expect(await parseBody(truncated)).toEqual({});
    });
  });
});

describe('normalizadores de entrada', () => {
  it('asTrimmedString recorta y descarta lo que no sea texto', () => {
    expect(asTrimmedString('  hola  ')).toBe('hola');
    expect(asTrimmedString(42)).toBe('');
    expect(asTrimmedString(null)).toBe('');
    expect(asTrimmedString(undefined)).toBe('');
  });

  it('asOptionalString convierte el vacío en null para no guardar cadenas vacías', () => {
    expect(asOptionalString('  Acme ')).toBe('Acme');
    expect(asOptionalString('   ')).toBeNull();
    expect(asOptionalString(undefined)).toBeNull();
  });
});
