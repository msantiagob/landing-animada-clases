import nodemailer from 'nodemailer';
import { format } from 'date-fns';

// Configuración del transportador de email
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'tu-email@gmail.com',
      pass: process.env.SMTP_PASS || 'tu-app-password'
    }
  });
};

export interface EmailConfig {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export const emailHelpers = {
  // Enviar email genérico
  sendEmail: async (config: EmailConfig): Promise<boolean> => {
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: config.from || process.env.SMTP_FROM || 'noreply@sonmyd.com',
        to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
        subject: config.subject,
        text: config.text,
        html: config.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email enviado:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error enviando email:', error);
      return false;
    }
  },

  // Notificación de nuevo formulario de contacto
  sendContactFormNotification: async (formData: any): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1>🚀 Nuevo Contacto - Sonmyd</h1>
        </div>
        
        <div style="padding: 20px; background: #f8fafc;">
          <h2 style="color: #1e40af;">Información del Contacto</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Nombre:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            ${formData.phone ? `<p><strong>Teléfono:</strong> ${formData.phone}</p>` : ''}
            ${formData.company ? `<p><strong>Empresa:</strong> ${formData.company}</p>` : ''}
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Mensaje:</strong></p>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 4px;">${formData.message}</p>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Información Técnica:</strong></p>
            <p><small>IP: ${formData.ip || 'N/A'}</small></p>
            <p><small>Página: ${formData.sourcePage || 'N/A'}</small></p>
            <p><small>Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</small></p>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="http://localhost:3000/admin/forms" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver en Panel Admin
            </a>
          </div>
        </div>
        
        <div style="background: #1e40af; color: white; padding: 10px; text-align: center; font-size: 12px;">
          <p>Sonmyd - Soluciones Tecnológicas | Bogotá, Colombia</p>
        </div>
      </div>
    `;

    return await emailHelpers.sendEmail({
      to: 'admin@sonmyd.com', // Cambiar por el email real
      subject: `🚀 Nuevo Contacto: ${formData.name}`,
      html
    });
  },

  // Confirmación de cita agendada
  sendAppointmentConfirmation: async (appointmentData: any): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; color: white; padding: 20px; text-align: center;">
          <h1>✅ Cita Confirmada - Sonmyd</h1>
        </div>
        
        <div style="padding: 20px; background: #f0fdf4;">
          <h2 style="color: #059669;">¡Gracias por agendar tu consulta!</h2>
          
          <p>Hola <strong>${appointmentData.name}</strong>,</p>
          <p>Tu consulta ha sido confirmada exitosamente. Aquí están los detalles:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #059669;">Detalles de la Cita</h3>
            <p><strong>📅 Fecha:</strong> ${format(new Date(appointmentData.date), 'dd/MM/yyyy')}</p>
            <p><strong>🕒 Hora:</strong> ${appointmentData.time}</p>
            <p><strong>⏱️ Duración:</strong> ${appointmentData.duration} minutos</p>
            <p><strong>🎯 Servicio:</strong> ${appointmentData.serviceType}</p>
            ${appointmentData.meetingLink ? `<p><strong>🔗 Link de reunión:</strong> <a href="${appointmentData.meetingLink}">${appointmentData.meetingLink}</a></p>` : ''}
          </div>
          
          ${appointmentData.message ? `
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Tu mensaje:</strong></p>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 4px;">${appointmentData.message}</p>
          </div>
          ` : ''}
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #d97706;">📋 Qué esperar en tu consulta:</h4>
            <ul style="color: #92400e;">
              <li>Análisis detallado de tus necesidades tecnológicas</li>
              <li>Propuesta personalizada de soluciones</li>
              <li>Cronograma y presupuesto estimado</li>
              <li>Siguiente pasos recomendados</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p><strong>¿Necesitas reprogramar o cancelar?</strong></p>
            <p>Responde este email o llámanos al <strong>+57 (1) 234-5678</strong></p>
          </div>
        </div>
        
        <div style="background: #059669; color: white; padding: 15px; text-align: center;">
          <p><strong>¡Estamos emocionados de trabajar contigo!</strong></p>
          <p style="font-size: 12px; margin: 5px 0;">Sonmyd - Transformamos tu negocio con tecnología</p>
          <p style="font-size: 12px; margin: 0;">Bogotá, Colombia | hola@sonmyd.com | +57 (1) 234-5678</p>
        </div>
      </div>
    `;

    return await emailHelpers.sendEmail({
      to: appointmentData.email,
      subject: `✅ Cita confirmada - ${format(new Date(appointmentData.date), 'dd/MM/yyyy')} a las ${appointmentData.time}`,
      html
    });
  },

  // Notificación interna de nueva cita
  sendAppointmentNotification: async (appointmentData: any): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #7c3aed; color: white; padding: 20px; text-align: center;">
          <h1>📅 Nueva Cita Agendada</h1>
        </div>
        
        <div style="padding: 20px; background: #faf5ff;">
          <h2 style="color: #7c3aed;">Detalles de la Cita</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Cliente:</strong> ${appointmentData.name}</p>
            <p><strong>Email:</strong> ${appointmentData.email}</p>
            <p><strong>Teléfono:</strong> ${appointmentData.phone || 'No proporcionado'}</p>
            <p><strong>Empresa:</strong> ${appointmentData.company || 'No proporcionada'}</p>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Fecha:</strong> ${format(new Date(appointmentData.date), 'dd/MM/yyyy')}</p>
            <p><strong>Hora:</strong> ${appointmentData.time}</p>
            <p><strong>Duración:</strong> ${appointmentData.duration} minutos</p>
            <p><strong>Servicio:</strong> ${appointmentData.serviceType}</p>
          </div>
          
          ${appointmentData.message ? `
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p><strong>Mensaje del cliente:</strong></p>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 4px;">${appointmentData.message}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="http://localhost:3000/admin/appointments" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver en Panel Admin
            </a>
          </div>
        </div>
      </div>
    `;

    return await emailHelpers.sendEmail({
      to: 'admin@sonmyd.com', // Cambiar por el email real
      subject: `📅 Nueva Cita: ${appointmentData.name} - ${format(new Date(appointmentData.date), 'dd/MM/yyyy')}`,
      html
    });
  },

  // Recordatorio de cita
  sendAppointmentReminder: async (appointmentData: any): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1>⏰ Recordatorio de Cita</h1>
        </div>
        
        <div style="padding: 20px; background: #fffbeb;">
          <h2 style="color: #f59e0b;">Tu cita es mañana</h2>
          
          <p>Hola <strong>${appointmentData.name}</strong>,</p>
          <p>Te recordamos que tienes una consulta programada con nosotros mañana:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p><strong>📅 Fecha:</strong> ${format(new Date(appointmentData.date), 'dd/MM/yyyy')}</p>
            <p><strong>🕒 Hora:</strong> ${appointmentData.time}</p>
            <p><strong>⏱️ Duración:</strong> ${appointmentData.duration} minutos</p>
            <p><strong>🎯 Servicio:</strong> ${appointmentData.serviceType}</p>
            ${appointmentData.meetingLink ? `<p><strong>🔗 Link de reunión:</strong> <a href="${appointmentData.meetingLink}">${appointmentData.meetingLink}</a></p>` : ''}
          </div>
          
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1e40af;">💡 Para aprovechar al máximo tu consulta:</h4>
            <ul style="color: #1e40af;">
              <li>Ten lista una descripción de tu proyecto o necesidad</li>
              <li>Prepara preguntas específicas sobre tecnología</li>
              <li>Si tienes documentos relevantes, tenlos a mano</li>
              <li>Piensa en tu presupuesto y timeline</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p>¡Estamos emocionados de conocer tu proyecto!</p>
          </div>
        </div>
        
        <div style="background: #f59e0b; color: white; padding: 15px; text-align: center;">
          <p>¿Necesitas reprogramar? Responde este email o llámanos</p>
          <p style="font-size: 12px; margin: 0;">+57 (1) 234-5678 | hola@sonmyd.com</p>
        </div>
      </div>
    `;

    return await emailHelpers.sendEmail({
      to: appointmentData.email,
      subject: `⏰ Recordatorio: Tu cita mañana a las ${appointmentData.time}`,
      html
    });
  }
};