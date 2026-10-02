/**
 * Contrato de almacenamiento de leads.
 *
 * Los endpoints no saben dónde viven los datos: hablan con un `LeadStore`. Hay
 * dos implementaciones con la misma semántica (memory.ts para desarrollo y
 * tests, blobs.ts para Netlify) y una sola batería de tests de contrato que las
 * ejercita a las dos (tests/storage/).
 *
 * Los registros conservan los nombres en snake_case que tenían las filas de la
 * época de SQLite: el panel de administración los lee tal cual y el test de
 * privacidad (tests/legal.test.ts) los usa para exigir que cada dato personal
 * guardado esté declarado en /privacidad.
 */

export const CONTACT_STATUSES = ['new', 'contacted', 'closed'] as const;
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const isContactStatus = (value: unknown): value is ContactStatus =>
  typeof value === 'string' && (CONTACT_STATUSES as readonly string[]).includes(value);

export const isAppointmentStatus = (value: unknown): value is AppointmentStatus =>
  typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value);

/** Dónde se guardan los datos de verdad. Lo expone /api/health. */
export type StorageBackend = 'netlify-blobs' | 'memory';

/**
 * Alcance de los datos:
 * - `site`: el store del sitio, compartido por todos los deploys (producción).
 * - `deploy`: un store atado al deploy, que Netlify borra con él (previews y branch deploys).
 * - `process`: la memoria de este proceso (solo desarrollo).
 */
export type StorageScope = 'site' | 'deploy' | 'process';

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  phone?: string | null;
  company?: string | null;
  /** Servicio por el que consulta: define a qué silo pertenece el lead. */
  interest?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sourcePage?: string | null;
}

export interface AppointmentInput {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  serviceType: string;
  /** `yyyy-MM-dd`. */
  date: string;
  /** `HH:mm`. */
  time: string;
  timezone?: string;
  duration?: number;
  message?: string | null;
}

export interface ContactRecord {
  /** Identificador ordenable por fecha de creación (ver ids.ts). */
  id: string;
  name: string;
  email: string;
  message: string;
  phone: string | null;
  company: string | null;
  interest: string | null;
  status: ContactStatus;
  ip_address: string | null;
  user_agent: string | null;
  source_page: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service_type: string;
  date: string;
  time: string;
  timezone: string;
  duration: number;
  message: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface LeadStats {
  contactForms: { total: number; new: number };
  appointments: { total: number; pending: number };
}

export type CreateAppointmentResult =
  | { created: true; appointment: AppointmentRecord }
  | { created: false; reason: 'slot-taken' };

export type UpdateAppointmentResult =
  | { outcome: 'updated'; appointment: AppointmentRecord }
  | { outcome: 'not-found' }
  /** Se intentó reactivar una cita cancelada, pero otra persona ya tomó su horario. */
  | { outcome: 'slot-taken' };

export interface LeadStore {
  readonly backend: StorageBackend;
  readonly scope: StorageScope;

  createContact(input: ContactInput): Promise<ContactRecord>;

  /**
   * Agenda una cita reservando su horario de forma atómica: dos reservas
   * simultáneas para el mismo horario nunca terminan las dos en `created`.
   */
  createAppointment(input: AppointmentInput): Promise<CreateAppointmentResult>;

  /** Todos los contactos, del más reciente al más antiguo. */
  listContacts(): Promise<ContactRecord[]>;

  /** Todas las citas, por fecha y hora de la cita (la más lejana primero). */
  listAppointments(): Promise<AppointmentRecord[]>;

  /** Horas (`HH:mm`, ascendentes) ya reservadas ese día. Una cita cancelada libera la suya. */
  getTakenSlots(date: string): Promise<string[]>;

  /** `null` si el contacto no existe. */
  updateContactStatus(id: string, status: ContactStatus): Promise<ContactRecord | null>;

  /** Cancelar libera el horario; sacar una cita de `cancelled` lo vuelve a reservar. */
  updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<UpdateAppointmentResult>;

  /** Comprueba que el almacenamiento responde. Lanza si no. */
  ping(): Promise<void>;
}

/** Los totales que muestra el panel, calculados sobre las listas completas. */
export const summarizeLeads = (contacts: ContactRecord[], appointments: AppointmentRecord[]): LeadStats => ({
  contactForms: {
    total: contacts.length,
    new: contacts.filter((contact) => contact.status === 'new').length,
  },
  appointments: {
    total: appointments.length,
    pending: appointments.filter((appointment) => appointment.status === 'pending').length,
  },
});
