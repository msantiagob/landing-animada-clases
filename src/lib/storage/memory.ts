import { KeyValueLeadStore, type KeyValueBackend, type KeyValueLeadStoreOptions } from './core';
import type { LeadStore } from './types';

/**
 * Almacén en la memoria del proceso: para desarrollo local y tests. En
 * producción NUNCA se usa (ver index.ts): se pierde en cada arranque y, en
 * una función serverless, cada instancia tendría su propia copia.
 *
 * Guarda el JSON serializado y no el objeto: así se comporta como Netlify
 * Blobs (lo que sale es una copia, `undefined` desaparece) y un bug de
 * mutación compartida no puede pasar en memoria y fallar en producción.
 */
export class MemoryBackend implements KeyValueBackend {
  readonly #entries = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.#entries.get(key);

    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.#entries.set(key, JSON.stringify(value));
  }

  async setIfAbsent(key: string, value: unknown): Promise<void> {
    // Sin ningún `await` entre la consulta y la escritura: en JavaScript eso es atómico.
    if (!this.#entries.has(key)) this.#entries.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.#entries.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.#entries.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
}

export type MemoryStoreOptions = Pick<KeyValueLeadStoreOptions, 'now' | 'newId'>;

export const createMemoryStore = (options: MemoryStoreOptions = {}): LeadStore =>
  new KeyValueLeadStore(new MemoryBackend(), { backend: 'memory', scope: 'process', ...options });
