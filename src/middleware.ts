import { defineMiddleware } from 'astro:middleware';
import { authHelpers } from './lib/auth';
import { withSecurityHeaders } from './lib/security-headers';

const PANEL_PATH = '/admin';
const LOGIN_PATH = '/admin/login';

/**
 * La ruta tal como la enruta Astro. Astro elige la página con `decodeURI(pathname)`,
 * pero `url.pathname` conserva los `%xx`: sin esto, "/%61dmin/dashboard" no empezaría
 * con "/admin" para el middleware y aun así llegaría a esa página. Un `%xx` mal formado
 * se deja como viene (Astro tampoco puede enrutarlo).
 */
const routedPathname = (pathname: string): string => {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
};

/** `/admin` como carpeta, no como texto: `/administracion-de-servidores` es una página pública. */
const isPanelPath = (pathname: string): boolean => pathname === PANEL_PATH || pathname.startsWith(`${PANEL_PATH}/`);

const isLoginPath = (pathname: string): boolean => pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`;

/**
 * Las páginas de /admin quedaban accesibles a cualquiera: protegían los datos
 * en la API pero servían el HTML igual. Acá se corta antes de renderizar.
 *
 * Además pone las cabeceras de seguridad en todas las respuestas de la función
 * (ver security-headers.ts).
 */
export const onRequest = defineMiddleware(async ({ url, request, redirect }, next) => {
  const pathname = routedPathname(url.pathname);

  const isPrivate = isPanelPath(pathname) && !isLoginPath(pathname);

  if (isPrivate && !authHelpers.requireAdmin(request)) return withSecurityHeaders(redirect(LOGIN_PATH, 302));

  return withSecurityHeaders(await next());
});
