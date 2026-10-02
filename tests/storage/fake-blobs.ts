import type { BlobsClient } from '~/lib/storage/blobs';

/**
 * Réplica en memoria del `Store` de `@netlify/blobs` (v10), limitada a lo que
 * usa src/lib/storage/blobs.ts: `get`, `setJSON`, `delete` y `list`.
 *
 * Reproduce el comportamiento del cliente real (node_modules/@netlify/blobs/dist/main.js),
 * incluidas las rarezas en las que se apoya la lógica de core.ts:
 * - `get` devuelve `null` si la clave no existe y una COPIA si existe (se guarda el JSON serializado).
 * - `setJSON` valida la clave igual que el cliente (vacía, con `/` inicial, más de 600 bytes).
 * - `setJSON` con `onlyIfNew` responde `{ modified: false }` si la clave ya existe (el 412 del servidor).
 * - `delete` no falla si la clave no existe.
 * - `list` devuelve `{ blobs: [{ key, etag }], directories: [] }` SIN orden garantizado: sale en un
 *   orden fijo pero arbitrario, para que un store que dependa del orden del listado falle en los tests.
 *
 * Para que la concurrencia se pruebe de verdad, cada operación cede el turno al bucle de eventos antes
 * y después de su sección atómica (la latencia de red). La comprobación y la escritura de una operación
 * condicional son síncronas entre sí, como en el servidor.
 */

export type FakeOperation = 'get' | 'setJSON' | 'delete' | 'list';

/** Qué hace el cliente real ante un fallo del servidor en una escritura condicional. */
export type ConditionalWriteQuirk =
  /** 5xx: el cliente informa `modified: true` aunque NO se escribió nada. */
  | 'ghost-success'
  /** Respuesta perdida y reintento: se escribió, pero el reintento recibe 412 por la propia escritura. */
  | 'applied-but-412';

export interface FakeBlobsOptions {
  /** Semilla del azar que decide cuántos turnos se ceden. El mismo valor repite la misma intercalación. */
  seed?: number;
  /** Máximo de turnos cedidos antes y después de cada operación. */
  maxYields?: number;
}

export interface RecordedCall {
  operation: FakeOperation;
  /** La clave; para `list`, el prefijo. */
  key: string;
  options?: unknown;
}

interface Fault {
  operation: FakeOperation;
  key?: string | RegExp;
  error: unknown;
  skip: number;
  times: number;
}

const MAX_KEY_BYTES = 600;

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Orden fijo y sin relación con el alfabético ni con el de inserción. */
const scrambledRank = (key: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }

  return hash >>> 0;
};

const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

export class FakeBlobsStore implements BlobsClient {
  /** Todo lo que el store pidió, en orden. */
  readonly calls: RecordedCall[] = [];

  readonly #entries = new Map<string, { raw: string; etag: string }>();
  readonly #faults: Fault[] = [];
  readonly #phantoms: string[] = [];
  readonly #random: () => number;
  readonly #maxYields: number;
  #quirk: { kind: ConditionalWriteQuirk; remaining: number } | null = null;
  #version = 0;

  constructor({ seed = 1, maxYields = 3 }: FakeBlobsOptions = {}) {
    this.#random = mulberry32(seed);
    this.#maxYields = maxYields;
  }

  // --- Lo que ve el store (la API de @netlify/blobs) ---------------------------------------------

  async get(key: string, options: { type: 'json' }): Promise<unknown> {
    this.calls.push({ operation: 'get', key, options });
    await this.#latency();
    this.#throwIfFaulty('get', key);

    const entry = this.#entries.get(key);
    const value = entry === undefined ? null : JSON.parse(entry.raw);

    await this.#latency();

    return value;
  }

  async setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean }): Promise<unknown> {
    this.calls.push({ operation: 'setJSON', key, options });
    await this.#latency();
    this.#throwIfFaulty('setJSON', key);
    this.#validateKey(key);

    const result = this.#write(key, data, options?.onlyIfNew === true);

    await this.#latency();

    return result;
  }

  async delete(key: string): Promise<void> {
    this.calls.push({ operation: 'delete', key });
    await this.#latency();
    this.#throwIfFaulty('delete', key);

    this.#entries.delete(key);

    await this.#latency();
  }

  async list(options: {
    prefix: string;
  }): Promise<{ blobs: Array<{ key: string; etag: string }>; directories: string[] }> {
    this.calls.push({ operation: 'list', key: options.prefix });
    await this.#latency();
    this.#throwIfFaulty('list', options.prefix);

    const blobs = [
      ...[...this.#entries].map(([key, { etag }]) => ({ key, etag })),
      ...this.#phantoms.map((key) => ({ key, etag: 'phantom' })),
    ]
      .filter(({ key }) => key.startsWith(options.prefix))
      .sort((a, b) => scrambledRank(a.key) - scrambledRank(b.key));

    await this.#latency();

    return { blobs, directories: [] };
  }

  // --- Lo que ve el test --------------------------------------------------------------------------

  /** Hace fallar las próximas operaciones que coincidan. `skip` deja pasar las primeras `skip`. */
  fail(
    operation: FakeOperation,
    error: unknown = new Error(`fallo simulado en ${operation}`),
    { key, skip = 0, times = Infinity }: { key?: string | RegExp; skip?: number; times?: number } = {}
  ): void {
    this.#faults.push({ operation, key, error, skip, times });
  }

  /** Cambia cómo responden las próximas `times` escrituras condicionales. */
  conditionalWritesBehaveAs(kind: ConditionalWriteQuirk, times = 1): void {
    this.#quirk = { kind, remaining: times };
  }

  /** Hace que `list` incluya claves que ya no existen: un listado puede ir un paso por detrás de un borrado. */
  listAlso(...keys: string[]): void {
    this.#phantoms.push(...keys);
  }

  /** Claves guardadas, en orden alfabético. */
  keys(prefix = ''): string[] {
    return [...this.#entries.keys()].filter((key) => key.startsWith(prefix)).sort();
  }

  /** El valor guardado, sin pasar por la API (y sin dejar rastro en `calls`). */
  peek<T = unknown>(key: string): T | undefined {
    const entry = this.#entries.get(key);

    return entry === undefined ? undefined : (JSON.parse(entry.raw) as T);
  }

  /** Guarda un texto tal cual, sin pasar por la API: para simular datos que no son JSON. */
  plant(key: string, raw: string): void {
    this.#entries.set(key, { raw, etag: this.#nextEtag() });
  }

  callsTo(operation: FakeOperation): RecordedCall[] {
    return this.calls.filter((call) => call.operation === operation);
  }

  // --- Internos -----------------------------------------------------------------------------------

  #write(key: string, data: unknown, onlyIfNew: boolean): { etag?: string; modified: boolean } {
    const quirk = onlyIfNew && this.#quirk && this.#quirk.remaining > 0 ? this.#quirk : null;

    if (quirk) {
      quirk.remaining -= 1;

      if (quirk.kind === 'ghost-success') return { etag: '', modified: true };

      if (!this.#entries.has(key)) this.#entries.set(key, { raw: JSON.stringify(data), etag: this.#nextEtag() });

      return { modified: false };
    }

    if (onlyIfNew && this.#entries.has(key)) return { modified: false };

    const etag = this.#nextEtag();
    this.#entries.set(key, { raw: JSON.stringify(data), etag });

    return { etag, modified: true };
  }

  #validateKey(key: string): void {
    if (key === '') throw new Error('Blob key must not be empty.');
    if (key.startsWith('/') || key.startsWith('%2F'))
      throw new Error('Blob key must not start with forward slash (/).');
    if (new TextEncoder().encode(key).length > MAX_KEY_BYTES)
      throw new Error('Blob key must be at most 600 bytes long.');
  }

  #throwIfFaulty(operation: FakeOperation, key: string): void {
    const fault = this.#faults.find(
      (candidate) =>
        candidate.operation === operation &&
        candidate.times > 0 &&
        (candidate.key === undefined ||
          (typeof candidate.key === 'string' ? candidate.key === key : candidate.key.test(key)))
    );

    if (!fault) return;

    if (fault.skip > 0) {
      fault.skip -= 1;
      return;
    }

    fault.times -= 1;
    throw fault.error;
  }

  #nextEtag(): string {
    this.#version += 1;

    return `etag-${this.#version}`;
  }

  async #latency(): Promise<void> {
    const turns = Math.floor(this.#random() * (this.#maxYields + 1));

    for (let turn = 0; turn < turns; turn += 1) await yieldTurn();
  }
}
