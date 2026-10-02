import { StorageUnavailableError } from './errors';
import { isValidId, newId } from './ids';
import type {
  AppointmentInput,
  AppointmentRecord,
  AppointmentStatus,
  ContactInput,
  ContactRecord,
  ContactStatus,
  CreateAppointmentResult,
  LeadStore,
  StorageBackend,
  StorageScope,
  UpdateAppointmentResult,
} from './types';

/**
 * Lo mínimo que necesita el store de un almacén clave-valor de JSON. Netlify
 * Blobs y el Map en memoria lo cumplen, y toda la lógica de leads (ids, orden,
 * reserva de horarios, estados) está escrita UNA vez, acá, sobre esto.
 *
 * Las claves se organizan por prefijo:
 * - `contact/<id>`: un contacto.
 * - `appointment/<id>`: una cita.
 * - `slot/<yyyy-MM-dd>T<HHmm>`: el horario reservado. Existe mientras la cita
 *   que lo ocupa no esté cancelada.
 */
export interface KeyValueBackend {
  /** El valor guardado, o `null` si la clave no existe. */
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  /** Escribe solo si la clave no existe (si existe, no hace nada). */
  setIfAbsent(key: string, value: unknown): Promise<void>;
  /** No falla si la clave no existe. */
  delete(key: string): Promise<void>;
  /** Todas las claves con ese prefijo, sin orden garantizado. */
  keys(prefix: string): Promise<string[]>;
}

export interface KeyValueLeadStoreOptions {
  backend: StorageBackend;
  scope: StorageScope;
  /** Reloj. Solo se reemplaza en los tests. */
  now?: () => Date;
  /** Generador de ids. Solo se reemplaza en los tests. */
  newId?: () => string;
}

const CONTACT_PREFIX = 'contact/';
const APPOINTMENT_PREFIX = 'appointment/';
const SLOT_PREFIX = 'slot/';
const PING_KEY = 'health/ping';

/** Cuántas lecturas se lanzan a la vez al listar. Alcanza para un panel y no satura al almacén. */
const READ_CONCURRENCY = 20;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

interface SlotHolder {
  appointmentId: string;
  claimedAt: string;
}

/**
 * Clave del horario. Sin los dos puntos de `HH:mm`: el cliente de Netlify Blobs
 * no codifica las claves y conviene que solo lleven caracteres de URL seguros.
 */
export const slotKey = (date: string, time: string): string => {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    throw new Error(`Horario con formato inválido: "${date}" "${time}"`);
  }

  return `${SLOT_PREFIX}${date}T${time.replace(':', '')}`;
};

const byNewest = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const byScheduledDesc = (a: AppointmentRecord, b: AppointmentRecord): number => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.time !== b.time) return a.time < b.time ? 1 : -1;

  return byNewest(a, b);
};

const mapInBatches = async <T, R>(items: T[], size: number, action: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = [];

  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(action))));
  }

  return results;
};

export class KeyValueLeadStore implements LeadStore {
  readonly backend: StorageBackend;
  readonly scope: StorageScope;

  readonly #kv: KeyValueBackend;
  readonly #now: () => Date;
  readonly #newId: () => string;

  constructor(kv: KeyValueBackend, options: KeyValueLeadStoreOptions) {
    this.#kv = kv;
    this.backend = options.backend;
    this.scope = options.scope;
    this.#now = options.now ?? (() => new Date());
    this.#newId = options.newId ?? newId;
  }

  async createContact(input: ContactInput): Promise<ContactRecord> {
    const timestamp = this.#now().toISOString();
    const record: ContactRecord = {
      id: this.#newId(),
      name: input.name,
      email: input.email,
      message: input.message,
      phone: input.phone ?? null,
      company: input.company ?? null,
      interest: input.interest ?? null,
      status: 'new',
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      source_page: input.sourcePage ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.#kv.set(`${CONTACT_PREFIX}${record.id}`, record);

    return record;
  }

  async createAppointment(input: AppointmentInput): Promise<CreateAppointmentResult> {
    const slot = slotKey(input.date, input.time);
    const timestamp = this.#now().toISOString();
    const record: AppointmentRecord = {
      id: this.#newId(),
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      company: input.company ?? null,
      service_type: input.serviceType,
      date: input.date,
      time: input.time,
      timezone: input.timezone ?? 'America/Bogota',
      duration: input.duration ?? 60,
      message: input.message ?? null,
      status: 'pending',
      created_at: timestamp,
      updated_at: timestamp,
    };
    const recordKey = `${APPOINTMENT_PREFIX}${record.id}`;

    // Primero el registro y después el horario. Si el proceso muere entre los
    // dos pasos queda una cita sin horario reservado (el lead se conserva y el
    // panel la muestra) en vez de un horario bloqueado para siempre sin ninguna
    // cita detrás, que además perdería el contacto.
    await this.#kv.set(recordKey, record);

    let claimed: boolean;

    try {
      claimed = await this.#claimSlot(slot, record.id);
    } catch (error) {
      // La reserva pudo aplicarse aunque la llamada fallara (respuesta perdida, corte
      // después de escribir). Borrar la cita con el horario a su nombre lo dejaría
      // bloqueado para siempre: una cita que ya no existe no se puede cancelar desde
      // el panel. Por eso primero se suelta el horario (solo si sigue siendo de esta
      // cita) y la cita se borra únicamente si eso salió bien; si no, se conserva junto
      // a su horario, un estado coherente que el panel muestra y permite cancelar.
      if (await this.#releaseQuietly(slot, record.id)) await this.#discard(recordKey);
      throw error;
    }

    if (!claimed) {
      await this.#discard(recordKey);

      return { created: false, reason: 'slot-taken' };
    }

    return { created: true, appointment: record };
  }

  async listContacts(): Promise<ContactRecord[]> {
    const keys = await this.#kv.keys(CONTACT_PREFIX);
    const rows = await mapInBatches(keys, READ_CONCURRENCY, (key) => this.#kv.get<ContactRecord>(key));

    return rows.filter((row): row is ContactRecord => row !== null).sort(byNewest);
  }

  async listAppointments(): Promise<AppointmentRecord[]> {
    const keys = await this.#kv.keys(APPOINTMENT_PREFIX);
    const rows = await mapInBatches(keys, READ_CONCURRENCY, (key) => this.#kv.get<AppointmentRecord>(key));

    return rows.filter((row): row is AppointmentRecord => row !== null).sort(byScheduledDesc);
  }

  async getTakenSlots(date: string): Promise<string[]> {
    if (!DATE_PATTERN.test(date)) throw new Error(`Fecha con formato inválido: "${date}"`);

    const prefix = `${SLOT_PREFIX}${date}T`;
    const keys = await this.#kv.keys(prefix);

    return keys
      .map((key) => key.slice(prefix.length))
      .filter((hhmm) => /^\d{4}$/.test(hhmm))
      .map((hhmm) => `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`)
      .sort();
  }

  async updateContactStatus(id: string, status: ContactStatus): Promise<ContactRecord | null> {
    if (!isValidId(id)) return null;

    const key = `${CONTACT_PREFIX}${id}`;
    const current = await this.#kv.get<ContactRecord>(key);
    if (!current) return null;

    // Último en escribir gana: el panel lo usa una sola persona y el único
    // campo que cambia es el estado.
    const updated: ContactRecord = { ...current, status, updated_at: this.#now().toISOString() };
    await this.#kv.set(key, updated);

    return updated;
  }

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<UpdateAppointmentResult> {
    if (!isValidId(id)) return { outcome: 'not-found' };

    const key = `${APPOINTMENT_PREFIX}${id}`;
    const current = await this.#kv.get<AppointmentRecord>(key);
    if (!current) return { outcome: 'not-found' };

    const slot = slotKey(current.date, current.time);
    const cancelling = status === 'cancelled';

    // Sacar una cita de "cancelada" vuelve a ocupar su horario. Si mientras
    // tanto otra persona lo reservó, reactivarla sería una doble reserva.
    if (current.status === 'cancelled' && !cancelling && !(await this.#claimSlot(slot, id))) {
      return { outcome: 'slot-taken' };
    }

    const updated: AppointmentRecord = { ...current, status, updated_at: this.#now().toISOString() };
    await this.#kv.set(key, updated);

    // Se libera DESPUÉS de guardar el estado, y también al repetir "cancelar":
    // si la liberación falló la primera vez, reintentar la completa.
    if (cancelling) await this.#releaseSlot(slot, id);

    return { outcome: 'updated', appointment: updated };
  }

  async ping(): Promise<void> {
    await this.#kv.get(PING_KEY);
  }

  /**
   * Reserva el horario para esa cita. `true` si ahora es suya, `false` si lo
   * tiene otra.
   *
   * No se confía en lo que devuelve la escritura condicional: se lee de vuelta
   * quién quedó como titular. Dos razones reales con el cliente de Netlify Blobs:
   * ante cualquier respuesta distinta de 412 (incluidos los 5xx) la escritura
   * condicional informa `modified: true`, y si el cliente reintenta tras perder
   * una respuesta, el segundo intento recibe 412 por NUESTRA propia escritura
   * previa. Leer el titular resuelve ambos casos y hace la reserva idempotente.
   */
  async #claimSlot(slot: string, appointmentId: string): Promise<boolean> {
    const holder: SlotHolder = { appointmentId, claimedAt: this.#now().toISOString() };
    await this.#kv.setIfAbsent(slot, holder);

    const stored = await this.#kv.get<SlotHolder>(slot);

    if (!stored) {
      throw new StorageUnavailableError(`El horario ${slot} no quedó registrado tras reservarlo.`);
    }

    return stored.appointmentId === appointmentId;
  }

  /** Libera el horario solo si lo tiene esta cita. Nunca borra el de otra. */
  async #releaseSlot(slot: string, appointmentId: string): Promise<void> {
    const stored = await this.#kv.get<SlotHolder>(slot);

    if (stored?.appointmentId === appointmentId) await this.#kv.delete(slot);
  }

  /**
   * Suelta el horario si es de esta cita (nunca el de otra). Es limpieza de una
   * reserva fallida: si falla, lo registra y devuelve `false` en vez de tapar el
   * error de fondo.
   */
  async #releaseQuietly(slot: string, appointmentId: string): Promise<boolean> {
    try {
      await this.#releaseSlot(slot, appointmentId);

      return true;
    } catch (error) {
      console.error('[storage] No se pudo liberar el horario de una reserva fallida:', slot, error);

      return false;
    }
  }

  /** Borra un registro que no llegó a ser una cita. Es limpieza: si falla, no tapa el error de fondo. */
  async #discard(recordKey: string): Promise<void> {
    try {
      await this.#kv.delete(recordKey);
    } catch (error) {
      console.error('[storage] No se pudo limpiar el registro de una reserva fallida:', recordKey, error);
    }
  }
}
