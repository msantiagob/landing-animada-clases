import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '~/pages/api/appointments';
import { dbHelpers } from '~/lib/database';
import { emailHelpers } from '~/lib/email';
import { SERVICE_TYPE_OPTIONS } from '~/utils/booking';
import { closeTestDb, createTestDb, jsonRequest, readJson, tomorrow } from './helpers';
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
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(emailHelpers, 'sendAppointmentConfirmation').mockResolvedValue(true);
    vi.spyOn(emailHelpers, 'sendAppointmentNotification').mockResolvedValue(true);
  });

  afterEach(() => closeTestDb(db));

  it('agenda la cita y avisa al cliente y al equipo', async () => {
    const response = await post(validBody());
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.appointment.time).toBe('10:00');

    const [saved] = dbHelpers.getAppointments();
    expect(saved.service_type).toBe('Asistente de WhatsApp con IA');
    expect(saved.status).toBe('pending');
    expect(saved.duration).toBe(60);

    expect(emailHelpers.sendAppointmentConfirmation).toHaveBeenCalledTimes(1);
    expect(emailHelpers.sendAppointmentNotification).toHaveBeenCalledTimes(1);
  });

  // Las opciones del formulario salen de SILOS + "Otro": la API tiene que
  // aceptar cada una tal cual y guardarla con el mismo texto que se ve.
  it.each([...SERVICE_TYPE_OPTIONS])(
    'acepta el tipo de servicio "%s" que ofrece el formulario',
    async (serviceType) => {
      const response = await post({ ...validBody(), serviceType });

      expect(response.status).toBe(200);
      expect(dbHelpers.getAppointments()[0].service_type).toBe(serviceType);
    }
  );

  // La API no tiene lista cerrada de servicios a propósito: una página en caché
  // con las opciones viejas ("Desarrollo Web") no puede perder una reserva.
  it('no rechaza un tipo de servicio heredado de la versión anterior del formulario', async () => {
    const response = await post({ ...validBody(), serviceType: 'Desarrollo Web' });

    expect(response.status).toBe(200);
    expect(dbHelpers.getAppointments()[0].service_type).toBe('Desarrollo Web');
  });

  it('rechaza un tipo de servicio compuesto solo por espacios', async () => {
    const response = await post({ ...validBody(), serviceType: '   ' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/obligatorios/i);
    expect(dbHelpers.getAppointments()).toHaveLength(0);
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
    expect(dbHelpers.getAppointments()).toHaveLength(0);
    expect(emailHelpers.sendAppointmentConfirmation).not.toHaveBeenCalled();
    expect(emailHelpers.sendAppointmentNotification).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('rechaza formatos de fecha que no sean yyyy-MM-dd', async () => {
    const response = await post({ ...validBody(), date: '25/12/2026' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/fecha u hora inválido/i);
  });

  it('rechaza una fecha calendario imposible', async () => {
    const response = await post({ ...validBody(), date: '2027-02-31' });

    expect(response.status).toBe(400);
  });

  it('rechaza citas en el pasado', async () => {
    const response = await post({ ...validBody(), date: '2020-01-15' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/anticipación/i);
  });

  it('rechaza horarios fuera de la franja de atención', async () => {
    const response = await post({ ...validBody(), time: '23:00' });

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/horario de atención/i);
  });

  it('devuelve 409 si el turno ya está tomado', async () => {
    await post(validBody());

    const duplicate = await post({ ...validBody(), name: 'Otra persona', email: 'otra@example.com' });

    expect(duplicate.status).toBe(409);
    expect((await readJson(duplicate)).error).toMatch(/no está disponible/i);
    expect(dbHelpers.getAppointments()).toHaveLength(1);
  });

  // El mensaje llega tal cual a la pantalla de quien reserva: español de Colombia, sin voseo.
  it('el aviso de turno ocupado le habla de "tú"', async () => {
    await post(validBody());

    const { error } = await readJson(await post({ ...validBody(), email: 'otra@example.com' }));

    expect(error).toMatch(/Elige otro/);
    expect(error).not.toMatch(/Elegí/);
  });

  it('vuelve a liberar el turno si la cita fue cancelada', async () => {
    await post(validBody());
    dbHelpers.updateAppointmentStatus(1, 'cancelled');

    const response = await post({ ...validBody(), name: 'Nuevo', email: 'nuevo@example.com' });

    expect(response.status).toBe(200);
  });

  it('descarta bots que completan el honeypot', async () => {
    const response = await post({ ...validBody(), website: 'spam' });

    expect(response.status).toBe(200);
    expect(dbHelpers.getAppointments()).toHaveLength(0);
  });

  it('corta el flood desde una misma IP', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.4' };
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];

    for (const time of hours) {
      expect((await post({ ...validBody(), time }, headers)).status).toBe(200);
    }

    expect((await post({ ...validBody(), time: '14:00' }, headers)).status).toBe(429);
  });

  it('el aviso de demasiados intentos le habla de "tú"', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.5' };
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    for (const time of hours) await post({ ...validBody(), time }, headers);

    const { error } = await readJson(await post({ ...validBody(), time: '14:00' }, headers));

    expect(error).toBe('Demasiados envíos. Espera unos minutos e inténtalo de nuevo.');
    expect(findVoseo(error)).toEqual([]);
  });

  it('devuelve 500 genérico si la base falla', async () => {
    vi.spyOn(dbHelpers, 'insertAppointment').mockImplementation(() => {
      throw new Error('disk I/O error');
    });

    const response = await post(validBody());

    const payload = await readJson(response);

    expect(response.status).toBe(500);
    expect(JSON.stringify(payload)).not.toContain('disk I/O');
    expect(payload.error).toBe('Error interno del servidor. Inténtalo más tarde.');
    expect(findVoseo(payload.error)).toEqual([]);
  });
});

describe('GET /api/appointments (disponibilidad)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(emailHelpers, 'sendAppointmentConfirmation').mockResolvedValue(true);
    vi.spyOn(emailHelpers, 'sendAppointmentNotification').mockResolvedValue(true);
  });

  afterEach(() => closeTestDb(db));

  it('exige el parámetro date', async () => {
    const response = await getAvailability('');

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toMatch(/requerida/i);
  });

  it('valida el formato de date', async () => {
    const response = await getAvailability('?date=mañana');

    expect(response.status).toBe(400);
  });

  it('devuelve los 10 turnos del día cuando no hay nada agendado', async () => {
    const payload = await readJson(await getAvailability(`?date=${tomorrow()}`));

    expect(payload.availableSlots).toHaveLength(10);
    expect(payload.availableSlots[0]).toBe('09:00');
    expect(payload.availableSlots.at(-1)).toBe('18:00');
    expect(payload.bookedSlots).toEqual([]);
  });

  it('excluye los turnos ya reservados', async () => {
    const date = tomorrow();
    await post({ ...validBody(), date, time: '10:00' });

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.bookedSlots).toEqual(['10:00']);
    expect(payload.availableSlots).not.toContain('10:00');
    expect(payload.availableSlots).toHaveLength(9);
  });

  it('no cuenta como ocupados los turnos cancelados', async () => {
    const date = tomorrow();
    await post({ ...validBody(), date, time: '10:00' });
    dbHelpers.updateAppointmentStatus(1, 'cancelled');

    const payload = await readJson(await getAvailability(`?date=${date}`));

    expect(payload.availableSlots).toContain('10:00');
  });
});
