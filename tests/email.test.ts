import type { Transporter } from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailHelpers, isEmailConfigured, setTransporter } from '~/lib/email';
import { SERVER_TIMEZONES, resetTestEnvironment, stubServerTimezone } from './helpers';
import { findVoseo } from './voseo';

/**
 * Correos del sitio: aviso de contacto y de cita para el equipo, y confirmación
 * para quien reserva. No sale nada a la red: se inyecta un transporte falso con
 * `setTransporter` y se inspecciona lo que `sendMail` habría enviado.
 */

const SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CONTACT_NOTIFICATION_EMAIL'] as const;
const original = Object.fromEntries(SMTP_VARS.map((name) => [name, process.env[name]]));

const configureSmtp = () => {
  process.env.SMTP_HOST = 'smtp.sonmyd.test';
  process.env.SMTP_USER = 'avisos@sonmyd.test';
  process.env.SMTP_PASS = 'clave-de-prueba';
};

interface SentMail {
  from: string;
  to: string;
  subject: string;
  html: string;
}

let sendMail: ReturnType<typeof vi.fn>;

/** Lo que `sendMail` recibió. Falla si no hubo exactamente un envío. */
const sentMail = (): SentMail => {
  expect(sendMail).toHaveBeenCalledTimes(1);
  return sendMail.mock.calls[0][0] as SentMail;
};

beforeEach(() => {
  SMTP_VARS.forEach((name) => delete process.env[name]);

  sendMail = vi.fn().mockResolvedValue({ messageId: 'prueba' });
  setTransporter({ sendMail } as unknown as Transporter);

  // El módulo avisa por consola cuando omite o pierde un envío; en los tests es ruido.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setTransporter(null);

  SMTP_VARS.forEach((name) => {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
});

describe('isEmailConfigured', () => {
  it('es falso sin variables SMTP', () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it.each([
    ['la clave', ['SMTP_HOST', 'SMTP_USER']],
    ['el usuario', ['SMTP_HOST', 'SMTP_PASS']],
    ['el host', ['SMTP_USER', 'SMTP_PASS']],
  ])('es falso si falta %s', (_falta, presentes) => {
    presentes.forEach((name) => (process.env[name] = 'valor'));

    expect(isEmailConfigured()).toBe(false);
  });

  it('es verdadero con host, usuario y clave', () => {
    configureSmtp();

    expect(isEmailConfigured()).toBe(true);
  });
});

describe('sendEmail', () => {
  const mail = { to: 'ana@ejemplo.com', subject: 'Asunto', html: '<p>Hola</p>' };

  it('sin SMTP no intenta enviar y devuelve false, para que el formulario siga funcionando', async () => {
    await expect(emailHelpers.sendEmail(mail)).resolves.toBe(false);

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('envía con el remitente configurado y junta varios destinatarios con coma', async () => {
    configureSmtp();
    process.env.SMTP_FROM = 'Sonmyd <hola@sonmyd.test>';

    await expect(emailHelpers.sendEmail({ ...mail, to: ['a@ejemplo.com', 'b@ejemplo.com'] })).resolves.toBe(true);

    expect(sentMail()).toMatchObject({
      from: 'Sonmyd <hola@sonmyd.test>',
      to: 'a@ejemplo.com, b@ejemplo.com',
      subject: 'Asunto',
    });
  });

  it('usa el usuario SMTP como remitente cuando no hay SMTP_FROM', async () => {
    configureSmtp();

    await emailHelpers.sendEmail(mail);

    expect(sentMail().from).toBe('avisos@sonmyd.test');
  });

  it('si el transporte falla devuelve false en vez de lanzar: el lead ya quedó guardado', async () => {
    configureSmtp();
    sendMail.mockRejectedValue(new Error('connection refused'));

    await expect(emailHelpers.sendEmail(mail)).resolves.toBe(false);
  });
});

describe('sendAppointmentConfirmation', () => {
  const cita = {
    name: 'Ana Pérez',
    email: 'ana@ejemplo.com',
    serviceType: 'Clases de IA',
    date: '2026-10-15',
    time: '10:00',
  };

  beforeEach(configureSmtp);

  it('le llega a quien reservó, con el asunto de confirmación', async () => {
    await emailHelpers.sendAppointmentConfirmation(cita);

    expect(sentMail()).toMatchObject({ to: 'ana@ejemplo.com', subject: 'Tu cita con Sonmyd está confirmada' });
  });

  it('detalla servicio, fecha y hora, y asume los turnos de 60 minutos', async () => {
    await emailHelpers.sendAppointmentConfirmation(cita);

    const { html } = sentMail();
    expect(html).toContain('Hola Ana Pérez, tu cita quedó agendada');
    expect(html).toContain('<strong>Servicio:</strong> Clases de IA');
    expect(html).toContain('<strong>Fecha:</strong> 2026-10-15');
    expect(html).toContain('<strong>Hora:</strong> 10:00');
    expect(html).toContain('<strong>Duración:</strong> 60 minutos');
  });

  it('respeta la duración que llega con la reserva', async () => {
    await emailHelpers.sendAppointmentConfirmation({ ...cita, duration: 45 });

    expect(sentMail().html).toContain('<strong>Duración:</strong> 45 minutos');
  });

  it('explica cómo cancelar hablándole de "tú", no con voseo', async () => {
    await emailHelpers.sendAppointmentConfirmation(cita);

    const { html } = sentMail();
    expect(html).toContain('Si quieres cancelar, responde este correo.');
    expect(html).not.toMatch(/querés|respondé/i);
    expect(findVoseo(html)).toEqual([]);
  });

  it('escapa el HTML del nombre para que nadie inyecte marcado en el correo', async () => {
    await emailHelpers.sendAppointmentConfirmation({ ...cita, name: '<img src=x onerror=alert(1)>' });

    const { html } = sentMail();
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('sendContactFormNotification', () => {
  const contacto = { name: 'Ana Pérez', email: 'ana@ejemplo.com', message: 'Quiero clases de IA para mi equipo.' };

  beforeEach(configureSmtp);

  it('avisa al usuario SMTP cuando no hay un correo de notificaciones propio', async () => {
    await emailHelpers.sendContactFormNotification(contacto);

    expect(sentMail().to).toBe('avisos@sonmyd.test');
  });

  it('prefiere CONTACT_NOTIFICATION_EMAIL cuando está definido', async () => {
    process.env.CONTACT_NOTIFICATION_EMAIL = 'equipo@sonmyd.test';

    await emailHelpers.sendContactFormNotification(contacto);

    expect(sentMail().to).toBe('equipo@sonmyd.test');
  });

  it('pone el nombre en el asunto y omite los datos que la persona no completó', async () => {
    await emailHelpers.sendContactFormNotification({ ...contacto, phone: null, company: '' });

    const { subject, html } = sentMail();
    expect(subject).toBe('Nuevo contacto en Sonmyd: Ana Pérez');
    expect(html).toContain('<strong>Mensaje:</strong> Quiero clases de IA para mi equipo.');
    expect(html).not.toContain('Teléfono');
    expect(html).not.toContain('Empresa');
  });

  it('escapa el HTML del mensaje', async () => {
    await emailHelpers.sendContactFormNotification({ ...contacto, message: '<script>alert("x")</script>' });

    const { html } = sentMail();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
});

describe('sendAppointmentNotification', () => {
  it('avisa al equipo con nombre, fecha y hora en el asunto', async () => {
    configureSmtp();

    await emailHelpers.sendAppointmentNotification({
      name: 'Carlos Ruiz',
      email: 'carlos@ejemplo.com',
      serviceType: 'Servidores y VPS',
      date: '2026-10-15',
      time: '11:00',
    });

    expect(sentMail()).toMatchObject({
      to: 'avisos@sonmyd.test',
      subject: 'Nueva cita agendada: Carlos Ruiz — 2026-10-15 11:00',
    });
  });
});

/**
 * La fecha y la hora de una cita son las de Colombia, tal como las eligió la persona. Los
 * correos las imprimen sin convertirlas, y aclaran la zona de la hora porque quien reserva
 * puede estar en otro país: "10:00" a secas se lee en la hora del reloj de cada quien.
 *
 * Se repite con el servidor en varias zonas: si alguien "mejorara" el formato pasando la
 * fecha por un `Date` (`new Date('2026-12-31')` es medianoche UTC), en las zonas por detrás
 * de UTC el correo diría el 30.
 */
describe.each(SERVER_TIMEZONES)('citas: fecha y hora de Colombia con el servidor en %s', (serverTimezone) => {
  const cita = {
    name: 'Ana Pérez',
    email: 'ana@ejemplo.com',
    serviceType: 'Clases de IA',
    date: '2026-12-31',
    time: '18:00',
  };

  beforeEach(() => {
    configureSmtp();
    stubServerTimezone(serverTimezone);
  });

  afterEach(resetTestEnvironment);

  it('la confirmación para quien reservó trae el día elegido y la hora con el nombre de la zona', async () => {
    await emailHelpers.sendAppointmentConfirmation(cita);

    const { html } = sentMail();
    expect(html).toContain('<strong>Fecha:</strong> 2026-12-31');
    expect(html).toContain('<strong>Hora:</strong> 18:00 (hora de Colombia)');
    expect(html).not.toContain('2026-12-30');
    expect(html).not.toContain('2027-01-01');
  });

  it('el aviso al equipo trae lo mismo, y el asunto conserva fecha y hora tal como se eligieron', async () => {
    await emailHelpers.sendAppointmentNotification(cita);

    const { subject, html } = sentMail();
    expect(subject).toBe('Nueva cita agendada: Ana Pérez — 2026-12-31 18:00');
    expect(html).toContain('<strong>Fecha:</strong> 2026-12-31');
    expect(html).toContain('<strong>Hora:</strong> 18:00 (hora de Colombia)');
  });
});

describe('citas: el nombre de la zona en los correos', () => {
  const cita = {
    name: 'Ana Pérez',
    email: 'ana@ejemplo.com',
    serviceType: 'Clases de IA',
    date: '2026-10-15',
    time: '09:00',
  };

  beforeEach(configureSmtp);

  it.each([
    ['la confirmación', () => emailHelpers.sendAppointmentConfirmation(cita)],
    ['el aviso al equipo', () => emailHelpers.sendAppointmentNotification(cita)],
  ])('%s dice "hora de Colombia" una sola vez y le habla de "tú"', async (_correo, send) => {
    await send();

    const { html } = sentMail();
    expect(html.match(/hora de Colombia/g)).toHaveLength(1);
    expect(findVoseo(html)).toEqual([]);
  });
});
