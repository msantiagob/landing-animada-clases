import { beforeEach, describe, expect, it } from 'vitest';
import { BlobsBackend, createBlobsStore } from '~/lib/storage/blobs';
import type { LeadStore } from '~/lib/storage/types';
import { FakeBlobsStore } from './fake-blobs';
import {
  DAY,
  appointmentInput,
  bookAppointment,
  bookAppointmentRecord,
  contactInput,
  seedContact,
  testId,
} from './helpers';

/** Cómo le habla blobs.ts al cliente de Netlify Blobs: qué claves usa y con qué opciones. */
export const blobsProtocolSection = () => {
  let fake: FakeBlobsStore;
  let store: LeadStore;

  beforeEach(() => {
    fake = new FakeBlobsStore();
    store = createBlobsStore(fake, { scope: 'site' });
  });

  describe('claves', () => {
    it('guarda contactos, citas y horarios bajo su prefijo, con el horario sin los dos puntos', async () => {
      const contact = await store.createContact(contactInput());
      const appointment = await bookAppointmentRecord(store, { date: DAY, time: '09:30' });

      expect(fake.keys()).toEqual([`appointment/${appointment.id}`, `contact/${contact.id}`, 'slot/2031-03-14T0930']);
    });

    it('todas las claves son seguras en una URL y caben en el límite del cliente', async () => {
      await store.createContact(contactInput());
      await bookAppointment(store);

      for (const key of fake.keys()) {
        expect(key).toMatch(/^[A-Za-z0-9/-]+$/);
        expect(new TextEncoder().encode(key).length).toBeLessThanOrEqual(600);
        expect(key.startsWith('/')).toBe(false);
      }
    });

    it('el horario guarda quién lo tiene y desde cuándo', async () => {
      const appointment = await bookAppointmentRecord(store, { time: '13:00' });

      expect(fake.peek('slot/2031-03-14T1300')).toEqual({
        appointmentId: appointment.id,
        claimedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });
  });

  describe('opciones enviadas al cliente', () => {
    it('solo la reserva del horario es condicional (onlyIfNew); el resto son escrituras normales', async () => {
      await store.createContact(contactInput());
      await bookAppointment(store);

      const writes = fake.callsTo('setJSON');
      const slotWrites = writes.filter((call) => call.key.startsWith('slot/'));
      const otherWrites = writes.filter((call) => !call.key.startsWith('slot/'));

      expect(slotWrites).toHaveLength(1);
      expect(slotWrites[0].options).toEqual({ onlyIfNew: true });
      expect(otherWrites).toHaveLength(2);
      expect(otherWrites.every((call) => call.options === undefined)).toBe(true);
    });

    it('todas las lecturas piden JSON', async () => {
      await bookAppointment(store);
      await store.listAppointments();
      await store.ping();

      const reads = fake.callsTo('get');

      expect(reads.length).toBeGreaterThan(0);
      expect(reads.every((call) => JSON.stringify(call.options) === '{"type":"json"}')).toBe(true);
    });

    it('ping solo lee: no escribe ni borra nada', async () => {
      await store.ping();

      expect(fake.calls.map((call) => call.operation)).toEqual(['get']);
      expect(fake.calls[0].key).toBe('health/ping');
      expect(fake.keys()).toEqual([]);
    });

    it('listar usa un prefijo por tipo y nunca devuelve horarios como si fueran citas', async () => {
      await bookAppointment(store);
      await store.listContacts();
      await store.listAppointments();
      await store.getTakenSlots(DAY);

      expect(fake.callsTo('list').map((call) => call.key)).toEqual(['contact/', 'appointment/', 'slot/2031-03-14T']);
    });
  });

  describe('listados que van un paso por detrás', () => {
    it('una clave que aparece en el listado pero ya no existe se ignora, no rompe la lista', async () => {
      const contactId = await seedContact(store);
      const appointmentId = await bookAppointment(store);
      fake.listAlso(`contact/${testId(99)}`, `appointment/${testId(99)}`);

      expect((await store.listContacts()).map((contact) => contact.id)).toEqual([contactId]);
      expect((await store.listAppointments()).map((appointment) => appointment.id)).toEqual([appointmentId]);
    });
  });

  describe('ids mal formados', () => {
    it.each([
      '',
      'no-es-un-id',
      testId(1).toLowerCase(),
      testId(1).slice(1),
      `${testId(1)}0`,
      'I'.repeat(26),
      `../appointment/${testId(1)}`,
      `${testId(1)}/../x`,
    ])('el id %j no llega nunca al almacenamiento', async (id) => {
      await store.updateContactStatus(id, 'closed');
      await store.updateAppointmentStatus(id, 'cancelled');

      expect(fake.calls).toEqual([]);
    });

    it('una fecha o una hora con formato inválido no llega al almacenamiento', async () => {
      await store.createAppointment(appointmentInput({ date: '../x', time: '10:00' })).catch(() => undefined);
      await store.getTakenSlots('2031-3-14').catch(() => undefined);

      expect(fake.calls).toEqual([]);
    });
  });

  describe('BlobsBackend', () => {
    it('get convierte "no existe" (null) en null y no confunde un valor vacío con una clave ausente', async () => {
      const backend = new BlobsBackend(fake);
      await backend.set('prueba/vacio', {});
      await backend.set('prueba/cero', 0);

      expect(await backend.get('prueba/no-existe')).toBeNull();
      expect(await backend.get('prueba/vacio')).toEqual({});
      expect(await backend.get('prueba/cero')).toBe(0);
    });

    it('delete de una clave que no existe no falla', async () => {
      await expect(new BlobsBackend(fake).delete('prueba/no-existe')).resolves.toBeUndefined();
    });

    it('setIfAbsent no pisa el valor existente', async () => {
      const backend = new BlobsBackend(fake);

      await backend.setIfAbsent('prueba/clave', { dueño: 'primero' });
      await backend.setIfAbsent('prueba/clave', { dueño: 'segundo' });

      expect(await backend.get('prueba/clave')).toEqual({ dueño: 'primero' });
    });

    it('keys devuelve solo las claves del prefijo', async () => {
      const backend = new BlobsBackend(fake);
      for (const key of ['a/1', 'a/2', 'ab/3', 'b/4']) await backend.set(key, 1);

      expect((await backend.keys('a/')).sort()).toEqual(['a/1', 'a/2']);
    });
  });
};
