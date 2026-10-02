import { getStore } from '@netlify/blobs';
import type { BlobsClient } from '~/lib/storage/blobs';

/**
 * Servidor falso de la API HTTP de Netlify Blobs, para correr el cliente REAL
 * (`getStore` de @netlify/blobs) contra él en vez de contra un doble de su API.
 *
 * El doble de tests/storage/fake-blobs.ts reproduce lo que el cliente promete;
 * este comprueba que lo prometido es verdad: validación de claves, el 412 de
 * `onlyIfNew` (cabecera `if-none-match: *`), la paginación de `list`, los
 * reintentos ante 5xx y la rareza de que una escritura condicional informe
 * `modified: true` ante un 5xx. Si una actualización de @netlify/blobs cambia
 * alguna de esas conductas, falla acá y no en producción.
 *
 * Protocolo (modo "edge", el que usa el cliente dentro de una función de Netlify):
 *   GET    /{siteID}/{store}/{clave}        200 con el cuerpo, o 404
 *   GET    /{siteID}/{store}?prefix&cursor  200 { blobs: [{ key, etag }], next_cursor? }
 *   PUT    /{siteID}/{store}/{clave}        200 con `etag`; 412 si hay `if-none-match: *` y la clave existe
 *   DELETE /{siteID}/{store}/{clave}        204, o 404 si no existía
 */

export const SITE_ID = 'site-de-prueba';
export const EDGE_URL = 'https://edge.blobs.test';
export const UNCACHED_EDGE_URL = 'https://uncached.blobs.test';

export interface ServerRequest {
  method: string;
  store: string;
  key: string | null;
  headers: Record<string, string>;
  /** Host al que se dirigió: el "sin caché" es el de las lecturas con consistencia fuerte. */
  host: string;
  search: URLSearchParams;
}

interface Rule {
  method: string;
  status: number;
  key?: string | RegExp;
  skip: number;
  times: number;
  /** Aplica la escritura y recién después responde con el error: una respuesta que se pierde en el camino. */
  applyFirst: boolean;
}

const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export class FakeBlobsServer {
  readonly requests: ServerRequest[] = [];

  readonly #stores = new Map<string, Map<string, { raw: string; etag: string }>>();
  readonly #rules: Rule[] = [];
  readonly #random: () => number;
  readonly #maxYields: number;
  readonly #pageSize: number;
  #version = 0;

  constructor({ seed = 1, maxYields = 3, pageSize = 1000 } = {}) {
    this.#random = mulberry32(seed);
    this.#maxYields = maxYields;
    this.#pageSize = pageSize;
  }

  /** El cliente real de @netlify/blobs apuntado a este servidor, con la misma configuración que index.ts. */
  client(): BlobsClient {
    return getStore({
      name: 'leads',
      consistency: 'strong',
      siteID: SITE_ID,
      token: 'token-de-prueba',
      edgeURL: EDGE_URL,
      uncachedEdgeURL: UNCACHED_EDGE_URL,
      fetch: this.fetch,
    });
  }

  /** Responde `status` a las próximas `times` peticiones `method` que coincidan (tras dejar pasar `skip`). */
  respondWith(
    method: string,
    status: number,
    { key, skip = 0, times = 1, applyFirst = false }: Partial<Pick<Rule, 'key' | 'skip' | 'times' | 'applyFirst'>> = {}
  ): void {
    this.#rules.push({ method, status, key, skip, times, applyFirst });
  }

  keys(prefix = ''): string[] {
    const entries = this.#stores.get('site:leads');

    return entries ? [...entries.keys()].filter((key) => key.startsWith(prefix)).sort() : [];
  }

  requestsTo(method: string): ServerRequest[] {
    return this.requests.filter((request) => request.method === method);
  }

  readonly fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const [siteId, store, ...rest] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const key = rest.length > 0 ? rest.join('/') : null;
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value])
    );

    this.requests.push({ method, store, key, headers, host: url.host, search: url.searchParams });
    await this.#latency();

    if (siteId !== SITE_ID || headers.authorization !== 'Bearer token-de-prueba')
      return new Response(null, { status: 401 });

    const rule = this.#matchingRule(method, key);
    if (rule && !rule.applyFirst) return new Response(null, { status: rule.status });

    const response = this.#handle(method, store, key, String(init.body ?? ''), headers, url.searchParams);
    await this.#latency();

    return rule ? new Response(null, { status: rule.status }) : response;
  };

  #handle(
    method: string,
    store: string,
    key: string | null,
    body: string,
    headers: Record<string, string>,
    search: URLSearchParams
  ): Response {
    const entries = this.#stores.get(store) ?? new Map();
    this.#stores.set(store, entries);

    if (method === 'GET' && key === null) return this.#list(entries, search);
    if (key === null) return new Response(null, { status: 400 });

    if (method === 'GET') {
      const entry = entries.get(key);

      return entry ? new Response(entry.raw, { status: 200 }) : new Response(null, { status: 404 });
    }

    if (method === 'PUT') {
      if (headers['if-none-match'] === '*' && entries.has(key)) return new Response(null, { status: 412 });

      this.#version += 1;
      const etag = `"etag-${this.#version}"`;
      entries.set(key, { raw: body, etag });

      return new Response(null, { status: 200, headers: { etag } });
    }

    if (method === 'DELETE') return new Response(null, { status: entries.delete(key) ? 204 : 404 });

    return new Response(null, { status: 405 });
  }

  #list(entries: Map<string, { raw: string; etag: string }>, search: URLSearchParams): Response {
    const prefix = search.get('prefix') ?? '';
    const cursor = search.get('cursor');
    const matching = [...entries.keys()].filter((key) => key.startsWith(prefix)).sort();
    const remaining = cursor === null ? matching : matching.filter((key) => key > cursor);
    const page = remaining.slice(0, this.#pageSize);
    const next = remaining.length > page.length ? { next_cursor: page[page.length - 1] } : {};

    return Response.json({
      blobs: page.map((key) => ({ key, etag: entries.get(key)?.etag })),
      directories: [],
      ...next,
    });
  }

  #matchingRule(method: string, key: string | null): Rule | undefined {
    const rule = this.#rules.find(
      (candidate) =>
        candidate.method === method &&
        candidate.times > 0 &&
        (candidate.key === undefined ||
          (key !== null && (typeof candidate.key === 'string' ? candidate.key === key : candidate.key.test(key))))
    );

    if (!rule) return undefined;

    if (rule.skip > 0) {
      rule.skip -= 1;
      return undefined;
    }

    rule.times -= 1;

    return rule;
  }

  async #latency(): Promise<void> {
    const turns = Math.floor(this.#random() * (this.#maxYields + 1));

    for (let turn = 0; turn < turns; turn += 1) await yieldTurn();
  }
}
