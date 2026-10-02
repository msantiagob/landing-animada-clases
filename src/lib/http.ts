import { StorageUnavailableError } from './storage/errors';

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
export const serviceUnavailable = (error: string) => json({ success: false, error }, 503);

/** El almacenamiento no responde: es un fallo temporal, no un bug. La persona puede reintentar. */
export const storageUnavailable = () =>
  serviceUnavailable('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');

/**
 * Respuesta para el `catch` de cada endpoint. Un almacenamiento caído es un 503
 * (reintentable); cualquier otra cosa es un 500 genérico que no filtra detalles.
 */
export const failureResponse = (error: unknown) =>
  error instanceof StorageUnavailableError ? storageUnavailable() : serverError();

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * IP del cliente. En Netlify, `x-nf-client-connection-ip` la pone la plataforma
 * y un cliente no puede falsearla; `x-forwarded-for` en cambio llega con lo que
 * el cliente haya mandado como primer valor, así que solo se usa si falta la otra.
 */
export const getClientIp = (request: Request): string =>
  request.headers.get('x-nf-client-connection-ip')?.trim() ||
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  request.headers.get('x-real-ip') ||
  'unknown';

/**
 * Rate limit en memoria, POR INSTANCIA. En funciones serverless cada instancia
 * lleva su propia cuenta y se descarta cuando Netlify la apaga, así que es un
 * freno de mejor esfuerzo: corta a un bot que insiste contra la misma instancia
 * (el login y los formularios) pero no es un límite global exacto. Si hiciera
 * falta uno exacto, tendría que vivir en un store compartido.
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
