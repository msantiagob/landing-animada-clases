import { describe, expect, it } from 'vitest';
import { SILOS } from '~/data/landings';
import {
  BOOKING_DURATION_MINUTES,
  BOOKING_MESSAGES,
  OTHER_SERVICE_TYPE,
  SERVICE_TYPE_OPTIONS,
  buildAppointmentPayload,
  formatMonthYear,
  toLocalIsoDate,
} from '~/utils/booking';
import type { AppointmentFormValues } from '~/utils/booking';

describe('SERVICE_TYPE_OPTIONS', () => {
  it('ofrece una opción por cada línea del registro de landings', () => {
    Object.values(SILOS).forEach((silo) => expect(SERVICE_TYPE_OPTIONS).toContain(silo.name));
  });

  it('termina con "Otro" para quien no encaja en ninguna', () => {
    expect(OTHER_SERVICE_TYPE).toBe('Otro');
    expect(SERVICE_TYPE_OPTIONS.at(-1)).toBe('Otro');
  });

  it('tiene una opción por silo más "Otro", sin repetidas ni vacías', () => {
    expect(SERVICE_TYPE_OPTIONS).toHaveLength(Object.keys(SILOS).length + 1);
    expect(new Set(SERVICE_TYPE_OPTIONS).size).toBe(SERVICE_TYPE_OPTIONS.length);
    SERVICE_TYPE_OPTIONS.forEach((option) => expect(option.trim()).not.toBe(''));
  });

  it('sigue el orden del registro', () => {
    expect(SERVICE_TYPE_OPTIONS.slice(0, -1)).toEqual(Object.values(SILOS).map((silo) => silo.name));
  });

  it('ya no ofrece las categorías viejas que no existen en la oferta actual', () => {
    ['Inteligencia Artificial', 'Apps Multiplataforma', 'Consultoría', 'Capacitaciones'].forEach((legacy) =>
      expect(SERVICE_TYPE_OPTIONS).not.toContain(legacy)
    );
  });
});

describe('toLocalIsoDate', () => {
  it('formatea yyyy-MM-dd con ceros a la izquierda', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // Regresión: con toISOString() una noche en Colombia (UTC-5) devolvía el día siguiente.
  it('usa el día local aunque la hora local ya sea tarde en la noche', () => {
    expect(toLocalIsoDate(new Date(2026, 9, 1, 23, 30))).toBe('2026-10-01');
  });

  it('no se corre un día a las 00:00 locales', () => {
    expect(toLocalIsoDate(new Date(2026, 9, 1, 0, 0))).toBe('2026-10-01');
  });

  it('maneja el 29 de febrero de un año bisiesto', () => {
    expect(toLocalIsoDate(new Date(2028, 1, 29))).toBe('2028-02-29');
  });

  it('coincide con el formato que valida la API', () => {
    expect(toLocalIsoDate(new Date(2026, 5, 9))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatMonthYear', () => {
  it.each([
    [new Date(2026, 0, 15), 'Enero 2026'],
    [new Date(2026, 8, 1), 'Septiembre 2026'],
    [new Date(2026, 11, 31), 'Diciembre 2026'],
  ])('muestra el mes en español: %s', (date, expected) => {
    expect(formatMonthYear(date)).toBe(expected);
  });
});

describe('buildAppointmentPayload', () => {
  const values: AppointmentFormValues = {
    name: ' Carlos Ruiz ',
    email: ' carlos@example.com ',
    phone: ' +57 300 111 2222 ',
    company: ' Mi Empresa ',
    serviceType: 'IA y automatización',
    message: ' Necesito automatizar la atención. ',
    website: '',
  };
  const date = new Date(2026, 9, 14);

  it('arma el cuerpo que espera /api/appointments', () => {
    expect(buildAppointmentPayload(values, date, '10:00')).toEqual({
      name: 'Carlos Ruiz',
      email: 'carlos@example.com',
      phone: '+57 300 111 2222',
      company: 'Mi Empresa',
      serviceType: 'IA y automatización',
      date: '2026-10-14',
      time: '10:00',
      message: 'Necesito automatizar la atención.',
      duration: 60,
      website: '',
    });
  });

  it('agenda turnos de una hora', () => {
    expect(BOOKING_DURATION_MINUTES).toBe(60);
    expect(buildAppointmentPayload(values, date, '09:00').duration).toBe(60);
  });

  it('envía cadenas vacías (no null) en los campos opcionales sin completar', () => {
    const payload = buildAppointmentPayload({ ...values, phone: '', company: '  ', message: '' }, date, '11:00');

    expect(payload.phone).toBe('');
    expect(payload.company).toBe('');
    expect(payload.message).toBe('');
  });

  it('conserva el honeypot para que el servidor descarte a los bots', () => {
    expect(buildAppointmentPayload({ ...values, website: 'spam' }, date, '11:00').website).toBe('spam');
  });

  it('cada tipo de servicio ofrecido viaja tal cual al servidor', () => {
    SERVICE_TYPE_OPTIONS.forEach((serviceType) =>
      expect(buildAppointmentPayload({ ...values, serviceType }, date, '12:00').serviceType).toBe(serviceType)
    );
  });
});

describe('BOOKING_MESSAGES', () => {
  it('están en español neutro con "tú", sin voseo', () => {
    const copy = Object.values(BOOKING_MESSAGES).join(' ');

    expect(copy).not.toMatch(/\b(intentalo|probá|elegí|podés)\b/i);
    expect(BOOKING_MESSAGES.rejected).toMatch(/Inténtalo/);
    expect(BOOKING_MESSAGES.network).toMatch(/Inténtalo/);
  });
});
