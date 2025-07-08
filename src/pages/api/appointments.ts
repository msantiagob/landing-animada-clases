import type { APIRoute } from 'astro';
import { dbHelpers } from '../../lib/database';
import { emailHelpers } from '../../lib/email';
import { format, parse, isValid, isBefore, addHours } from 'date-fns';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, company, serviceType, date, time, timezone, duration, message } = body;

    // Validaciones básicas
    if (!name || !email || !serviceType || !date || !time) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nombre, email, tipo de servicio, fecha y hora son obligatorios'
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

    // Validar formato de fecha y hora
    const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(appointmentDateTime)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formato de fecha u hora inválido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar que la fecha sea futura (al menos 2 horas desde ahora)
    const minDate = addHours(new Date(), 2);
    if (isBefore(appointmentDateTime, minDate)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La cita debe ser programada con al menos 2 horas de anticipación'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar disponibilidad (no permitir citas en el mismo horario)
    const existingAppointments = dbHelpers.getAppointmentsByDate(date);
    const isTimeSlotTaken = existingAppointments.some(apt => 
      apt.time === time && apt.status !== 'cancelled'
    );

    if (isTimeSlotTaken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lo sentimos, ese horario ya no está disponible. Por favor selecciona otro.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar datos para insertar
    const appointmentData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      serviceType: serviceType.trim(),
      date,
      time,
      timezone: timezone || 'America/Bogota',
      duration: duration || 60,
      message: message?.trim() || null
    };

    // Insertar en base de datos
    const result = dbHelpers.insertAppointment(appointmentData);

    if (result.lastInsertRowid) {
      // Enviar emails de confirmación de forma asíncrona
      Promise.all([
        emailHelpers.sendAppointmentConfirmation(appointmentData),
        emailHelpers.sendAppointmentNotification(appointmentData)
      ]).catch(error => {
        console.error('Error enviando emails de confirmación:', error);
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Cita agendada correctamente. Recibirás un email de confirmación.',
        appointment: {
          id: result.lastInsertRowid,
          date,
          time,
          duration: appointmentData.duration
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Error insertando cita en base de datos');
    }

  } catch (error) {
    console.error('Error procesando cita:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor. Inténtalo más tarde.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const date = searchParams.get('date');

    if (!date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Fecha es requerida'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener citas existentes para la fecha
    const appointments = dbHelpers.getAppointmentsByDate(date);
    
    // Horarios disponibles (9:00 AM a 6:00 PM, cada hora)
    const availableSlots = [];
    for (let hour = 9; hour <= 18; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      const isBooked = appointments.some(apt => 
        apt.time === timeSlot && apt.status !== 'cancelled'
      );
      
      if (!isBooked) {
        availableSlots.push(timeSlot);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date,
      availableSlots,
      bookedSlots: appointments.filter(apt => apt.status !== 'cancelled').map(apt => apt.time)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};