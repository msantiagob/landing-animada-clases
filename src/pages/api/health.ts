import type { APIRoute } from 'astro';
import db from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Verificar conexión a la base de datos
    const result = db.prepare('SELECT 1').get();
    
    if (!result) {
      throw new Error('Database connection failed');
    }

    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};