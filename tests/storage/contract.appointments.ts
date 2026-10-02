import { describe, expect, it } from 'vitest';
import { StorageUnavailableError } from '~/lib/storage/errors';
import type { CreateAppointmentResult } from '~/lib/storage/types';
import {
  DAY,
  OTHER_DAY,
  appointmentInput,
  bookAppointment,
  bookAppointmentRecord,
  idSequence,
  steppingClock,
  testId,
  type ContractTarget,
} from './helpers';

type Booked = Extract<CreateAppointmentResult, { created: true }>;

const wasBooked = (result: CreateAppointmentResult): result is Booked => result.created;

/** Semillas que cambian el orden en que se intercalan las operaciones simultáneas. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Agendar, horarios ocupados y, sobre todo, que un horario nunca se reserve dos veces. */
export const appointmentsSection = (target: ContractTarget) => {
  describe('citas', () => {
    it('agenda una cita pendiente con la zona horaria y la duración por defecto', async () => {
      const store = target.create({ now: steppingClock(), newId: idSequence(testId(1)) });

      const result = await store.createAppointment(appointmentInput());

      expect(result).toEqual({
        created: true,
        appointment: {
          id: testId(1),
          name: 'Luis Pérez',
          email: 'luis@example.com',
          phone: null,
          company: null,
          service_type: 'consultoria',
          date: DAY,
          time: '10:00',
          timezone: 'America/Bogota',
          duration: 60,
          message: null,
          status: 'pending',
          created_at: '2031-03-10T15:00:00.000Z',
          updated_at: '2031-03-10T15:00:00.000Z',
        },
      });
    });

    it('respeta la zona horaria, la duración y los datos opcionales cuando se envían', async () => {
      const store = target.create();

      const result = await store.createAppointment(
        appointmentInput({
          phone: '3001234567',
          company: 'Acme SAS',
          timezone: 'America/Mexico_City',
          duration: 90,
          message: 'Prefiero videollamada.',
        })
      );

      expect(result).toMatchObject({
        created: true,
        appointment: {
          phone: '3001234567',
          company: 'Acme SAS',
          timezone: 'America/Mexico_City',
          duration: 90,
          message: 'Prefiero videollamada.',
        },
      });
    });

    it('lo que se agenda es lo que se lee de vuelta', async () => {
      const store = target.create();

      const booked = await bookAppointmentRecord(store);

      expect(await store.listAppointments()).toEqual([booked]);
    });

    it('sin citas devuelve una lista vacía', async () => {
      expect(await target.create().listAppointments()).toEqual([]);
    });
  });

  describe('horarios ocupados', () => {
    it('devuelve las horas ocupadas del día en orden ascendente, aunque se hayan reservado desordenadas', async () => {
      const store = target.create();

      for (const time of ['15:00', '09:00', '11:00', '18:00']) await bookAppointment(store, { time });

      expect(await store.getTakenSlots(DAY)).toEqual(['09:00', '11:00', '15:00', '18:00']);
    });

    it('un día sin reservas no tiene horas ocupadas', async () => {
      const store = target.create();
      await bookAppointment(store, { date: OTHER_DAY });

      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });

    it('las reservas de un día no ocupan el mismo horario de otro día', async () => {
      const store = target.create();
      await bookAppointment(store, { date: DAY, time: '10:00' });

      const other = await store.createAppointment(appointmentInput({ date: OTHER_DAY, time: '10:00' }));

      expect(other.created).toBe(true);
      expect(await store.getTakenSlots(OTHER_DAY)).toEqual(['10:00']);
    });

    it.each(['2031-3-14', '14/03/2031', '2031-03-14\n', '../2031-03-14', ''])(
      'rechaza consultar un día con formato inválido (%j) sin confundirlo con un fallo del almacenamiento',
      async (date) => {
        const error = await target
          .create()
          .getTakenSlots(date)
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/formato inválido/);
        expect(error).not.toBeInstanceOf(StorageUnavailableError);
      }
    );

    it.each([
      ['2031-3-14', '10:00'],
      ['2031-03-14', '9:00'],
      ['2031-03-14', '10:00:00'],
      ['14/03/2031', '10:00'],
      ['2031-03-14', '10:00\n'],
      ['2031-03-14/../x', '10:00'],
      ['', ''],
    ])('rechaza agendar con fecha %j y hora %j y no deja nada guardado', async (date, time) => {
      const store = target.create();

      const error = await store.createAppointment(appointmentInput({ date, time })).catch((caught: unknown) => caught);

      expect((error as Error).message).toMatch(/formato inválido/);
      expect(error).not.toBeInstanceOf(StorageUnavailableError);
      expect(await store.listAppointments()).toEqual([]);
    });
  });

  describe('unicidad del horario', () => {
    it('la segunda reserva del mismo horario falla con slot-taken y deja intacta la primera', async () => {
      const store = target.create();
      const first = await bookAppointmentRecord(store, { name: 'Primera' });

      const second = await store.createAppointment(appointmentInput({ name: 'Segunda', email: 'segunda@example.com' }));

      expect(second).toEqual({ created: false, reason: 'slot-taken' });
      expect(await store.listAppointments()).toEqual([first]);
    });

    it('la reserva rechazada no deja ningún registro huérfano ni libera el horario', async () => {
      const store = target.create();
      await bookAppointment(store, { time: '12:00' });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await store.createAppointment(appointmentInput({ time: '12:00', name: `Rechazada ${attempt}` }));
      }

      expect(await store.listAppointments()).toHaveLength(1);
      expect(await store.getTakenSlots(DAY)).toEqual(['12:00']);
    });

    it('la misma persona tampoco puede reservar dos veces el mismo horario', async () => {
      const store = target.create();
      await bookAppointment(store);

      expect(await store.createAppointment(appointmentInput())).toEqual({ created: false, reason: 'slot-taken' });
    });

    it('otra hora del mismo día, o la misma hora otro día, sí se puede reservar', async () => {
      const store = target.create();
      await bookAppointment(store, { date: DAY, time: '10:00' });

      const results = await Promise.all([
        store.createAppointment(appointmentInput({ date: DAY, time: '11:00' })),
        store.createAppointment(appointmentInput({ date: OTHER_DAY, time: '10:00' })),
      ]);

      expect(results.map((result) => result.created)).toEqual([true, true]);
    });

    it.each(SEEDS)(
      '25 reservas simultáneas del mismo horario dejan exactamente un ganador (intercalación %i)',
      async (seed) => {
        const store = target.create({ seed });

        const results = await Promise.all(
          Array.from({ length: 25 }, (_, index) =>
            store.createAppointment(
              appointmentInput({ time: '11:00', name: `Intento ${index}`, email: `i${index}@example.com` })
            )
          )
        );
        const winners = results.filter(wasBooked);
        const stored = await store.listAppointments();

        expect(winners).toHaveLength(1);
        expect(results.filter((result) => !result.created)).toEqual(
          Array(24).fill({ created: false, reason: 'slot-taken' })
        );
        expect(stored.map((appointment) => appointment.id)).toEqual([winners[0].appointment.id]);
        expect(await store.getTakenSlots(DAY)).toEqual(['11:00']);
      }
    );

    it.each(SEEDS)('reservas simultáneas de horarios distintos salen todas bien (intercalación %i)', async (seed) => {
      const store = target.create({ seed });
      const times = Array.from({ length: 10 }, (_, index) => `${String(9 + index).padStart(2, '0')}:00`);

      const results = await Promise.all(times.map((time) => store.createAppointment(appointmentInput({ time }))));

      expect(results.every((result) => result.created)).toBe(true);
      expect(await store.getTakenSlots(DAY)).toEqual(times);
      expect(await store.listAppointments()).toHaveLength(10);
    });

    it.each(SEEDS)(
      'con varios horarios en disputa a la vez, cada uno tiene un solo ganador (intercalación %i)',
      async (seed) => {
        const store = target.create({ seed });
        const times = ['09:00', '10:00', '11:00'];

        const results = await Promise.all(
          times.flatMap((time) =>
            Array.from({ length: 8 }, (_, index) =>
              store.createAppointment(appointmentInput({ time, name: `${time} #${index}` }))
            )
          )
        );
        const stored = await store.listAppointments();

        expect(results.filter(wasBooked)).toHaveLength(3);
        expect(stored.map((appointment) => appointment.time).sort()).toEqual(times);
        expect(await store.getTakenSlots(DAY)).toEqual(times);
      }
    );
  });
};
