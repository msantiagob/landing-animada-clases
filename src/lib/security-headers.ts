/**
 * Cabeceras de seguridad de TODAS las respuestas del sitio.
 *
 * Existen en dos lugares a propósito, y tests/netlify-config.test.ts comprueba
 * que digan lo mismo:
 * - netlify.toml, para lo que Netlify sirve como archivo (las páginas
 *   prerenderizadas del blog y los assets).
 * - El middleware (src/middleware.ts), para lo que genera la función: la
 *   inmensa mayoría de las páginas y toda la API. Netlify NO aplica las
 *   cabeceras personalizadas a las respuestas de una función, y sin esto
 *   saldrían sin ninguna.
 *
 * HSTS sin `includeSubDomains` ni `preload`: son compromisos que afectan a todo
 * el dominio (correo, subdominios) y no se deshacen rápido. Se pueden sumar
 * cuando se confirme que todo cuelga de HTTPS.
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
} as const;

/**
 * Devuelve la respuesta con las cabeceras puestas. Algunas respuestas (las de
 * `Response.redirect()` o las de un `fetch`) tienen cabeceras de solo lectura;
 * en ese caso se arma una respuesta nueva con el mismo cuerpo.
 */
export const withSecurityHeaders = (response: Response): Response => {
  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);

    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
