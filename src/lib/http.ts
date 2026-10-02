export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const ok = (body: Record<string, unknown> = {}) => json({ success: true, ...body }, 200);
export const badRequest = (error: string) => json({ success: false, error }, 400);
export const unauthorized = () => json({ success: false, error: 'No autorizado' }, 401);
export const conflict = (error: string) => json({ success: false, error }, 409);
export const serverError = () =>
  json({ success: false, error: 'Error interno del servidor. Inténtalo más tarde.' }, 500);

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getClientIp = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';

/**
 * Rate limit en memoria. Suficiente para una sola instancia en Railway, que es
 * exactamente el escenario de este sitio. Si algún día hay más de una réplica
 * hay que mover esto a la base o a un store compartido.
 */
const buckets = new Map<string, number[]>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}

export const rateLimit = ({ key, limit, windowMs, now = Date.now() }: RateLimitOptions): boolean => {
  const hits = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  return true;
};

export const resetRateLimit = () => buckets.clear();

export const tooManyRequests = () =>
  json({ success: false, error: 'Demasiados envíos. Espera unos minutos e inténtalo de nuevo.' }, 429);

/**
 * Parsea el body aceptando JSON y envíos nativos de formulario.
 *
 * Un cuerpo que no se puede leer (JSON roto o vacío, `null`, un arreglo, un
 * Content-Type que no es ninguno de los dos) devuelve `{}`: cada endpoint ya
 * valida sus campos obligatorios y responde 400. Si esto lanzara, el `catch` de
 * cada handler lo trataría como un fallo del servidor: un 500 y un
 * `console.error` por cada bot o cliente roto que golpee el formulario.
 */
export const parseBody = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body: unknown = await request.json();

      return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    }

    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  } catch {
    return {};
  }
};

export const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const asOptionalString = (value: unknown): string | null => {
  const trimmed = asTrimmedString(value);
  return trimmed === '' ? null : trimmed;
};
