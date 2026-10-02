import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlobsStore } from '~/lib/storage/blobs';
import { StorageUnavailableError } from '~/lib/storage/errors';
import type { LeadStore } from '~/lib/storage/types';
import { UNCACHED_EDGE_URL, FakeBlobsServer } from './fake-blobs-http';
import { DAY, appointmentInput, bookAppointment, bookAppointmentRecord, contactInput, seedContact } from './helpers';

/**
 * El cliente REAL de @netlify/blobs contra un servidor falso. Cada test fija una
 * conducta del cliente en la que se apoya core.ts (está comentada allí): si una
 * versión nueva de la librería la cambia, estos tests avisan antes que producción.
 */
export const blobsWireSection = () => {
  let server: FakeBlobsServer;
  let store: LeadStore;

  beforeEach(() => {
    server = new FakeBlobsServer();
    store = createBlobsStore(server.client(), { scope: 'site' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('lo que viaja por la red', () => {
    it('usa el store "leads" del sitio, con el token y con lecturas de consistencia fuerte', async () => {
      await seedContact(store);
      await store.listContacts();

      expect(server.requests.length).toBeGreaterThan(0);
      for (const request of server.requests) {
        expect(request.store).toBe('site:leads');
        expect(request.headers.authorization).toBe('Bearer token-de-prueba');
        expect(request.host).toBe(new URL(UNCACHED_EDGE_URL).host);
      }
    });

    it('reservar un horario envía la cabecera if-none-match: *, y las demás escrituras no', async () => {
      await seedContact(store);
      const appointment = await bookAppointmentRecord(store);

      const puts = server.requestsTo('PUT');
      const conditional = puts.filter((request) => request.headers['if-none-match'] === '*');

      expect(puts).toHaveLength(3);
      expect(conditional.map((request) => request.key)).toEqual(['slot/2031-03-14T1000']);
      expect(server.keys('appointment/')).toEqual([`appointment/${appointment.id}`]);
    });

    it('lista todas las páginas del servidor, no solo la primera', async () => {
      const paged = new FakeBlobsServer({ pageSize: 4 });
      const pagedStore = createBlobsStore(paged.client(), { scope: 'site' });
      for (let index = 0; index < 11; index += 1) await seedContact(pagedStore, { name: `Persona ${index}` });

      const contacts = await pagedStore.listContacts();
      const listings = paged.requestsTo('GET').filter((request) => request.key === null);

      expect(contacts).toHaveLength(11);
      expect(new Set(contacts.map((contact) => contact.id)).size).toBe(11);
      expect(listings.length).toBeGreaterThanOrEqual(3);
      expect(listings.slice(1).every((request) => request.search.has('cursor'))).toBe(true);
    });

    it('un listado que responde 404 (el store aún no existe) es una lista vacía, no un error', async () => {
      server.respondWith('GET', 404);

      expect(await store.listContacts()).toEqual([]);
    });
  });

  describe('fallos del servidor', () => {
    it('el cliente absorbe un fallo pasajero (5xx) con sus reintentos', async () => {
      server.respondWith('PUT', 500, { times: 2 });

      const contact = await store.createContact(contactInput());

      expect(server.keys('contact/')).toEqual([`contact/${contact.id}`]);
    });

    it('si el 5xx no se va, una escritura normal falla con StorageUnavailableError', async () => {
      server.respondWith('PUT', 500, { times: Infinity });

      const error = await store.createContact(contactInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as StorageUnavailableError).cause).toMatchObject({ name: 'BlobsInternalError' });
      expect(server.keys()).toEqual([]);
    });

    it('un token sin permiso (403) también sale como StorageUnavailableError', async () => {
      server.respondWith('PUT', 403, { times: Infinity });

      const error = await store.createContact(contactInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as StorageUnavailableError).cause).toMatchObject({ name: 'BlobsInternalError' });
    });

    it('una lectura que falla sale como StorageUnavailableError', async () => {
      server.respondWith('GET', 500, { times: Infinity });

      await expect(store.listContacts()).rejects.toBeInstanceOf(StorageUnavailableError);
      await expect(store.ping()).rejects.toBeInstanceOf(StorageUnavailableError);
    });

    it('ante un 5xx persistente, la escritura condicional informa "modified: true" aunque no escribió: la reserva no se da por buena', async () => {
      server.respondWith('PUT', 500, { key: /^slot\//, times: Infinity });

      const error = await store.createAppointment(appointmentInput()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as Error).message).toMatch(/no quedó registrado/);
      expect(server.keys()).toEqual([]);
    });

    it('si la respuesta de la reserva se pierde, el reintento recibe 412 por la propia escritura y la cita sale reservada', async () => {
      server.respondWith('PUT', 500, { key: /^slot\//, times: 1, applyFirst: true });

      const result = await store.createAppointment(appointmentInput());

      expect(result.created).toBe(true);
      expect(server.requestsTo('PUT').filter((request) => request.key?.startsWith('slot/')).length).toBeGreaterThan(1);
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
    });

    it('con la respuesta perdida, otra persona que llega después sigue viendo el horario ocupado', async () => {
      server.respondWith('PUT', 500, { key: /^slot\//, times: 1, applyFirst: true });
      await store.createAppointment(appointmentInput());

      expect(await store.createAppointment(appointmentInput({ name: 'Otra' }))).toEqual({
        created: false,
        reason: 'slot-taken',
      });
      expect(await store.listAppointments()).toHaveLength(1);
    });

    it('cancelar y reactivar funciona de punta a punta con el cliente real', async () => {
      const id = await bookAppointment(store);

      await store.updateAppointmentStatus(id, 'cancelled');
      expect(await store.getTakenSlots(DAY)).toEqual([]);

      await store.updateAppointmentStatus(id, 'confirmed');
      expect(await store.getTakenSlots(DAY)).toEqual(['10:00']);
      expect(server.requestsTo('DELETE').map((request) => request.key)).toEqual(['slot/2031-03-14T1000']);
    });
  });
};
