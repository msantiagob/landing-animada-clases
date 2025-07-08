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
    
    const offset = (page - 1) * limit;

    // Obtener formularios con filtros
    let forms;
    if (status) {
      const stmt = db.prepare(`
        SELECT * FROM contact_forms 
        WHERE status = ?
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      forms = stmt.all(status, limit, offset);
    } else {
      forms = dbHelpers.getContactForms(limit, offset);
    }

    // Obtener conteo total
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM contact_forms');
    const { total } = countStmt.get() as { total: number };

    return new Response(JSON.stringify({
      success: true,
      forms,
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
    console.error('Error obteniendo formularios:', error);
    
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
    const { id, status } = body;

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
    const validStatuses = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Status no válido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = dbHelpers.updateContactFormStatus(id, status);

    if (result.changes > 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Status actualizado correctamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formulario no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error actualizando formulario:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};