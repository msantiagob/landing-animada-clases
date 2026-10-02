import { describe, expect, it } from 'vitest';
import { isValidId } from '~/lib/storage/ids';
import {
  appointmentInput,
  contactInput,
  idSequence,
  seedContact,
  steppingClock,
  testId,
  type ContractTarget,
} from './helpers';

/** Identidad, creación y lectura de contactos, orden de la lista e identificadores. */
export const contactsSection = (target: ContractTarget) => {
  describe('identidad', () => {
    it('declara dónde guarda los datos y con qué alcance', () => {
      const store = target.create();

      expect(store.backend).toBe(target.backend);
      expect(store.scope).toBe(target.scope);
    });
  });

  describe('contactos', () => {
    it('crea un contacto nuevo con estado "new", ambas fechas iguales y los opcionales en null', async () => {
      const store = target.create({ now: steppingClock(), newId: idSequence(testId(1)) });

      const record = await store.createContact(contactInput());

      expect(record).toEqual({
        id: testId(1),
        name: 'Ana Gómez',
        email: 'ana@example.com',
        message: 'Quiero clases de IA para mi equipo.',
        phone: null,
        company: null,
        interest: null,
        status: 'new',
        ip_address: null,
        user_agent: null,
        source_page: null,
        created_at: '2031-03-10T15:00:00.000Z',
        updated_at: '2031-03-10T15:00:00.000Z',
      });
    });

    it('guarda los datos opcionales con los nombres de columna que lee el panel', async () => {
      const store = target.create();

      const record = await store.createContact(
        contactInput({
          phone: '+57 300 123 4567',
          company: 'Acme SAS',
          interest: 'clases-de-ia',
          ip: '203.0.113.7',
          userAgent: 'Mozilla/5.0 (test)',
          sourcePage: '/clases-de-ia',
        })
      );

      expect(record).toMatchObject({
        phone: '+57 300 123 4567',
        company: 'Acme SAS',
        interest: 'clases-de-ia',
        ip_address: '203.0.113.7',
        user_agent: 'Mozilla/5.0 (test)',
        source_page: '/clases-de-ia',
      });
    });

    it('trata undefined y null igual: el campo queda en null y no desaparece', async () => {
      const store = target.create();

      await store.createContact(contactInput({ phone: undefined, company: null, interest: undefined }));
      const [stored] = await store.listContacts();

      expect(stored).toMatchObject({ phone: null, company: null, interest: null });
      expect(Object.keys(stored)).toEqual(expect.arrayContaining(['phone', 'company', 'interest', 'ip_address']));
    });

    it('lo que se crea es lo que se lee de vuelta', async () => {
      const store = target.create();

      const created = await store.createContact(contactInput({ phone: '3001234567' }));

      expect(await store.listContacts()).toEqual([created]);
    });

    it('conserva tildes, emojis, comillas, barras y saltos de línea', async () => {
      const store = target.create();
      const message = 'Ñandú dijo: "¿Cómo está?" \\ / 🚀\nSegunda línea\ttabulada';

      await store.createContact(contactInput({ name: 'Yaneth Ñáñez', message }));
      const [stored] = await store.listContacts();

      expect(stored.name).toBe('Yaneth Ñáñez');
      expect(stored.message).toBe(message);
    });

    it('no recorta un mensaje largo', async () => {
      const store = target.create();
      const message = 'x'.repeat(50_000);

      await store.createContact(contactInput({ message }));
      const [stored] = await store.listContacts();

      expect(stored.message).toHaveLength(50_000);
    });

    it('devuelve copias: modificar un registro devuelto no cambia lo guardado', async () => {
      const store = target.create();
      const created = await store.createContact(contactInput());

      created.status = 'closed';
      created.name = 'Alterado';
      const [listed] = await store.listContacts();

      expect(listed.status).toBe('new');
      expect(listed.name).toBe('Ana Gómez');

      listed.message = 'Alterado también';

      expect((await store.listContacts())[0].message).toBe('Quiero clases de IA para mi equipo.');
    });

    it('sin contactos devuelve una lista vacía', async () => {
      expect(await target.create().listContacts()).toEqual([]);
    });

    it('no mezcla contactos con citas', async () => {
      const store = target.create();

      await store.createContact(contactInput());
      await store.createAppointment(appointmentInput());

      expect(await store.listContacts()).toHaveLength(1);
      expect(await store.listAppointments()).toHaveLength(1);
    });
  });

  describe('orden e identificadores', () => {
    it('lista del contacto más reciente al más antiguo', async () => {
      const store = target.create();
      const created: string[] = [];

      for (let index = 0; index < 12; index += 1) created.push(await seedContact(store, { name: `Persona ${index}` }));

      expect((await store.listContacts()).map((contact) => contact.id)).toEqual([...created].reverse());
    });

    it('el orden sale del id: no depende del orden de inserción ni del de las claves', async () => {
      const store = target.create({ newId: idSequence(testId(5), testId(9), testId(2), testId(7)) });

      for (const name of ['cinco', 'nueve', 'dos', 'siete']) await store.createContact(contactInput({ name }));

      expect((await store.listContacts()).map((contact) => contact.name)).toEqual(['nueve', 'siete', 'cinco', 'dos']);
    });

    it('los ids reales son válidos y estrictamente crecientes aunque se pidan en el mismo milisegundo', async () => {
      const store = target.create();
      const ids: string[] = [];

      for (let index = 0; index < 50; index += 1) ids.push(await seedContact(store));

      expect(ids.every(isValidId)).toBe(true);
      expect(ids.slice(1).every((id, index) => id > ids[index])).toBe(true);
    });

    it('200 contactos creados a la vez tienen ids distintos y no se pisan entre sí', async () => {
      const store = target.create();

      const created = await Promise.all(
        Array.from({ length: 200 }, (_, index) => store.createContact(contactInput({ name: `Ráfaga ${index}` })))
      );
      const listed = await store.listContacts();

      expect(new Set(created.map((contact) => contact.id)).size).toBe(200);
      expect(listed).toHaveLength(200);
      expect(new Set(listed.map((contact) => contact.name)).size).toBe(200);
    });
  });
};
