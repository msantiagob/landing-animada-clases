import { defineMiddleware } from 'astro:middleware';
import { authHelpers } from './lib/auth';

const LOGIN_PATH = '/admin/login';

/**
 * Las páginas de /admin quedaban accesibles a cualquiera: protegían los datos
 * en la API pero servían el HTML igual. Acá se corta antes de renderizar.
 */
export const onRequest = defineMiddleware(({ url, request, redirect }, next) => {
  const { pathname } = url;

  if (!pathname.startsWith('/admin')) return next();
  if (pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`) return next();

  return authHelpers.requireAdmin(request) ? next() : redirect(LOGIN_PATH, 302);
});
