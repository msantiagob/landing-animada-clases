import { KeyValueLeadStore, type KeyValueBackend, type KeyValueLeadStoreOptions } from './core';
import { StorageUnavailableError } from './errors';
import type { LeadStore } from './types';

/**
 * Lo que este módulo usa del cliente de Netlify Blobs (`Store` de
 * `@netlify/blobs`). Se declara acá, mínimo, para poder probarlo con un
 * almacén falso (tests/storage/fake-blobs.ts); el `Store` real lo cumple, y
 * `astro check` lo comprueba donde se le pasa uno (index.ts).
 */
export interface BlobsClient {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean }): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>;
}

/**
 * Cualquier fallo del cliente se convierte en `StorageUnavailableError`: los
 * endpoints responden 503 y el error original queda en `cause` para los logs.
 * Así un corte de Blobs no se confunde con un bug del sitio ni se traga.
 */
const guard = async <T>(operation: string, action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw new StorageUnavailableError(`Netlify Blobs falló al ${operation}.`, { cause: error });
  }
};

export class BlobsBackend implements KeyValueBackend {
  readonly #client: BlobsClient;

  constructor(client: BlobsClient) {
    this.#client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    // `get` resuelve `null` si la clave no existe (404).
    return guard(`leer ${key}`, async () => ((await this.#client.get(key, { type: 'json' })) ?? null) as T | null);
  }

  async set(key: string, value: unknown): Promise<void> {
    await guard(`escribir ${key}`, () => this.#client.setJSON(key, value));
  }

  async setIfAbsent(key: string, value: unknown): Promise<void> {
    // `onlyIfNew` hace que el servidor rechace la escritura si la clave ya existe.
    // Lo que responde no se usa: quién quedó como titular lo decide una lectura (core.ts).
    await guard(`reservar ${key}`, () => this.#client.setJSON(key, value, { onlyIfNew: true }));
  }

  async delete(key: string): Promise<void> {
    await guard(`borrar ${key}`, () => this.#client.delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    // Sin `paginate`, list() recorre todas las páginas (de hasta 1.000 claves) y las junta.
    const { blobs } = await guard(`listar ${prefix}`, () => this.#client.list({ prefix }));

    return blobs.map((blob) => blob.key);
  }
}

export type BlobsStoreOptions = Pick<KeyValueLeadStoreOptions, 'now' | 'newId'> & {
  /** `site`: el store del sitio. `deploy`: el atado a un deploy. */
  scope: 'site' | 'deploy';
};

export const createBlobsStore = (client: BlobsClient, { scope, ...options }: BlobsStoreOptions): LeadStore =>
  new KeyValueLeadStore(new BlobsBackend(client), { backend: 'netlify-blobs', scope, ...options });
