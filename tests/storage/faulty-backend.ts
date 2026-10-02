import type { KeyValueBackend } from '~/lib/storage/core';

export type KeyValueOperation = 'get' | 'set' | 'setIfAbsent' | 'delete' | 'keys';

export interface FaultOptions {
  /** Solo las operaciones sobre esta clave (o sobre este prefijo, en `keys`). */
  key?: string | RegExp;
  /** Deja pasar las primeras `skip` operaciones que coincidan. */
  skip?: number;
  /** Cuántas veces falla antes de volver a funcionar. */
  times?: number;
  /**
   * La operación SÍ se aplica y recién después lanza: la respuesta se perdió, el cliente
   * agotó el tiempo o la conexión se cortó después de que el servidor escribió.
   */
  afterApplying?: boolean;
  /** No lanza ni escribe: devuelve como si nada. Es el 5xx que una escritura condicional informa como éxito. */
  silently?: boolean;
}

interface Fault extends Required<Pick<FaultOptions, 'skip' | 'times' | 'afterApplying' | 'silently'>> {
  operation: KeyValueOperation;
  key?: string | RegExp;
  error: unknown;
}

/**
 * Envuelve un almacén clave-valor (memoria o Blobs) y le inyecta fallos en operaciones concretas.
 * Los fallos se lanzan tal cual: lo que se prueba es cómo reacciona core.ts, no el mapeo de errores de blobs.ts.
 */
export class FaultyKeyValueBackend implements KeyValueBackend {
  readonly #faults: Fault[] = [];

  constructor(readonly inner: KeyValueBackend) {}

  fail(operation: KeyValueOperation, error: unknown, options: FaultOptions = {}): void {
    const { key, skip = 0, times = Infinity, afterApplying = false, silently = false } = options;

    this.#faults.push({ operation, key, error, skip, times, afterApplying, silently });
  }

  get<T>(key: string): Promise<T | null> {
    return this.#run('get', key, () => this.inner.get<T>(key));
  }

  set(key: string, value: unknown): Promise<void> {
    return this.#run('set', key, () => this.inner.set(key, value));
  }

  setIfAbsent(key: string, value: unknown): Promise<void> {
    return this.#run('setIfAbsent', key, () => this.inner.setIfAbsent(key, value));
  }

  delete(key: string): Promise<void> {
    return this.#run('delete', key, () => this.inner.delete(key));
  }

  keys(prefix: string): Promise<string[]> {
    return this.#run('keys', prefix, () => this.inner.keys(prefix));
  }

  async #run<T>(operation: KeyValueOperation, key: string, action: () => Promise<T>): Promise<T> {
    const fault = this.#faults.find(
      (candidate) =>
        candidate.operation === operation &&
        candidate.times > 0 &&
        (candidate.key === undefined ||
          (typeof candidate.key === 'string' ? candidate.key === key : candidate.key.test(key)))
    );

    if (!fault) return action();

    if (fault.skip > 0) {
      fault.skip -= 1;

      return action();
    }

    fault.times -= 1;

    if (fault.silently) return undefined as T;
    if (fault.afterApplying) await action();

    throw fault.error;
  }
}
