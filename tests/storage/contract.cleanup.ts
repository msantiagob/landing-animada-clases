import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyValueLeadStore, type KeyValueBackend } from '~/lib/storage/core';
import { StorageUnavailableError } from '~/lib/storage/errors';
import type { LeadStore, StorageBackend, StorageScope } from '~/lib/storage/types';
import { FaultyKeyValueBackend } from './faulty-backend';
import { DAY, appointmentInput, bookAppointmentRecord } from './helpers';

export interface CleanupTarget {
  label: string;
  backend: StorageBackend;
  scope: StorageScope;
  /** Un almacén clave-valor vacío. */
  createInner(): KeyValueBackend;
}

const SLOT = 'slot/2031-03-14T1000';
const outage = new Error('se cortó la conexión');
const cleanupOutage = new Error('el borrado también falló');

/**
 * Qué queda en el almacenamiento cuando falla la reserva de un horario.
 *
 * La regla es que NUNCA quede un horario a nombre de una cita que ya no existe: nadie
 * podría liberarlo (una cita borrada no se puede cancelar desde el panel) y esa franja
 * quedaría bloqueada para siempre. Lo peor tolerable es una cita sin horario o una cita
 * con su horario: las dos se ven en el panel y se pueden resolver.
 */
export const cleanupSection = (target: CleanupTarget) => {
  let inner: KeyValueBackend;
  let faulty: FaultyKeyValueBackend;
  let store: LeadStore;

  beforeEach(() => {
    inner = target.createInner();
    faulty = new FaultyKeyValueBackend(inner);
    store = new KeyValueLeadStore(faulty, { backend: target.backend, scope: target.scope });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('la reserva se aplicó pero la llamada falló (respuesta perdida, corte tras escribir)', () => {
    it('el horario queda libre, la cita se borra y sale el error original', async () => {
      faulty.fail('setIfAbsent', outage, { key: SLOT, afterApplying: true });

      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      expect(await inner.keys('')).toEqual([]);
      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });

    it('lo mismo si lo que falla es la lectura que comprueba quién quedó como titular', async () => {
      faulty.fail('get', outage, { key: SLOT, times: 1 });

      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      expect(await inner.keys('')).toEqual([]);
    });

    it('después de la limpieza la persona puede reintentar y quedarse con el horario', async () => {
      faulty.fail('setIfAbsent', outage, { key: SLOT, afterApplying: true, times: 1 });
      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      const retry = await store.createAppointment(appointmentInput());

      expect(retry.created).toBe(true);
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
      expect(await store.listAppointments()).toHaveLength(1);
    });
  });

  describe('la reserva no se aplicó', () => {
    it('si la llamada falla antes de escribir, no queda nada y sale el error original', async () => {
      faulty.fail('setIfAbsent', outage, { key: SLOT, times: 1 });

      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      expect(await inner.keys('')).toEqual([]);
      expect((await store.createAppointment(appointmentInput())).created).toBe(true);
    });

    it('si el servicio contesta "ok" sin haber escrito (un 5xx), no se da la cita por reservada y no queda nada', async () => {
      faulty.fail('setIfAbsent', undefined, { key: SLOT, times: 1, silently: true });

      const error = await store.createAppointment(appointmentInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect(await inner.keys('')).toEqual([]);
    });
  });

  describe('el horario es de otra cita', () => {
    it('si falla la lectura de comprobación, la limpieza no toca el horario ajeno', async () => {
      const first = await bookAppointmentRecord(store, { name: 'Primera' });
      faulty.fail('get', outage, { key: SLOT, times: 1 });

      await expect(store.createAppointment(appointmentInput({ name: 'Segunda' }))).rejects.toBe(outage);

      expect(await inner.get(SLOT)).toEqual({ appointmentId: first.id, claimedAt: expect.any(String) });
      expect(await store.listAppointments()).toEqual([first]);
    });

    it('aunque la escritura "se aplique" (sin efecto, porque ya existía) y luego falle, el horario ajeno sigue en pie', async () => {
      const first = await bookAppointmentRecord(store, { name: 'Primera' });
      faulty.fail('setIfAbsent', outage, { key: SLOT, afterApplying: true, times: 1 });

      await expect(store.createAppointment(appointmentInput({ name: 'Segunda' }))).rejects.toBe(outage);

      expect(await inner.get(SLOT)).toEqual({ appointmentId: first.id, claimedAt: expect.any(String) });
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
      expect(await store.listAppointments()).toEqual([first]);
    });

    it('si la limpieza no puede ni leer quién tiene el horario, no borra nada: ni el horario ni la cita', async () => {
      const first = await bookAppointmentRecord(store, { name: 'Primera' });
      faulty.fail('get', outage, { key: SLOT });

      await expect(store.createAppointment(appointmentInput({ name: 'Segunda' }))).rejects.toBe(outage);

      expect(await inner.get(SLOT)).toEqual({ appointmentId: first.id, claimedAt: expect.any(String) });
      expect(await inner.keys('appointment/')).toHaveLength(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo liberar el horario'),
        SLOT,
        outage
      );
    });
  });

  describe('la limpieza también falla', () => {
    it('el error que sale es el original, y la cita se conserva junto a su horario para poder cancelarla', async () => {
      faulty.fail('setIfAbsent', outage, { key: SLOT, afterApplying: true, times: 1 });
      faulty.fail('delete', cleanupOutage, { key: SLOT, times: 1 });

      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo liberar el horario'),
        SLOT,
        cleanupOutage
      );
      const [kept] = await store.listAppointments();
      expect(kept.status).toBe('pending');
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);

      // La cita existe, así que el panel puede cancelarla y con eso se libera el horario.
      await store.updateAppointmentStatus(kept.id, 'cancelled');

      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });

    it('si lo que falla es borrar la cita ya sin horario, queda una cita sin horario y el error original sale', async () => {
      faulty.fail('setIfAbsent', outage, { key: SLOT, afterApplying: true, times: 1 });
      faulty.fail('delete', cleanupOutage, { key: /^appointment\// });

      await expect(store.createAppointment(appointmentInput())).rejects.toBe(outage);

      expect(await store.getTakenSlots(DAY)).toEqual([]);
      expect(await store.listAppointments()).toHaveLength(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo limpiar'),
        expect.any(String),
        cleanupOutage
      );
    });
  });
};
