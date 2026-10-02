import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailConfig {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Si el SMTP no está configurado el sitio tiene que seguir funcionando: el lead
 * ya quedó guardado en la base. El envío de mail es una notificación, no una
 * dependencia dura del formulario.
 */
export const isEmailConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);

  // createTransport, no createTransporter. El nombre equivocado hacía que cada
  // envío lanzara TypeError y ningún mail saliera nunca.
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/** Solo para tests. */
export const setTransporter = (custom: Transporter | null) => {
  transporter = custom;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const layout = (title: string, rows: Array<[string, unknown]>, footer = '') => `
  <div style="font-family: system-ui, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background:#1e40af;color:#fff;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:20px;">${escapeHtml(title)}</h1>
    </div>
    <div style="padding:20px;background:#f8fafc;">
      <table style="width:100%;background:#fff;border-radius:8px;padding:15px;border-collapse:collapse;">
        ${rows
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</td></tr>`
          )
          .join('')}
      </table>
      ${footer}
    </div>
  </div>
`;

const notificationRecipient = () => process.env.CONTACT_NOTIFICATION_EMAIL || process.env.SMTP_USER || '';

export const emailHelpers = {
  sendEmail: async (config: EmailConfig): Promise<boolean> => {
    if (!isEmailConfigured()) {
      console.warn('[email] SMTP sin configurar, se omite el envío:', config.subject);
      return false;
    }

    try {
      await getTransporter().sendMail({
        from: config.from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
        subject: config.subject,
        text: config.text,
        html: config.html,
      });

      return true;
    } catch (error) {
      console.error('[email] Error enviando email:', error);
      return false;
    }
  },

  sendContactFormNotification: (data: {
    name: string;
    email: string;
    message: string;
    phone?: string | null;
    company?: string | null;
    sourcePage?: string | null;
  }) =>
    emailHelpers.sendEmail({
      to: notificationRecipient(),
      subject: `Nuevo contacto en Sonmyd: ${data.name}`,
      html: layout('Nuevo contacto — Sonmyd', [
        ['Nombre', data.name],
        ['Email', data.email],
        ['Teléfono', data.phone],
        ['Empresa', data.company],
        ['Origen', data.sourcePage],
        ['Mensaje', data.message],
      ]),
    }),

  sendAppointmentNotification: (data: {
    name: string;
    email: string;
    serviceType: string;
    date: string;
    time: string;
    phone?: string | null;
    company?: string | null;
    message?: string | null;
  }) =>
    emailHelpers.sendEmail({
      to: notificationRecipient(),
      subject: `Nueva cita agendada: ${data.name} — ${data.date} ${data.time}`,
      html: layout('Nueva cita agendada — Sonmyd', [
        ['Nombre', data.name],
        ['Email', data.email],
        ['Teléfono', data.phone],
        ['Empresa', data.company],
        ['Servicio', data.serviceType],
        ['Fecha', data.date],
        ['Hora', data.time],
        ['Mensaje', data.message],
      ]),
    }),

  sendAppointmentConfirmation: (data: {
    name: string;
    email: string;
    serviceType: string;
    date: string;
    time: string;
    duration?: number;
  }) =>
    emailHelpers.sendEmail({
      to: data.email,
      subject: 'Tu cita con Sonmyd está confirmada',
      html: layout(
        `Hola ${data.name}, tu cita quedó agendada`,
        [
          ['Servicio', data.serviceType],
          ['Fecha', data.date],
          ['Hora', data.time],
          ['Duración', `${data.duration ?? 60} minutos`],
        ],
        `<p style="margin-top:16px;color:#475569;">Te contactamos por este mismo medio si necesitamos reprogramar. Si quieres cancelar, responde este correo.</p>`
      ),
    }),
};
