import type { APIRoute } from 'astro';
import { authHelpers } from '../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    switch (action) {
      case 'login':
        if (!email || !password) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Email y contraseña son obligatorios'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const loginResult = await authHelpers.login(email, password);
        
        if (!loginResult) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Credenciales inválidas'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Crear cookie con el token
        const response = new Response(JSON.stringify({
          success: true,
          user: loginResult.user,
          token: loginResult.token
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

        // Establecer cookie httpOnly para seguridad
        response.headers.append('Set-Cookie', 
          `auth-token=${loginResult.token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`
        );

        return response;

      case 'register':
        if (!email || !password || !name) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Email, contraseña y nombre son obligatorios'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Verificar si el usuario ya existe
        const existingUser = authHelpers.getUserByEmail(email);
        if (existingUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Usuario ya existe'
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const userId = await authHelpers.createUser(email, password, name);
        
        if (!userId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Error creando usuario'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Usuario creado correctamente',
          userId
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'logout':
        const logoutResponse = new Response(JSON.stringify({
          success: true,
          message: 'Sesión cerrada'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

        // Limpiar cookie
        logoutResponse.headers.append('Set-Cookie', 
          'auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
        );

        return logoutResponse;

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Acción no válida'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error en autenticación:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const authData = authHelpers.requireAuthFromCookies(request);
    
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autenticado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = authHelpers.getUserById(authData.userId);
    
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error verificando autenticación:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};