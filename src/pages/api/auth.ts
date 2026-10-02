import type { APIRoute } from 'astro';
import { authHelpers, buildAuthCookie, buildLogoutCookie } from '../../lib/auth';
import {
  asTrimmedString,
  badRequest,
  getClientIp,
  json,
  ok,
  parseBody,
  rateLimit,
  serverError,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
} from '../../lib/http';

export const prerender = false;

/**
 * Acá NO hay acción de registro. La versión anterior exponía `action: 'register'`
 * de forma pública: cualquiera podía crearse un usuario con rol admin. Ahora hay
 * un único administrador, definido por variables de entorno (ADMIN_EMAIL y
 * ADMIN_PASSWORD_HASH); el hash se genera con `npm run hash-password`.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await parseBody(request);
    const action = asTrimmedString(body.action);

    if (action === 'logout') {
      return json({ success: true, message: 'Sesión cerrada' }, 200, { 'Set-Cookie': buildLogoutCookie() });
    }

    if (action !== 'login') return badRequest('Acción no válida');

    // Sin las variables de entorno nadie puede entrar. Se avisa con claridad (y
    // en los logs, QUÉ falta, sin valores) en vez de contestar "credenciales
    // inválidas", que mandaría a buscar el problema en la contraseña.
    const config = authHelpers.configStatus();

    if (!config.configured) {
      console.error(`[api/auth] El panel no está configurado. Falta o no es válido: ${config.missing.join(', ')}`);
      return serviceUnavailable('El acceso al panel todavía no está configurado en el servidor.');
    }

    const email = asTrimmedString(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) return badRequest('Email y contraseña son obligatorios');

    // Freno de fuerza bruta por IP (por instancia: ver el comentario de rateLimit).
    if (!rateLimit({ key: `login:${getClientIp(request)}`, limit: 8, windowMs: 15 * 60 * 1000 })) {
      return tooManyRequests();
    }

    const result = await authHelpers.login(email, password);
    if (!result) return json({ success: false, error: 'Credenciales inválidas' }, 401);

    // El token viaja solo en la cookie httpOnly; devolverlo en el body lo
    // dejaría accesible desde JavaScript y anularía la protección contra XSS.
    return json({ success: true, user: result.user }, 200, { 'Set-Cookie': buildAuthCookie(result.token) });
  } catch (error) {
    console.error('[api/auth] Error en autenticación:', error);
    return serverError();
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = authHelpers.requireAuthFromCookies(request);
    if (!session) return unauthorized();

    return ok({ user: { email: session.email, role: session.role } });
  } catch (error) {
    console.error('[api/auth] Error verificando autenticación:', error);
    return serverError();
  }
};
