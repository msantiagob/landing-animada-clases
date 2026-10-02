import { getDeployStore, getStore } from '@netlify/blobs';
import { getDeployContext, type RequestLocals } from '../netlify';
import { createBlobsStore, type BlobsClient } from './blobs';
import { StorageUnavailableError } from './errors';
import { createMemoryStore } from './memory';
import type { LeadStore } from './types';

export { StorageUnavailableError } from './errors';
export { createBlobsStore } from './blobs';
export { createMemoryStore } from './memory';
export * from './types';

/** Nombre del store de Netlify Blobs donde viven los leads. */
export const STORE_NAME = 'leads';

/**
 * Contextos de deploy que NO deben escribir en el store del sitio. `getStore`
 * es global al sitio: un deploy preview o un branch deploy que lo usara
 * mezclaría sus leads de prueba con los de producción. Esos contextos usan un
 * store atado al deploy, que Netlify borra junto con él.
 *
 * Todo lo demás (`production`, `dev` y el caso en que el contexto no se pueda
 * leer) usa el store del sitio: un fallo al detectar el contexto nunca puede
 * dejar a producción sin dónde guardar.
 */
const ISOLATED_DEPLOY_CONTEXTS = new Set(['deploy-preview', 'branch-deploy']);

interface BlobsStoreRequest {
  name: string;
  consistency: 'strong';
}

export interface LeadStoreEnvironment {
  /** `true` solo bajo `astro dev`. En el bundle de producción Vite lo deja fijo en `false`. */
  isDev: boolean;
  deployContext?: string;
  getStore: (options: BlobsStoreRequest) => BlobsClient;
  getDeployStore: (options: BlobsStoreRequest) => BlobsClient;
  warn: (message: string) => void;
}

const isMissingBlobsEnvironment = (error: unknown): boolean =>
  error instanceof Error && error.name === 'MissingBlobsEnvironmentError';

/**
 * Elige dónde se guardan los leads.
 *
 * - Con el entorno de Netlify disponible: Netlify Blobs, con consistencia
 *   fuerte (el panel y la reserva de horarios leen lo que acaban de escribir).
 * - Sin él, SOLO en desarrollo: memoria, con un aviso. Fuera del servidor de
 *   desarrollo jamás se cae a memoria: en una función serverless cada
 *   instancia tendría la suya y los leads se perderían. Se lanza
 *   `StorageUnavailableError` y los endpoints responden 503.
 */
export const createLeadStore = (environment: LeadStoreEnvironment): LeadStore => {
  const isolated = environment.deployContext !== undefined && ISOLATED_DEPLOY_CONTEXTS.has(environment.deployContext);
  const request: BlobsStoreRequest = { name: STORE_NAME, consistency: 'strong' };

  try {
    const client = isolated ? environment.getDeployStore(request) : environment.getStore(request);

    return createBlobsStore(client, { scope: isolated ? 'deploy' : 'site' });
  } catch (error) {
    if (environment.isDev && isMissingBlobsEnvironment(error)) {
      environment.warn(
        '[storage] Netlify Blobs no está disponible en este entorno: los leads se guardan EN MEMORIA y se pierden al ' +
          'reiniciar. Es solo para desarrollo; en Netlify se usan Blobs.'
      );

      return createMemoryStore();
    }

    throw new StorageUnavailableError(
      isMissingBlobsEnvironment(error)
        ? 'El entorno no está configurado para usar Netlify Blobs.'
        : 'No se pudo abrir el store de Netlify Blobs.',
      { cause: error }
    );
  }
};

let instance: LeadStore | null = null;

/**
 * El store de esta instancia. Se crea en la primera petición y se reutiliza:
 * así el aviso de "memoria" sale una sola vez y el store en memoria no se
 * recrea (y vacía) a cada petición.
 *
 * Recibe `locals` para leer el contexto del deploy que inyecta el adaptador.
 */
export const getLeadStore = (locals?: RequestLocals): LeadStore => {
  instance ??= createLeadStore({
    isDev: import.meta.env.DEV,
    deployContext: getDeployContext(locals),
    getStore: (options) => getStore(options),
    getDeployStore: (options) => getDeployStore(options),
    warn: (message) => console.warn(message),
  });

  return instance;
};

/** Inyecta un store (tests) o, con `null`, descarta el actual. */
export const setLeadStore = (store: LeadStore | null): void => {
  instance = store;
};
