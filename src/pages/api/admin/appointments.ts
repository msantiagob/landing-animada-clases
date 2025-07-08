import type { APIRoute } from 'astro';
import { dbHelpers } from '../../../lib/database';
import { authHelpers } from '../../../lib/auth';
import db from '../../../lib/database';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    
    const offset = (page - 1) * limit;

    // Construir query con filtros
    let query = 'SELECT * FROM appointments WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY date DESC, time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const appointments = stmt.all(...params);

    // Obtener conteo total
    let countQuery = 'SELECT COUNT(*) as total FROM appointments WHERE 1=1';
    const countParams: any[] = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (date) {
      countQuery += ' AND date = ?';
      countParams.push(date);
    }

    const countStmt = db.prepare(countQuery);
    const { total } = countStmt.get(...countParams) as { total: number };

    return new Response(JSON.stringify({
      success: true,
      appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error obteniendo citas:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id, status, meetingLink, notes } = body;

    if (!id || !status) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID y status son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Status no válido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Actualizar cita
    let query = 'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (meetingLink) {
      query += ', meeting_link = ?';
      params.push(meetingLink);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const stmt = db.prepare(query);
    const result = stmt.run(...params);

    if (result.changes > 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Cita actualizada correctamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cita no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error actualizando cita:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};