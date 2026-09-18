import type { APIRoute } from 'astro';
import { getDb } from '../../lib/database';
import { json } from '../../lib/http';

export const prerender = false;

/** Healthcheck para Railway: verifica proceso vivo + base accesible. */
export const GET: APIRoute = async () => {
  try {
    getDb().prepare('SELECT 1').get();

    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    });
  } catch (error) {
    console.error('[api/health] Healthcheck falló:', error);

    return json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      },
      503
    );
  }
};
