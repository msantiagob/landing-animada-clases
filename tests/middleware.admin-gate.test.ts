import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '~/middleware';
import { SECURITY_HEADERS } from '~/lib/security-headers';
import { adminCookie, configureAdminEnv, rejectedSessions, resetTestEnvironment } from './helpers';

// `astro:middleware` es un módulo virtual que solo existe dentro de Astro: acá basta con que
// `defineMiddleware` devuelva el handler tal cual.
vi.mock('astro:middleware', () => ({ defineMiddleware: (handler: unknown) => handler }));

const ORIGIN = 'https://sonmyd.co';
const LOGIN = '/admin/login';

/** Pasa una petición por el middleware como lo haría Astro: `url` crudo, `redirect` y `next`. */
const run = async (path: string, cookie?: string) => {
  const url = new URL(`${ORIGIN}${path}`);
  const next = vi.fn(async () => new Response('<html>página</html>', { status: 200 }));
  const redirect = (location: string, status = 302) => new Response(null, { status, headers: { Location: location } });
  const request = new Request(url, { headers: cookie ? { Cookie: cookie } : {} });

  const response = await onRequest({ url, request, redirect } as never, next);

  // El tipo del handler admite `void`, pero este middleware siempre responde algo.
  if (!(response instanceof Response)) throw new Error(`El middleware no devolvió una respuesta para ${path}`);

  return { response, next };
};

describe('middleware: el panel de administración', () => {
  beforeEach(async () => {
    await configureAdminEnv();
  });

  afterEach(resetTestEnvironment);

  describe('sin sesión', () => {
    it.each(['/admin', '/admin/', '/admin/dashboard', '/admin/dashboard/', '/admin/cualquier/cosa'])(
      'redirige %s al login sin renderizar nada',
      async (path) => {
        const { response, next } = await run(path);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(LOGIN);
        expect(next).not.toHaveBeenCalled();
      }
    );

    it.each([LOGIN, `${LOGIN}/`])('deja pasar %s: es la pantalla para entrar', async (path) => {
      const { response, next } = await run(path);

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalledTimes(1);
    });

    // Astro enruta con decodeURI(pathname), pero `url.pathname` conserva los %xx: sin normalizarlo,
    // "/%61dmin/dashboard" no empieza con "/admin" para el middleware y aun así llega a esa página.
    it.each([
      '/%61dmin/dashboard',
      '/%61dmin',
      '/ad%6Din/dashboard',
      '/admin/%64ashboard',
      '/admin/dashboard%2F..%2Fdashboard',
    ])('no se esquiva escribiendo la ruta con %%xx: %s', async (path) => {
      const { response, next } = await run(path);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(LOGIN);
      expect(next).not.toHaveBeenCalled();
    });

    it('la pantalla de login escrita con %xx sigue siendo la pantalla de login, no un bucle', async () => {
      const { response, next } = await run('/admin/%6Cogin');

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('un %xx mal formado no hace fallar al middleware', async () => {
      const { response } = await run('/admin/%E0%A4%A');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(LOGIN);
    });

    // El prefijo es "/admin" como carpeta, no como texto: una página pública cuyo nombre empiece
    // por "admin" (p. ej. una landing de administración de servidores) no es del panel.
    it.each(['/administracion-de-servidores', '/administrador-de-bases-de-datos', '/adminer'])(
      'no confunde la página pública %s con el panel',
      async (path) => {
        const { response, next } = await run(path);

        expect(response.status).toBe(200);
        expect(next).toHaveBeenCalledTimes(1);
      }
    );

    it.each(['/', '/blog', '/api/contact', '/api/admin/leads', '/privacidad'])(
      'no toca %s: esas rutas se protegen por sí solas o son públicas',
      async (path) => {
        const { next } = await run(path);

        expect(next).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe('con una sesión que no sirve', () => {
    it.each(rejectedSessions().filter(([, cookie]) => cookie !== undefined))(
      'redirige /admin/dashboard ante %s',
      async (_label, cookie) => {
        const { response, next } = await run('/admin/dashboard', cookie);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(LOGIN);
        expect(next).not.toHaveBeenCalled();
      }
    );

    it('redirige también si el panel quedó sin configurar, aunque la cookie esté bien firmada', async () => {
      const cookie = adminCookie();
      await configureAdminEnv({ secret: '' });

      const { response, next } = await run('/admin/dashboard', cookie);

      expect(response.status).toBe(302);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('con la sesión del administrador', () => {
    it.each(['/admin/dashboard', '/%61dmin/dashboard', LOGIN])('deja pasar %s', async (path) => {
      const { response, next } = await run(path, adminCookie());

      expect(response.status).toBe(200);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('cabeceras de seguridad', () => {
    const expectSecurityHeaders = (response: Response) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers.get(name), name).toBe(value);
      }
    };

    it('van en las páginas que se sirven', async () => {
      expectSecurityHeaders((await run('/')).response);
      expectSecurityHeaders((await run('/admin/dashboard', adminCookie())).response);
    });

    it('van también en la redirección al login', async () => {
      expectSecurityHeaders((await run('/admin/dashboard')).response);
    });
  });
});
