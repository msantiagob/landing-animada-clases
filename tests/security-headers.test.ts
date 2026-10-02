import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, withSecurityHeaders } from '~/lib/security-headers';

/**
 * Cabeceras de seguridad de todas las respuestas de la función (las pone el middleware,
 * porque Netlify no aplica las de netlify.toml a lo que genera una función). Que las
 * respuestas del middleware las lleven está probado en tests/middleware.admin-gate.test.ts y
 * que netlify.toml diga lo mismo, en tests/netlify-config.test.ts. Acá, la lista y la función.
 */

const EXPECTED = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
};

const expectSecurityHeaders = (response: Response) => {
  for (const [name, value] of Object.entries(EXPECTED)) expect(response.headers.get(name), name).toBe(value);
};

describe('SECURITY_HEADERS', () => {
  it('son exactamente estas cuatro, con estos valores', () => {
    expect(SECURITY_HEADERS).toEqual(EXPECTED);
  });

  it('el navegador no adivina el tipo de contenido ni deja que enmarquen el sitio', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('el Referer cruza a otros sitios solo con el origen, nunca con la ruta ni la consulta', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  // Decisión documentada en security-headers.ts: includeSubDomains y preload comprometen a todo
  // el dominio (correo, subdominios) y no se deshacen rápido, así que NO se ponen todavía.
  it('HSTS dura un año y NO incluye includeSubDomains ni preload', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'];

    expect(hsts).toBe('max-age=31536000');
    expect(31_536_000).toBe(365 * 24 * 60 * 60);
    expect(hsts).not.toMatch(/includeSubDomains|preload/i);
  });

  it('los nombres son cabeceras HTTP válidas y los valores no llevan saltos de línea', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(() => new Headers({ [name]: value }), name).not.toThrow();
      expect(value, name).not.toMatch(/[\r\n]/);
    }
  });
});

describe('withSecurityHeaders', () => {
  it('pone las cuatro cabeceras y devuelve la misma respuesta', () => {
    const response = new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });

    const result = withSecurityHeaders(response);

    expect(result).toBe(response);
    expectSecurityHeaders(result);
  });

  it('no toca el estado, el cuerpo ni las demás cabeceras', async () => {
    const response = new Response('{"success":true}', {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: '"abc"' },
    });

    const result = withSecurityHeaders(response);

    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
    expect(result.headers.get('Content-Type')).toBe('application/json');
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.headers.get('ETag')).toBe('"abc"');
    expect(await result.text()).toBe('{"success":true}');
  });

  it('conserva todas las cookies de sesión (set-cookie repetido)', () => {
    const response = new Response(null, { status: 200 });
    response.headers.append('Set-Cookie', 'auth-token=abc; Path=/; HttpOnly');
    response.headers.append('Set-Cookie', 'otra=1; Path=/');

    const result = withSecurityHeaders(response);

    expect(result.headers.getSetCookie()).toEqual(['auth-token=abc; Path=/; HttpOnly', 'otra=1; Path=/']);
    expectSecurityHeaders(result);
  });

  it.each([200, 204, 302, 400, 401, 404, 429, 500, 503])('también en una respuesta %i', (status) => {
    const body = status === 204 ? null : 'x';
    const result = withSecurityHeaders(new Response(body, { status }));

    expect(result.status).toBe(status);
    expectSecurityHeaders(result);
  });

  // Si una página o la API ya puso su propia cabecera, manda la del sitio: es la política común.
  it('reemplaza una cabecera de seguridad que la respuesta ya traía en vez de sumarle otra', () => {
    const response = new Response('x', {
      headers: { 'X-Frame-Options': 'SAMEORIGIN', 'Strict-Transport-Security': 'max-age=1' },
    });

    const result = withSecurityHeaders(response);

    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    expect(result.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
  });

  it('las cabeceras se ponen sin importar mayúsculas: no quedan duplicadas con otro nombre', () => {
    const response = new Response('x', { headers: { 'x-content-type-options': 'sniff' } });

    const result = withSecurityHeaders(response);

    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect([...result.headers.keys()].filter((name) => name === 'x-content-type-options')).toHaveLength(1);
  });

  it('es idempotente: pasarla dos veces da el mismo resultado', () => {
    const once = withSecurityHeaders(new Response('x'));
    const twice = withSecurityHeaders(once);

    expect([...twice.headers.entries()]).toEqual([...once.headers.entries()]);
  });

  describe('respuestas con cabeceras de solo lectura', () => {
    // `Response.redirect()` (lo que usa Astro para redirigir) y las respuestas de un `fetch`
    // tienen las cabeceras inmutables: `headers.set` lanza TypeError. Sin el respaldo, el
    // middleware fallaría justo en la redirección al login.
    it('una redirección de Response.redirect() sale con las cabeceras, el mismo estado y el mismo destino', () => {
      const redirect = Response.redirect('https://sonmyd.co/admin/login', 302);
      expect(() => redirect.headers.set('X-Test', '1')).toThrow(TypeError);

      const result = withSecurityHeaders(redirect);

      expect(result).not.toBe(redirect);
      expect(result.status).toBe(302);
      expect(result.headers.get('Location')).toBe('https://sonmyd.co/admin/login');
      expectSecurityHeaders(result);
    });

    it.each([301, 303, 307, 308])('conserva el estado %i de la redirección', (status) => {
      const result = withSecurityHeaders(Response.redirect('https://sonmyd.co/', status));

      expect(result.status).toBe(status);
      expectSecurityHeaders(result);
    });

    // Se simula la respuesta de un fetch: cuerpo en streaming, estado, texto y cabeceras que no se pueden modificar.
    it('reconstruye la respuesta con el mismo cuerpo, estado, texto y cabeceras', async () => {
      const upstream = new Headers({ 'Content-Type': 'text/plain', 'X-Origen': 'proveedor' });
      Object.defineProperty(upstream, 'set', {
        value: () => {
          throw new TypeError('immutable');
        },
      });
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('contenido en streaming'));
          controller.close();
        },
      });
      const readOnly = { status: 203, statusText: 'Non-Authoritative', headers: upstream, body } as unknown as Response;

      const result = withSecurityHeaders(readOnly);

      expect(result.status).toBe(203);
      expect(result.statusText).toBe('Non-Authoritative');
      expect(result.headers.get('Content-Type')).toBe('text/plain');
      expect(result.headers.get('X-Origen')).toBe('proveedor');
      expectSecurityHeaders(result);
      expect(await result.text()).toBe('contenido en streaming');
    });

    it('la respuesta original no se modifica en el camino de respaldo', () => {
      const redirect = Response.redirect('https://sonmyd.co/', 302);

      withSecurityHeaders(redirect);

      expect(redirect.headers.get('X-Frame-Options')).toBeNull();
      expect(redirect.headers.get('Strict-Transport-Security')).toBeNull();
    });
  });
});
