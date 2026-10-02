import type {
  AppointmentInput,
  AppointmentRecord,
  ContactInput,
  LeadStore,
  StorageBackend,
  StorageScope,
} from '~/lib/storage';

/** Cómo crear un store vacío de cada implementación para correr sobre él la misma batería de tests. */
export interface ContractTarget {
  /** Cómo se llama en el reporte de vitest. */
  label: string;
  backend: StorageBackend;
  scope: StorageScope;
  /**
   * Un store nuevo y vacío. `now` y `newId` reemplazan el reloj y el generador de ids.
   * `seed` fija la intercalación de las operaciones simultáneas en los almacenes que la simulan.
   */
  create(options?: { now?: () => Date; newId?: () => string; seed?: number }): LeadStore;
}

/**
 * Un id con la forma que exige `isValidId` (26 caracteres Crockford), ordenable
 * por `n`: `testId(2) > testId(1)` en orden alfabético, igual que los reales.
 */
export const testId = (n: number): string => `01KTEST${String(n).padStart(19, '0')}`;

/** Ids que salen en el orden en que se piden. */
export const idSequence = (...ids: string[]): (() => string) => {
  const queue = [...ids];

  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('Se pidieron más ids de los previstos en el test.');

    return next;
  };
};

/** Reloj que avanza `stepMs` en cada lectura: cada marca de tiempo que escribe el store es distinta. */
export const steppingClock = (start = '2031-03-10T15:00:00.000Z', stepMs = 1000): (() => Date) => {
  let current = new Date(start).getTime() - stepMs;

  return () => {
    current += stepMs;

    return new Date(current);
  };
};

export const DAY = '2031-03-14';
export const OTHER_DAY = '2031-03-15';

export const contactInput = (overrides: Partial<ContactInput> = {}): ContactInput => ({
  name: 'Ana Gómez',
  email: 'ana@example.com',
  message: 'Quiero clases de IA para mi equipo.',
  ...overrides,
});

export const appointmentInput = (overrides: Partial<AppointmentInput> = {}): AppointmentInput => ({
  name: 'Luis Pérez',
  email: 'luis@example.com',
  serviceType: 'consultoria',
  date: DAY,
  time: '10:00',
  ...overrides,
});

/** Crea un contacto y devuelve su id: para los tests que solo necesitan "uno que exista". */
export const seedContact = async (store: LeadStore, overrides: Partial<ContactInput> = {}): Promise<string> =>
  (await store.createContact(contactInput(overrides))).id;

/** Agenda una cita que tiene que salir bien y devuelve el registro. */
export const bookAppointmentRecord = async (
  store: LeadStore,
  overrides: Partial<AppointmentInput> = {}
): Promise<AppointmentRecord> => {
  const result = await store.createAppointment(appointmentInput(overrides));
  if (!result.created)
    throw new Error(`El horario ${overrides.date ?? DAY} ${overrides.time ?? '10:00'} ya estaba tomado.`);

  return result.appointment;
};

/** Agenda una cita que tiene que salir bien y devuelve su id. */
export const bookAppointment = async (store: LeadStore, overrides: Partial<AppointmentInput> = {}): Promise<string> =>
  (await bookAppointmentRecord(store, overrides)).id;
