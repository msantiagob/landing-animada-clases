import type { APIRoute } from 'astro';
import { dbHelpers } from '../../lib/database';
import { emailHelpers } from '../../lib/email';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, message, phone, company } = body;

    console.log('📧 Datos recibidos en /api/contact:', body);

    // Validaciones básicas
    if (!name || !email || !message) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nombre, email y mensaje son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formato de email inválido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener información adicional de la request
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || 'direct';

    // Preparar datos para insertar
    const formData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      ip,
      userAgent,
      sourcePage: referer
    };

    // Insertar en base de datos
    console.log('💾 Insertando en base de datos:', formData);
    const result = dbHelpers.insertContactForm(formData);
    console.log('✅ Resultado de inserción:', result);

    if (result.lastInsertRowid) {
      // Enviar notificación por email de forma asíncrona
      emailHelpers.sendContactFormNotification(formData).catch(error => {
        console.error('Error enviando notificación por email:', error);
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Formulario enviado correctamente. Te contactaremos pronto.',
        id: result.lastInsertRowid
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Error insertando en base de datos');
    }

  } catch (error) {
    console.error('Error procesando formulario de contacto:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor. Inténtalo más tarde.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};