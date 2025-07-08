import type { APIRoute } from 'astro';
import { authHelpers } from '../../../lib/auth';
import db from '../../../lib/database';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export const GET: APIRoute = async ({ request }) => {
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

    // Fechas para estadísticas
    const today = new Date();
    const yesterdayStart = format(startOfDay(subDays(today, 1)), 'yyyy-MM-dd HH:mm:ss');
    const todayStart = format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss');
    const last7Days = format(subDays(today, 7), 'yyyy-MM-dd HH:mm:ss');
    const last30Days = format(subDays(today, 30), 'yyyy-MM-dd HH:mm:ss');

    // Estadísticas de formularios de contacto
    const totalFormsStmt = db.prepare('SELECT COUNT(*) as count FROM contact_forms');
    const totalForms = totalFormsStmt.get() as { count: number };

    const todayFormsStmt = db.prepare('SELECT COUNT(*) as count FROM contact_forms WHERE created_at >= ?');
    const todayForms = todayFormsStmt.get(todayStart) as { count: number };

    const pendingFormsStmt = db.prepare('SELECT COUNT(*) as count FROM contact_forms WHERE status = "new"');
    const pendingForms = pendingFormsStmt.get() as { count: number };

    const last7DaysFormsStmt = db.prepare('SELECT COUNT(*) as count FROM contact_forms WHERE created_at >= ?');
    const last7DaysForms = last7DaysFormsStmt.get(last7Days) as { count: number };

    // Estadísticas de citas
    const totalAppointmentsStmt = db.prepare('SELECT COUNT(*) as count FROM appointments');
    const totalAppointments = totalAppointmentsStmt.get() as { count: number };

    const todayAppointmentsStmt = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE date = ?');
    const todayAppointments = todayAppointmentsStmt.get(format(today, 'yyyy-MM-dd')) as { count: number };

    const pendingAppointmentsStmt = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE status = "pending"');
    const pendingAppointments = pendingAppointmentsStmt.get() as { count: number };

    const upcomingAppointmentsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM appointments 
      WHERE date >= ? AND status IN ('pending', 'confirmed')
    `);
    const upcomingAppointments = upcomingAppointmentsStmt.get(format(today, 'yyyy-MM-dd')) as { count: number };

    // Próximas citas (siguientes 5)
    const nextAppointmentsStmt = db.prepare(`
      SELECT * FROM appointments 
      WHERE date >= ? AND status IN ('pending', 'confirmed')
      ORDER BY date ASC, time ASC 
      LIMIT 5
    `);
    const nextAppointments = nextAppointmentsStmt.all(format(today, 'yyyy-MM-dd'));

    // Formularios recientes (últimos 5)
    const recentFormsStmt = db.prepare(`
      SELECT * FROM contact_forms 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    const recentForms = recentFormsStmt.all();

    // Estadísticas por días (últimos 7 días) para gráficos
    const dailyStatsStmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as forms_count
      FROM contact_forms 
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const dailyFormStats = dailyStatsStmt.all(last7Days);

    const dailyAppointmentStatsStmt = db.prepare(`
      SELECT 
        date,
        COUNT(*) as appointments_count
      FROM appointments 
      WHERE created_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `);
    const dailyAppointmentStats = dailyAppointmentStatsStmt.all(last7Days);

    // Top servicios solicitados
    const topServicesStmt = db.prepare(`
      SELECT 
        service_type,
        COUNT(*) as count
      FROM appointments 
      WHERE created_at >= ?
      GROUP BY service_type
      ORDER BY count DESC
      LIMIT 5
    `);
    const topServices = topServicesStmt.all(last30Days);

    // Status distribution
    const formStatusStmt = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM contact_forms
      GROUP BY status
    `);
    const formStatusDistribution = formStatusStmt.all();

    const appointmentStatusStmt = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM appointments
      GROUP BY status
    `);
    const appointmentStatusDistribution = appointmentStatusStmt.all();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        forms: {
          total: totalForms.count,
          today: todayForms.count,
          pending: pendingForms.count,
          last7Days: last7DaysForms.count
        },
        appointments: {
          total: totalAppointments.count,
          today: todayAppointments.count,
          pending: pendingAppointments.count,
          upcoming: upcomingAppointments.count
        }
      },
      recentActivity: {
        forms: recentForms,
        appointments: nextAppointments
      },
      charts: {
        dailyForms: dailyFormStats,
        dailyAppointments: dailyAppointmentStats,
        topServices,
        formStatus: formStatusDistribution,
        appointmentStatus: appointmentStatusDistribution
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};