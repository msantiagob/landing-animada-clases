import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GET, POST } from '~/pages/api/appointments';
import { emailHelpers } from '~/lib/email';
import { tooLongMessage } from '~/lib/lead-validation';
import { StorageUnavailableError, type LeadStore } from '~/lib/storage';
import { isValidId } from '~/lib/storage/ids';
import { SERVICE_TYPE_OPTIONS } from '~/utils/booking';
import {
  SERVER_TIMEZONES,
  createTestStore,
  freezeClock,
  jsonRequest,
  readJson,
  resetTestEnvironment,
  stubServerTimezone,
  tomorrow,
} from './helpers';
import { findVoseo } from './voseo';

const ENDPOINT = 'https://sonmyd.co/api/appointments';

const validBody = () => ({
  name: 'Carlos Ruiz',
  email: 'carlos@example.com',
  serviceType: 'Asistente de WhatsApp con IA',
  date: tomorrow(),
  time: '10:00',
  phone: '+57 300 111 2222',
  message: 'Necesito automatizar la atención.',
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST({ request: jsonRequest(ENDPOINT, body, { headers }) } as never);

const getAvailability = (query: string) => GET({ url: new URL(`${ENDPOINT}${query}`) } as never);

describe('POST /api/appointments', () => {
  let store: LeadStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(emailHelpers, 'sendAppointmentConfirmation').mockResolvedValue(true);
    vi.spyOn(emailHelpers, 'sendAppointmentNotification').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetTestEnvironment();
  });

  it('agenda la cita en el store y avisa al cliente y al equipo', async () => {
    const body = validBody();
    const response = await post(body);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.appointment).toEqual({ id: expect.any(String), date: body.date, time: '10:00', duration: 60 });

    const appointments = await store.listAppointments();
    expect(appointments).toHaveLength(1);

    const [saved] = appointments;
    expect(payload.appointment.id).toBe(saved.id);
    expect(isValidId(saved.id)).toBe(true);
    expect(saved).toMatchObject({
      name: 'Carlos Ruiz',
      email: 'carlos@example.com',
      phone: '+57 300 111 2222',
      company: null,
      service_type: 'Asistente de WhatsApp con IA',
      date: body.date,
      time: '10:00',
      timezone: 'America/Bogota',
      duration: 60,
      message: 'Necesito automatizar la atención.',
      status: 'pending',
    });

    expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledTimes(1);
    expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'carlos@example.com', date: body.date, time: '10:00' })
    );
    expect(emailHelpers.sendAppointmentNotification).toHaveBeenCalledTimes(1);
  });

  it('normaliza el email a minúsculas y recorta los espacios', async () => {
    await post({ ...validBody(), name: '  Carlos Ruiz ', email: '  Carlos@Example.COM ', phone: '  ' });

    const [saved] = await store.listAppointments();
    expect(saved.name).toBe('Carlos Ruiz');
    expect(saved.email).toBe('carlos@example.com');
    expect(saved.phone).toBeNull();
  });

  // Las opciones del formulario salen de SILOS + "Otro": la API tiene que
  // aceptar cada una tal cual y guardarla con el mismo texto que se ve.
  it.each([...SERVICE_TYPE_OPTIONS])(
    'acepta el tipo de servicio "%s" que ofrece el formulario',
    async (serviceType) => {
      const response = await post({ ...validBody(), serviceType });

      expect(response.status).toBe(200);
      expect((await store.listAppointments())[0].service_type).toBe(serviceType);
    }
  );

  // La API no tiene lista cerrada de servicios a propósito: una página en caché
  // con las opciones viejas ("Desarrollo Web") no puede perder una reserva.
  it('no rechaza un tipo de servicio heredado de la versión anterior del formulario', async () => {
    const response = await post({ ...validBody(), serviceType: 'Desarrollo Web' });

    expect(response.status).toBe(200);
    expect((await store.listAppointments())[0].service_type).toBe('Desarrollo Web');
  });

  it('rechaza un tipo de servicio compuesto solo por espacios', async () => {
    const response = await post({ ...validBody(), serviceType: '   ' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it.each([
    ['sin nombre', { name: '' }],
    ['sin email', { email: '' }],
    ['sin servicio', { serviceType: '' }],
    ['sin fecha', { date: '' }],
    ['sin hora', { time: '' }],
  ])('rechaza con 400 %s', async (_label, patch) => {
    const response = await post({ ...validBody(), ...patch });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it('rechaza un email con formato inválido', async () => {
    const response = await post({ ...validBody(), email: 'no-es-un-email' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/email inválido/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  // Un cuerpo ilegible es un error del cliente: 400, ninguna cita y ningún correo.
  it.each([
    ['un JSON roto', '{"name": "Carlos", ', 'application/json'],
    ['un JSON vacío', '', 'application/json'],
    ['un JSON que no es un objeto', 'null', 'application/json'],
    ['un Content-Type desconocido', 'name=Carlos', 'text/plain'],
  ])('responde 400, y no 500, ante %s', async (_caso, body, contentType) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: new Request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': contentType }, body }),
    } as never);

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(await store.listAppointments()).toHaveLength(0);
    expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
    expect(emailHelpers.sendAppointmentNotification).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    ['con el formato dd/MM/yyyy', '25/12/2026'],
    ['con el mes sin cero a la izquierda', '2026-1-05'],
    ['que no es una fecha', 'mañana'],
  ])('rechaza una fecha %s', async (_caso, date) => {
    const response = await post({ ...validBody(), date });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/fecha u hora inválido/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it('rechaza una fecha calendario imposible', async () => {
    const response = await post({ ...validBody(), date: '2027-02-31' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/fecha u hora inválido/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it('rechaza una hora sin el formato HH:mm', async () => {
    const response = await post({ ...validBody(), time: '9:00' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/fecha u hora inválido/i);
  });

  it('rechaza citas en el pasado', async () => {
    const response = await post({ ...validBody(), date: '2020-01-15' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/anticipación/i);
    expect(await store.listAppointments()).toHaveLength(0);
  });

  // Se fija el reloj (solo Date) en una mañana conocida para probar el borde de las 2 horas.
  // Las horas son de Colombia (UTC-5) y el instante se escribe con su desfase, para que el test
  // no dependa de la zona de la máquina que lo corre.
  describe('anticipación mínima de 2 horas', () => {
    const today = '2026-10-05';

    it('rechaza un turno con menos de 2 horas de anticipación', async () => {
      freezeClock('2026-10-05T09:30:00-05:00');

      const response = await post({ ...validBody(), date: today, time: '11:00' });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/2 horas de anticipación/);
      expect(await store.listAppointments()).toHaveLength(0);
    });

    it('acepta un turno justo con 2 horas de anticipación', async () => {
      freezeClock('2026-10-05T09:00:00-05:00');

      const response = await post({ ...validBody(), date: today, time: '11:00' });

      expect(response.status).toBe(200);
      expect(await store.getTakenSlots(today)).toEqual(['11:00']);
    });
  });

  /**
   * La fecha y la hora que manda la persona son hora de Colombia (UTC-5). Netlify corre las
   * funciones en UTC: leerlas con la zona del servidor corría todo cinco horas (y más o menos
   * según dónde estuviera el servidor). Cada caso se repite con el servidor en otras zonas y el
   * veredicto tiene que ser el mismo.
   */
  describe.each(SERVER_TIMEZONES)('zona horaria: con el servidor en %s', (serverTimezone) => {
    beforeEach(() => stubServerTimezone(serverTimezone));

    it('acepta a las 08:00 de Colombia el turno de las 11:00 de hoy (3 horas), y lo guarda como se pidió', async () => {
      freezeClock('2026-10-05T08:00:00-05:00');

      const response = await post({ ...validBody(), date: '2026-10-05', time: '11:00' });

      expect(response.status).toBe(200);
      const [saved] = await store.listAppointments();
      expect(saved).toMatchObject({ date: '2026-10-05', time: '11:00', timezone: 'America/Bogota' });
      expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-10-05', time: '11:00' })
      );
    });

    it('rechaza a las 08:00 de Colombia el turno de las 09:00 de hoy: falta 1 hora', async () => {
      freezeClock('2026-10-05T08:00:00-05:00');

      const response = await post({ ...validBody(), date: '2026-10-05', time: '09:00' });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/2 horas de anticipación/);
      expect(await store.listAppointments()).toHaveLength(0);
    });

    it('el límite de las 2 horas es exacto: a las 07:00 se acepta el turno de las 09:00', async () => {
      freezeClock('2026-10-05T07:00:00.000-05:00');

      const response = await post({ ...validBody(), date: '2026-10-05', time: '09:00' });

      expect(response.status).toBe(200);
      expect(await store.getTakenSlots('2026-10-05')).toEqual(['09:00']);
    });

    it('un milisegundo después del límite de las 2 horas, el turno de las 09:00 ya no se acepta', async () => {
      freezeClock('2026-10-05T07:00:00.001-05:00');

      const response = await post({ ...validBody(), date: '2026-10-05', time: '09:00' });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/2 horas de anticipación/);
      expect(await store.listAppointments()).toHaveLength(0);
    });

    it('de noche, con UTC ya en mañana: lo que pasó hoy en Colombia se rechaza y el primer turno de mañana se acepta', async () => {
      // 21:30 del lunes 5 en Colombia = 02:30 UTC del martes 6.
      freezeClock('2026-10-06T02:30:00.000Z');

      const past = await post({ ...validBody(), date: '2026-10-05', time: '18:00' });
      expect(past.status).toBe(400);
      expect((await readJson(past)).error).toMatch(/anticipación/i);

      const next = await post({ ...validBody(), date: '2026-10-06', time: '09:00' });
      expect(next.status).toBe(200);
      expect(await store.getTakenSlots('2026-10-06')).toEqual(['09:00']);
      expect(await store.getTakenSlots('2026-10-05')).toEqual([]);
    });

    // Honolulu va cinco horas por detrás de Colombia: leyendo el reloj del servidor, un turno de
    // hace tres horas parecía estar todavía por venir.
    it('rechaza un turno de hoy que ya pasó, aunque en la zona del servidor siga pareciendo futuro', async () => {
      freezeClock('2026-10-05T20:00:00-05:00');

      const response = await post({ ...validBody(), date: '2026-10-05', time: '17:00' });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/anticipación/i);
      expect(await store.listAppointments()).toHaveLength(0);
    });

    it('rechaza ayer y cualquier fecha pasada', async () => {
      freezeClock('2026-10-05T12:00:00-05:00');

      for (const date of ['2026-10-04', '2026-01-01', '2020-01-15']) {
        const response = await post({ ...validBody(), date, time: '10:00' });

        expect(response.status, date).toBe(400);
        expect((await readJson(response)).error, date).toMatch(/anticipación/i);
      }

      expect(await store.listAppointments()).toHaveLength(0);
    });

    it('la franja de atención es de Colombia: 08:59 se rechaza y 09:00 se acepta', async () => {
      const date = tomorrow();

      const early = await post({ ...validBody(), date, time: '08:59' });
      expect(early.status).toBe(400);
      expect((await readJson(early)).error).toMatch(/horario de atención/i);

      const opening = await post({ ...validBody(), date, time: '09:00' });
      expect(opening.status).toBe(200);
      expect(await store.getTakenSlots(date)).toEqual(['09:00']);
    });

    it('la franja termina a las 18:00 de Colombia: 18:00 se acepta y 18:01 se rechaza', async () => {
      const date = tomorrow();

      expect((await post({ ...validBody(), date, time: '18:00' })).status).toBe(200);

      const late = await post({ ...validBody(), date, time: '18:01', email: 'otra@example.com' });
      expect(late.status).toBe(400);
      expect((await readJson(late)).error).toMatch(/horario de atención/i);
    });
  });

  describe('zona horaria: lo que se guarda y se avisa', () => {
    it('el mensaje de la franja aclara que la hora es la de Colombia', async () => {
      const response = await post({ ...validBody(), time: '08:00' });

      expect((await readJson(response)).error).toBe('El horario de atención es de 9:00 a 18:00 (hora de Colombia)');
    });

    // La fecha y la hora son de Colombia aunque el cliente diga otra cosa: guardar su zona
    // sería afirmar que el turno es a esa hora de allá.
    it.each(['Europe/Madrid', 'America/Mexico_City', 'UTC', 'no-es-una-zona'])(
      'ignora la zona horaria que manda el cliente (%s) y guarda la de Colombia',
      async (timezone) => {
        const response = await post({ ...validBody(), timezone });

        expect(response.status).toBe(200);
        expect((await store.listAppointments())[0].timezone).toBe('America/Bogota');
      }
    );
  });

  describe('franja de atención (09:00 a 18:00, en punto)', () => {
    it.each(['09:00', '18:00'])('acepta el turno de las %s, que es un borde de la franja', async (time) => {
      expect((await post({ ...validBody(), time })).status).toBe(200);
    });

    it.each(['08:00', '19:00', '23:00', '10:30'])('rechaza el turno de las %s', async (time) => {
      const response = await post({ ...validBody(), time });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/horario de atención/i);
      expect(await store.listAppointments()).toHaveLength(0);
    });
  });

  describe('horario ya reservado', () => {
    it('devuelve 409 si el turno ya está tomado, no guarda la segunda cita y no manda emails por ella', async () => {
      await post(validBody());

      const duplicate = await post({ ...validBody(), name: 'Otra persona', email: 'otra@example.com' });

      expect(duplicate.status).toBe(409);
      expect((await readJson(duplicate)).error).toMatch(/no está disponible/i);

      const appointments = await store.listAppointments();
      expect(appointments).toHaveLength(1);
      expect(appointments[0].name).toBe('Carlos Ruiz');
      // Los dos avisos salieron una sola vez: por la reserva que sí se hizo.
      expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledTimes(1);
      expect(emailHelpers.sendAppointmentNotification).toHaveBeenCalledTimes(1);
    });

    // El mensaje llega tal cual a la pantalla de quien reserva: español de Colombia, sin voseo.
    it('el aviso de turno ocupado le habla de "tú"', async () => {
      await post(validBody());

      const { error } = await readJson(await post({ ...validBody(), email: 'otra@example.com' }));

      expect(error).toBe('Ese horario ya no está disponible. Elige otro, por favor.');
      expect(findVoseo(error)).toEqual([]);
    });

    it('con dos reservas simultáneas del mismo horario, solo una gana', async () => {
      const body = validBody();

      const [first, second] = await Promise.all([
        post({ ...body, name: 'Primera', email: 'primera@example.com' }),
        post({ ...body, name: 'Segunda', email: 'segunda@example.com' }),
      ]);

      expect([first.status, second.status].sort()).toEqual([200, 409]);
      expect(await store.listAppointments()).toHaveLength(1);
      expect(await store.getTakenSlots(body.date)).toEqual(['10:00']);
      expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledTimes(1);
    });

    it('el mismo horario en otro día, o otro horario el mismo día, sí está libre', async () => {
      const body = validBody();

      expect((await post(body)).status).toBe(200);
      expect((await post({ ...body, date: '2099-03-02' })).status).toBe(200);
      expect((await post({ ...body, time: '11:00' })).status).toBe(200);
      expect(await store.listAppointments()).toHaveLength(3);
    });

    it('vuelve a liberar el turno si la cita fue cancelada', async () => {
      const body = validBody();
      const first = await readJson(await post(body));
      await store.updateAppointmentStatus(first.appointment.id, 'cancelled');

      const response = await post({ ...body, name: 'Nuevo', email: 'nuevo@example.com' });

      expect(response.status).toBe(200);
      expect(await store.listAppointments()).toHaveLength(2);
      expect(await store.getTakenSlots(body.date)).toEqual(['10:00']);
    });
  });

  it('descarta bots que completan el honeypot sin consumir el turno', async () => {
    const body = validBody();

    const response = await post({ ...body, website: 'spam' });

    expect(response.status).toBe(200);
    expect(await store.listAppointments()).toHaveLength(0);
    expect(await store.getTakenSlots(body.date)).toEqual([]);
    expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
  });

  it('corta el flood desde una misma IP', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.4' };
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];

    for (const time of hours) {
      expect((await post({ ...validBody(), time }, headers)).status).toBe(200);
    }

    expect((await post({ ...validBody(), time: '14:00' }, headers)).status).toBe(429);
    expect(await store.listAppointments()).toHaveLength(5);
  });

  it('el aviso de demasiados intentos le habla de "tú"', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.5' };
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    for (const time of hours) await post({ ...validBody(), time }, headers);

    const { error } = await readJson(await post({ ...validBody(), time: '14:00' }, headers));

    expect(error).toBe('Demasiados envíos. Espera unos minutos e inténtalo de nuevo.');
    expect(findVoseo(error)).toEqual([]);
  });

  // En una función serverless lo que sigue después de responder puede quedar congelado:
  // sin waitUntil, los avisos de una cita nueva se perderían en silencio.
  it('le entrega los dos emails a waitUntil de Netlify para que la función siga viva hasta enviarlos', async () => {
    const waitUntil = vi.fn();

    const response = await POST({
      request: jsonRequest(ENDPOINT, validBody()),
      locals: { netlify: { context: { waitUntil } } },
    } as never);

    expect(response.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  /**
   * Cada campo de texto tiene un tope (`FIELD_LIMITS`, el mismo que llevan los formularios como
   * `maxlength`): justo en el tope se acepta y se guarda completo; uno más se rechaza con un 400
   * que dice qué campo es y cuál es el máximo, sin gastar el turno ni mandar ningún correo.
   */
  describe('topes de longitud', () => {
    const DOMINIO = '@ejemplo.com';

    /** Un valor de exactamente `length` caracteres que es válido para ese campo. */
    const deLongitud = (field: string, length: number): string =>
      field === 'email' ? 'a'.repeat(length - DOMINIO.length) + DOMINIO : 'a'.repeat(length);

    // [campo del cuerpo, tope, campo del registro guardado]
    const CAMPOS = [
      ['name', 100, 'name'],
      ['email', 254, 'email'],
      ['phone', 30, 'phone'],
      ['company', 100, 'company'],
      ['message', 5000, 'message'],
      ['serviceType', 100, 'service_type'],
    ] as const;

    it.each(CAMPOS)('%s: acepta exactamente %i caracteres y lo guarda completo', async (field, max, record) => {
      const body = { ...validBody(), [field]: deLongitud(field, max) };

      const response = await post(body);

      expect(response.status).toBe(200);
      const [saved] = await store.listAppointments();
      expect(saved[record]).toHaveLength(max);
      expect(saved[record]).toBe(deLongitud(field, max));
      expect(await store.getTakenSlots(body.date)).toEqual(['10:00']);
    });

    it.each(CAMPOS)('%s: rechaza %i + 1 caracteres con un 400 que lo explica', async (field, max) => {
      const body = { ...validBody(), [field]: deLongitud(field, max + 1) };

      const response = await post(body);
      const payload = await readJson(response);

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe(tooLongMessage(field));
      expect(payload.error).toContain(`Usa máximo ${max} caracteres`);
      expect(findVoseo(payload.error)).toEqual([]);
      expect(await store.listAppointments()).toHaveLength(0);
      expect(await store.getTakenSlots(body.date)).toEqual([]);
      expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
      expect(emailHelpers.sendAppointmentNotification).not.toHaveBeenCalled();
    });

    it('los espacios de los extremos no cuentan: 100 caracteres con espacios alrededor se aceptan', async () => {
      const response = await post({ ...validBody(), name: `   ${'a'.repeat(100)}   ` });

      expect(response.status).toBe(200);
      expect((await store.listAppointments())[0].name).toBe('a'.repeat(100));
    });

    it('un campo opcional vacío o ausente no se mide', async () => {
      expect((await post({ ...validBody(), phone: '', company: undefined, message: '' })).status).toBe(200);
    });

    it('con varios campos pasados de su tope, avisa del primero en el orden del formulario', async () => {
      const response = await post({ ...validBody(), serviceType: 'a'.repeat(101), company: 'a'.repeat(101) });

      expect((await readJson(response)).error).toBe(tooLongMessage('company'));
    });

    it('el tope va antes que el formato: un email desmedido se rechaza por largo, no por mal escrito', async () => {
      const response = await post({ ...validBody(), email: 'x'.repeat(300) });

      expect((await readJson(response)).error).toBe(tooLongMessage('email'));
    });

    it('los obligatorios siguen primero: sin hora responde "obligatorios" aunque otro campo sea desmedido', async () => {
      const response = await post({ ...validBody(), time: '', message: 'a'.repeat(5001) });

      expect((await readJson(response)).error).toMatch(/obligatorios/i);
    });

    // La expresión regular del email tarda un tiempo cuadrático ante un texto largo que no encaja
    // (50.000 caracteres son unos 7 segundos de CPU de la función, con una sola petición).
    it('un email adversario de 50.000 caracteres se rechaza al instante, sin llegar a la expresión regular', async () => {
      const inicio = performance.now();

      const response = await post({ ...validBody(), email: `a@${'.'.repeat(50_000)} b` });

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toBe(tooLongMessage('email'));
      expect(performance.now() - inicio).toBeLessThan(1000);
    });
  });

  it('responde 200 aunque fallen los emails, porque la cita ya está guardada, y deja el fallo en los logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(emailHelpers, 'sendAppointmentConfirmation').mockRejectedValue(new Error('SMTP caído'));
    vi.spyOn(emailHelpers, 'sendAppointmentNotification').mockRejectedValue(new Error('SMTP caído'));

    const response = await post(validBody());

    expect(response.status).toBe(200);
    expect(await store.listAppointments()).toHaveLength(1);
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[background]'),
      expect.objectContaining({ message: 'SMTP caído' })
    );
  });

  describe('cuando el almacenamiento falla', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('devuelve 500 genérico, sin filtrar detalles internos, ante un error inesperado', async () => {
      vi.spyOn(store, 'createAppointment').mockRejectedValue(new Error('EIO: i/o error, write /var/task/slots'));

      const response = await post(validBody());
      const payload = await readJson(response);

      expect(response.status).toBe(500);
      expect(JSON.stringify(payload)).not.toMatch(/EIO|\/var\/task/);
      expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('[api/appointments] Error procesando cita:', expect.any(Error));
    });

    // Netlify Blobs caído no es un bug del sitio: la persona puede reintentar.
    it('devuelve 503 reintentable, sin filtrar el fallo de Blobs, y no avisa de una cita que no se guardó', async () => {
      vi.spyOn(store, 'createAppointment').mockRejectedValue(
        new StorageUnavailableError('Netlify Blobs falló al reservar slot/2099', {
          cause: new Error('connect ETIMEDOUT 10.0.0.1:443'),
        })
      );

      const response = await post(validBody());
      const payload = await readJson(response);

      expect(response.status).toBe(503);
      expect(payload.error).toBe('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(JSON.stringify(payload)).not.toMatch(/Blobs|ETIMEDOUT|slot\//);
      expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
      expect(emailHelpers.sendAppointmentNotification).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/appointments (disponibilidad)', () => {
  let store: LeadStore;

  beforeEach(() => {
    store = createTestStore();
    vi.spyOn(emailHelpers, 'sendAppointmentConfirmation').mockResolvedValue(true);
    vi.spyOn(emailHelpers, 'sendAppointmentNotification').mockResolvedValue(true);
  });

  afterEach(resetTestEnvironment);

  /** Deja una cita agendada directamente en el store (el "arrange" de estos tests). */
  const book = async (date: string, time: string) => {
    const result = await store.createAppointment({
      name: 'Carlos Ruiz',
      email: 'carlos@example.com',
      serviceType: 'Otro',
      date,
      time,
    });

    if (!result.created) throw new Error(`El horario ${date} ${time} ya estaba ocupado`);

    return result.appointment;
  };

  it('exige el parámetro date', async () => {
    const response = await getAvailability('');

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/requerida/i);
  });

  it.each(['?date=mañana', '?date=2026-1-5', '?date=2026-10-05T10:00', '?date=05/10/2026'])(
    'valida el formato de date: rechaza %s',
    async (query) => {
      const response = await getAvailability(query);

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatch(/formato de fecha inválido/i);
    }
  );

  it('devuelve los 10 turnos del día cuando no hay nada agendado', async () => {
    const date = tomorrow();

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.success).toBe(true);
    expect(payload.date).toBe(date);
    expect(payload.availableSlots).toHaveLength(10);
    expect(payload.availableSlots[0]).toBe('09:00');
    expect(payload.availableSlots.at(-1)).toBe('18:00');
    expect(payload.bookedSlots).toEqual([]);
  });

  it('excluye los turnos ya reservados por la API', async () => {
    const date = tomorrow();
    await post({ ...validBody(), date, time: '10:00' });

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.bookedSlots).toEqual(['10:00']);
    expect(payload.availableSlots).not.toContain('10:00');
    expect(payload.availableSlots).toHaveLength(9);
  });

  it('devuelve los turnos ocupados en orden ascendente, sin importar el orden en que se reservaron', async () => {
    const date = tomorrow();
    await book(date, '15:00');
    await book(date, '09:00');
    await book(date, '12:00');

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.bookedSlots).toEqual(['09:00', '12:00', '15:00']);
    expect(payload.availableSlots).toEqual(['10:00', '11:00', '13:00', '14:00', '16:00', '17:00', '18:00']);
  });

  it('un turno ocupado otro día no afecta al día consultado', async () => {
    const date = tomorrow();
    await book('2099-03-02', '10:00');

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.bookedSlots).toEqual([]);
    expect(payload.availableSlots).toHaveLength(10);
  });

  it('no cuenta como ocupados los turnos cancelados', async () => {
    const date = tomorrow();
    const appointment = await book(date, '10:00');
    await store.updateAppointmentStatus(appointment.id, 'cancelled');

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.bookedSlots).toEqual([]);
    expect(payload.availableSlots).toContain('10:00');
  });

  describe('cuando el almacenamiento falla', () => {
    let consoleError: MockInstance<typeof console.error>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('devuelve 500 genérico, sin filtrar detalles internos, ante un error inesperado', async () => {
      vi.spyOn(store, 'getTakenSlots').mockRejectedValue(new Error('EIO: i/o error, read /var/task/slots'));

      const response = await getAvailability(`?date=${tomorrow()}`);
      const payload = await readJson(response);

      expect(response.status).toBe(500);
      expect(JSON.stringify(payload)).not.toMatch(/EIO|\/var\/task/);
      expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
      expect(consoleError).toHaveBeenCalledWith(
        '[api/appointments] Error obteniendo disponibilidad:',
        expect.any(Error)
      );
    });

    it('devuelve 503 reintentable si Netlify Blobs no responde', async () => {
      vi.spyOn(store, 'getTakenSlots').mockRejectedValue(new StorageUnavailableError('Netlify Blobs falló al listar'));

      const response = await getAvailability(`?date=${tomorrow()}`);
      const payload = await readJson(response);

      expect(response.status).toBe(503);
      expect(payload.error).toBe('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.');
      expect(findVoseo(payload.error)).toEqual([]);
      expect(JSON.stringify(payload)).not.toContain('Blobs');
    });
  });
});
