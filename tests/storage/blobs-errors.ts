import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlobsStore } from '~/lib/storage/blobs';
import { StorageUnavailableError } from '~/lib/storage/errors';
import type { LeadStore } from '~/lib/storage/types';
import { FakeBlobsStore, type FakeOperation } from './fake-blobs';
import { DAY, appointmentInput, bookAppointment, contactInput, seedContact, testId } from './helpers';

const outage = new Error('503 Service Unavailable');

/** Lo que pasa cuando Netlify Blobs falla: nada se traga, nada se degrada a memoria. */
export const blobsErrorsSection = () => {
  let fake: FakeBlobsStore;
  let store: LeadStore;

  beforeEach(() => {
    fake = new FakeBlobsStore();
    store = createBlobsStore(fake, { scope: 'site' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const operations: Array<{
    name: string;
    fails: FakeOperation;
    message: RegExp;
    /** Datos que tienen que existir antes de que el almacenamiento empiece a fallar. */
    prepare?: () => Promise<unknown>;
    run: () => Promise<unknown>;
  }> = [
    {
      name: 'createContact',
      fails: 'setJSON',
      message: /escribir contact\//,
      run: () => store.createContact(contactInput()),
    },
    {
      name: 'createAppointment (al guardar la cita)',
      fails: 'setJSON',
      message: /escribir appointment\//,
      run: () => store.createAppointment(appointmentInput()),
    },
    { name: 'listContacts (al listar)', fails: 'list', message: /listar contact\//, run: () => store.listContacts() },
    {
      name: 'listAppointments (al listar)',
      fails: 'list',
      message: /listar appointment\//,
      run: () => store.listAppointments(),
    },
    {
      name: 'listContacts (al leer un registro)',
      fails: 'get',
      message: /leer contact\//,
      prepare: () => seedContact(store),
      run: () => store.listContacts(),
    },
    { name: 'getTakenSlots', fails: 'list', message: /listar slot\/2031-03-14T/, run: () => store.getTakenSlots(DAY) },
    {
      name: 'updateContactStatus',
      fails: 'get',
      message: /leer contact\//,
      run: () => store.updateContactStatus(testId(1), 'closed'),
    },
    {
      name: 'updateAppointmentStatus',
      fails: 'get',
      message: /leer appointment\//,
      run: () => store.updateAppointmentStatus(testId(1), 'confirmed'),
    },
    { name: 'ping', fails: 'get', message: /leer health\/ping/, run: () => store.ping() },
  ];

  describe('errores del almacenamiento', () => {
    it.each(operations)(
      '$name: un fallo del cliente sale como StorageUnavailableError con la causa original',
      async (op) => {
        await op.prepare?.();
        fake.fail(op.fails, outage);

        const error = await op.run().catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(StorageUnavailableError);
        expect(error).toMatchObject({ name: 'StorageUnavailableError', message: expect.stringMatching(op.message) });
        expect((error as StorageUnavailableError).cause).toBe(outage);
      }
    );

    it('conserva como causa lo que haya lanzado el cliente aunque no sea un Error', async () => {
      fake.fail('setJSON', 'se cayó la red');

      const error = await store.createContact(contactInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as StorageUnavailableError).cause).toBe('se cayó la red');
    });

    it('un fallo al listar no devuelve una lista parcial ni vacía', async () => {
      await seedContact(store);
      await seedContact(store);
      fake.fail('get', outage, { skip: 1, times: 1 });

      await expect(store.listContacts()).rejects.toBeInstanceOf(StorageUnavailableError);
    });

    it('después de un fallo, el almacenamiento que se recupera sigue funcionando con los mismos datos', async () => {
      const id = await seedContact(store);
      fake.fail('list', outage, { times: 1 });

      await expect(store.listContacts()).rejects.toBeInstanceOf(StorageUnavailableError);

      expect((await store.listContacts()).map((contact) => contact.id)).toEqual([id]);
    });
  });

  describe('fallos a mitad de una reserva', () => {
    it('si falla la reserva del horario, la cita ya escrita se borra y el error sale', async () => {
      fake.fail('setJSON', outage, { key: /^slot\// });

      await expect(store.createAppointment(appointmentInput())).rejects.toBeInstanceOf(StorageUnavailableError);

      expect(fake.keys()).toEqual([]);
    });

    it('si además falla la limpieza, el error que sale es el de fondo y el fallo de la limpieza se registra', async () => {
      const cleanupOutage = new Error('el borrado también falló');
      fake.fail('setJSON', outage, { key: /^slot\// });
      fake.fail('delete', cleanupOutage);

      const error = await store.createAppointment(appointmentInput()).catch((caught: unknown) => caught);

      expect((error as StorageUnavailableError).cause).toBe(outage);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo limpiar'),
        expect.stringMatching(/^appointment\//),
        expect.objectContaining({ cause: cleanupOutage })
      );
      // El lead se conserva: queda una cita sin horario reservado en vez de perderse.
      expect(fake.keys('appointment/')).toHaveLength(1);
      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });

    it('si la escritura condicional dice "ok" pero no escribió nada (un 5xx), no se da la cita por reservada', async () => {
      fake.conditionalWritesBehaveAs('ghost-success');

      const error = await store.createAppointment(appointmentInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as Error).message).toMatch(/no quedó registrado/);
      expect(fake.keys()).toEqual([]);
    });

    it('si la respuesta se pierde y el reintento recibe 412 por la propia escritura, la reserva sale bien', async () => {
      fake.conditionalWritesBehaveAs('applied-but-412');

      const result = await store.createAppointment(appointmentInput());

      expect(result.created).toBe(true);
      expect(fake.peek('slot/2031-03-14T1000')).toEqual({
        appointmentId: result.created ? result.appointment.id : null,
        claimedAt: expect.any(String),
      });
    });

    it('lo mismo al reactivar una cita cancelada: el 412 por la propia escritura no es un horario ajeno', async () => {
      const id = await bookAppointment(store);
      await store.updateAppointmentStatus(id, 'cancelled');
      fake.conditionalWritesBehaveAs('applied-but-412');

      const result = await store.updateAppointmentStatus(id, 'pending');

      expect(result).toMatchObject({ outcome: 'updated', appointment: { status: 'pending' } });
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
    });

    it('si la reactivación no puede reservar el horario por un fallo, la cita sigue cancelada', async () => {
      const id = await bookAppointment(store);
      await store.updateAppointmentStatus(id, 'cancelled');
      fake.conditionalWritesBehaveAs('ghost-success');

      await expect(store.updateAppointmentStatus(id, 'pending')).rejects.toBeInstanceOf(StorageUnavailableError);

      expect((await store.listAppointments())[0].status).toBe('cancelled');
    });

    it('si cancelar guarda el estado pero falla al liberar el horario, repetir la cancelación termina el trabajo', async () => {
      const id = await bookAppointment(store);
      fake.fail('delete', outage, { times: 1 });

      await expect(store.updateAppointmentStatus(id, 'cancelled')).rejects.toBeInstanceOf(StorageUnavailableError);

      expect((await store.listAppointments())[0].status).toBe('cancelled');
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);

      await expect(store.updateAppointmentStatus(id, 'cancelled')).resolves.toMatchObject({ outcome: 'updated' });
      expect(await store.getTakenSlots(DAY)).toEqual([]);
    });
  });
};
