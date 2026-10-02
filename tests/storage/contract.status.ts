import { describe, expect, it } from 'vitest';
import { APPOINTMENT_STATUSES, CONTACT_STATUSES } from '~/lib/storage/types';
import {
  DAY,
  appointmentInput,
  bookAppointment,
  bookAppointmentRecord,
  contactInput,
  seedContact,
  steppingClock,
  testId,
  type ContractTarget,
} from './helpers';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Ids que nunca deben llegar a tocar un registro: vacíos, de otra forma o con intentos de salirse de la clave. */
const MALFORMED_IDS = [
  '',
  'no-es-un-id',
  testId(1).toLowerCase(),
  testId(1).slice(1),
  `${testId(1)}0`,
  'I'.repeat(26),
  `../appointment/${testId(1)}`,
  `contact/${testId(1)}`,
  `${testId(1)}%2F`,
];

/** Cambios de estado de contactos y citas, ciclo de vida del horario y comprobación de salud. */
export const statusSection = (target: ContractTarget) => {
  describe('estado de los contactos', () => {
    it.each(CONTACT_STATUSES)('cambia el estado a "%s", refresca updated_at y conserva created_at', async (status) => {
      const store = target.create({ now: steppingClock() });
      const created = await store.createContact(contactInput());

      const updated = await store.updateContactStatus(created.id, status);

      expect(updated).toEqual({ ...created, status, updated_at: expect.any(String) });
      expect(updated!.updated_at > created.updated_at).toBe(true);
      expect(await store.listContacts()).toEqual([updated]);
    });

    it('solo cambia el contacto indicado', async () => {
      const store = target.create();
      await seedContact(store, { name: 'Primero' });
      const second = await seedContact(store, { name: 'Segundo' });

      await store.updateContactStatus(second, 'closed');

      const byName = Object.fromEntries((await store.listContacts()).map((c) => [c.name, c.status]));
      expect(byName).toEqual({ Primero: 'new', Segundo: 'closed' });
    });

    it('el último cambio es el que queda', async () => {
      const store = target.create();
      const id = await seedContact(store);

      await store.updateContactStatus(id, 'contacted');
      await store.updateContactStatus(id, 'closed');
      await store.updateContactStatus(id, 'new');

      expect((await store.listContacts())[0].status).toBe('new');
    });

    it('devuelve null si el id tiene la forma correcta pero no existe', async () => {
      const store = target.create();
      await seedContact(store);

      expect(await store.updateContactStatus(testId(404), 'closed')).toBeNull();
    });

    it.each(MALFORMED_IDS)('devuelve null con el id mal formado %j y no altera nada', async (id) => {
      const store = target.create();
      const before = await store.createContact(contactInput());

      expect(await store.updateContactStatus(id, 'closed')).toBeNull();
      expect(await store.listContacts()).toEqual([before]);
    });

    it('el id de una cita no sirve para actualizar un contacto', async () => {
      const store = target.create();
      const appointmentId = await bookAppointment(store);

      expect(await store.updateContactStatus(appointmentId, 'closed')).toBeNull();
    });
  });

  describe('estado de las citas', () => {
    it.each(APPOINTMENT_STATUSES.filter((status) => status !== 'cancelled'))(
      'cambia el estado a "%s" y el horario sigue ocupado',
      async (status) => {
        const store = target.create({ now: steppingClock() });
        const booked = await bookAppointmentRecord(store, { time: '09:00' });

        const result = await store.updateAppointmentStatus(booked.id, status);

        expect(result).toEqual({
          outcome: 'updated',
          appointment: { ...booked, status, updated_at: expect.any(String) },
        });
        expect(await store.getTakenSlots(DAY)).toEqual(['09:00']);
        expect(await store.createAppointment(appointmentInput({ time: '09:00' }))).toEqual({
          created: false,
          reason: 'slot-taken',
        });
      }
    );

    it('devuelve not-found si el id tiene la forma correcta pero no existe', async () => {
      const store = target.create();

      expect(await store.updateAppointmentStatus(testId(404), 'confirmed')).toEqual({ outcome: 'not-found' });
    });

    it.each(MALFORMED_IDS)('devuelve not-found con el id mal formado %j y no altera nada', async (id) => {
      const store = target.create();
      const booked = await bookAppointmentRecord(store);

      expect(await store.updateAppointmentStatus(id, 'cancelled')).toEqual({ outcome: 'not-found' });
      expect(await store.listAppointments()).toEqual([booked]);
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
    });

    it('el id de un contacto no sirve para actualizar una cita', async () => {
      const store = target.create();

      expect(await store.updateAppointmentStatus(await seedContact(store), 'confirmed')).toEqual({
        outcome: 'not-found',
      });
    });
  });

  describe('ciclo de vida del horario', () => {
    it('cancelar libera el horario y otra persona puede reservarlo', async () => {
      const store = target.create();
      const id = await bookAppointment(store, { time: '14:00' });

      const cancelled = await store.updateAppointmentStatus(id, 'cancelled');

      expect(cancelled).toMatchObject({ outcome: 'updated', appointment: { id, status: 'cancelled' } });
      expect(await store.getTakenSlots(DAY)).toEqual([]);
      expect((await store.createAppointment(appointmentInput({ time: '14:00', name: 'Reemplazo' }))).created).toBe(
        true
      );
    });

    it('cancelar por segunda vez no libera el horario que ya tomó otra persona', async () => {
      const store = target.create();
      const first = await bookAppointment(store, { time: '14:00' });
      await store.updateAppointmentStatus(first, 'cancelled');
      const second = await bookAppointment(store, { time: '14:00', name: 'Reemplazo' });

      const again = await store.updateAppointmentStatus(first, 'cancelled');

      expect(again.outcome).toBe('updated');
      expect(await store.getTakenSlots(DAY)).toEqual(['14:00']);
      expect(await store.createAppointment(appointmentInput({ time: '14:00' }))).toEqual({
        created: false,
        reason: 'slot-taken',
      });
      expect((await store.listAppointments()).find((a) => a.id === second)?.status).toBe('pending');
    });

    it('reactivar una cita cancelada vuelve a ocupar su horario', async () => {
      const store = target.create();
      const id = await bookAppointment(store, { time: '16:00' });
      await store.updateAppointmentStatus(id, 'cancelled');

      const reactivated = await store.updateAppointmentStatus(id, 'confirmed');

      expect(reactivated).toMatchObject({ outcome: 'updated', appointment: { status: 'confirmed' } });
      expect(await store.getTakenSlots(DAY)).toEqual(['16:00']);
    });

    it('no se puede reactivar una cita si otra persona ya tomó su horario: sigue cancelada', async () => {
      const store = target.create();
      const original = await bookAppointment(store, { time: '16:00' });
      await store.updateAppointmentStatus(original, 'cancelled');
      const replacement = await bookAppointment(store, { time: '16:00', name: 'Reemplazo' });

      const result = await store.updateAppointmentStatus(original, 'pending');
      const listed = await store.listAppointments();

      expect(result).toEqual({ outcome: 'slot-taken' });
      expect(listed.find((a) => a.id === original)?.status).toBe('cancelled');
      expect(listed.find((a) => a.id === replacement)?.status).toBe('pending');
      expect(await store.getTakenSlots(DAY)).toEqual(['16:00']);
    });

    it.each(SEEDS)(
      'reactivar a la vez dos citas canceladas del mismo horario deja una sola vigente (intercalación %i)',
      async (seed) => {
        const store = target.create({ seed });
        const first = await bookAppointment(store, { time: '15:00' });
        await store.updateAppointmentStatus(first, 'cancelled');
        const second = await bookAppointment(store, { time: '15:00', name: 'Segunda' });
        await store.updateAppointmentStatus(second, 'cancelled');

        const results = await Promise.all([
          store.updateAppointmentStatus(first, 'pending'),
          store.updateAppointmentStatus(second, 'pending'),
        ]);
        const active = (await store.listAppointments()).filter((a) => a.status !== 'cancelled');

        expect(results.map((r) => r.outcome).sort()).toEqual(['slot-taken', 'updated']);
        expect(active).toHaveLength(1);
        expect(await store.getTakenSlots(DAY)).toEqual(['15:00']);
      }
    );
  });

  describe('orden de la lista de citas', () => {
    it('ordena por fecha y hora de la cita, la más lejana primero', async () => {
      const store = target.create();
      const early = await bookAppointment(store, { date: DAY, time: '09:00' });
      const later = await bookAppointment(store, { date: DAY, time: '16:00' });
      const far = await bookAppointment(store, { date: '2031-04-02', time: '08:00' });

      expect((await store.listAppointments()).map((a) => a.id)).toEqual([far, later, early]);
    });

    it('a igual fecha y hora (una cancelada y otra vigente) va primero la más reciente', async () => {
      const store = target.create();
      const cancelled = await bookAppointment(store, { time: '10:00' });
      await store.updateAppointmentStatus(cancelled, 'cancelled');
      const current = await bookAppointment(store, { time: '10:00', name: 'Vigente' });

      expect((await store.listAppointments()).map((a) => a.id)).toEqual([current, cancelled]);
    });
  });

  describe('salud', () => {
    it('ping responde sin crear ningún dato', async () => {
      const store = target.create();

      await expect(store.ping()).resolves.toBeUndefined();

      expect(await store.listContacts()).toEqual([]);
      expect(await store.listAppointments()).toEqual([]);
      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });
  });
};
