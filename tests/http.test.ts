import { beforeEach, describe, expect, it } from 'vitest';
import { asOptionalString, asTrimmedString, getClientIp, json, parseBody, rateLimit, resetRateLimit } from '~/lib/http';

describe('json', () => {
  it('serializa el cuerpo con el content-type correcto', async () => {
    const response = json({ ok: true }, 201, { 'X-Custom': 'yes' });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-custom')).toBe('yes');
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('getClientIp', () => {
  it('toma la primera IP de x-forwarded-for, que es la del cliente real', () => {
    const request = new Request('https://sonmyd.com', {
      headers: { 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' },
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('cae a x-real-ip cuando no hay x-forwarded-for', () => {
    const request = new Request('https://sonmyd.com', { headers: { 'x-real-ip': '198.51.100.1' } });

    expect(getClientIp(request)).toBe('198.51.100.1');
  });

  it('devuelve unknown si no hay ninguna cabecera', () => {
    expect(getClientIp(new Request('https://sonmyd.com'))).toBe('unknown');
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
    const request = new Request('https://sonmyd.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    });

    expect(await parseBody(request)).toEqual({ name: 'Ana' });
  });

  it('parsea un envío nativo de formulario, para que funcione sin JavaScript', async () => {
    const form = new URLSearchParams({ name: 'Ana', email: 'ana@example.com' });
    const request = new Request('https://sonmyd.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    expect(await parseBody(request)).toEqual({ name: 'Ana', email: 'ana@example.com' });
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
