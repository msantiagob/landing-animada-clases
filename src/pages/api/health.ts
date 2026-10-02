import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { getLeadStore, type StorageBackend } from '../../lib/storage';

export const prerender = false;

/**
 * Healthcheck: verifica que la función responde y que el almacenamiento de
 * leads está accesible. Solo informa de QUÉ almacenamiento se usa y en qué
 * alcance (`site`, `deploy` o `process`), nunca de claves, tokens ni de la
 * configuración del panel.
 */
export const GET: APIRoute = async ({ locals }) => {
  // Si el store ni siquiera se puede abrir, el que falló es Netlify Blobs: es el único en producción.
  let storage: StorageBackend = 'netlify-blobs';

  try {
    const store = getLeadStore(locals);
    storage = store.backend;

    await store.ping();

    return json({
      status: 'healthy',
      storage,
      scope: store.scope,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/health] Healthcheck falló:', error);

    return json({ status: 'unhealthy', storage, timestamp: new Date().toISOString() }, 503);
  }
};
