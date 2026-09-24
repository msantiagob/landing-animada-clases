import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '~/pages/api/appointments';
import { dbHelpers } from '~/lib/database';
import { emailHelpers } from '~/lib/email';
import { closeTestDb, createTestDb, jsonRequest, readJson, tomorrow } from './helpers';

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

  it('devuelve 500 genérico si la base falla', async () => {
    vi.spyOn(dbHelpers, 'insertAppointment').mockImplementation(() => {
      throw new Error('disk I/O error');
    });

    const response = await post(validBody());

    expect(response.status).toBe(500);
    expect(JSON.stringify(await readJson(response))).not.toContain('disk I/O');
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
