import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SILOS } from '~/data/landings';
import {
  BOOKING_CLOSING_HOUR,
  BOOKING_DURATION_MINUTES,
  BOOKING_MESSAGES,
  BOOKING_MIN_LEAD_HOURS,
  BOOKING_OPENING_HOUR,
  OTHER_SERVICE_TYPE,
  SERVICE_TYPE_OPTIONS,
  buildAppointmentPayload,
  buildDaySlots,
  checkBookingRequest,
  formatMonthYear,
  isSelectableDay,
  toLocalIsoDate,
} from '~/utils/booking';
import type { AppointmentFormValues, BookingCheck } from '~/utils/booking';
import { businessDateOf } from '~/utils/business-time';
import { SERVER_TIMEZONES, freezeClock, resetTestEnvironment, stubServerTimezone } from './helpers';

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

describe('buildDaySlots', () => {
  it('son los turnos en punto de la apertura al cierre, ambos incluidos', () => {
    expect(BOOKING_OPENING_HOUR).toBe(9);
    expect(BOOKING_CLOSING_HOUR).toBe(18);
    expect(buildDaySlots()).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ]);
  });

  it('devuelve una lista nueva cada vez: quien la modifique no altera los turnos del día', () => {
    buildDaySlots().pop();

    expect(buildDaySlots()).toHaveLength(10);
  });
});

/**
 * `date` y `time` son hora de Colombia (UTC-5). Cada caso fija `now` como un instante UTC
 * explícito y se repite con el servidor en varias zonas: el veredicto no puede cambiar.
 *
 * Referencia: el lunes 2026-10-05, las 07:00 de Colombia son las 12:00 UTC.
 */
describe.each(SERVER_TIMEZONES)('checkBookingRequest con el servidor en %s', (serverTimezone) => {
  beforeEach(() => stubServerTimezone(serverTimezone));
  afterEach(resetTestEnvironment);

  const verdict = (date: string, time: string, now: string) => {
    const check = checkBookingRequest(date, time, new Date(now));

    return check.ok ? 'ok' : check.reason;
  };

  describe('franja de atención: 08:59 no, 09:00 sí', () => {
    // Con el día elegido lejos de "ahora", solo cuenta la hora.
    const now = '2026-10-05T12:00:00.000Z';

    it.each([
      ['08:59', 'outside-hours'],
      ['09:00', 'ok'],
      ['17:59', 'outside-hours'],
      ['18:00', 'ok'],
      ['18:01', 'outside-hours'],
      ['19:00', 'outside-hours'],
      ['10:30', 'outside-hours'],
      ['00:00', 'outside-hours'],
      ['23:59', 'outside-hours'],
    ])('el turno de las %s: %s', (time, expected) => {
      expect(verdict('2026-10-07', time, now)).toBe(expected);
    });

    // Las 09:00 de Colombia son las 14:00 UTC: si la hora se leyera del instante en la
    // zona del servidor, el turno de apertura se vería fuera de la franja.
    it('no lee la hora de atención del reloj del servidor', () => {
      const check = checkBookingRequest('2026-10-07', '09:00', new Date(now));

      expect(check.ok && check.startsAt.toISOString()).toBe('2026-10-07T14:00:00.000Z');
    });
  });

  describe('anticipación mínima de 2 horas', () => {
    it('el límite exacto: justo con 2 horas se acepta, un milisegundo menos no', () => {
      expect(BOOKING_MIN_LEAD_HOURS).toBe(2);
      // Turno de las 09:00 (14:00 UTC). A las 07:00 de Colombia faltan exactamente 2 horas.
      expect(verdict('2026-10-05', '09:00', '2026-10-05T11:59:59.999Z')).toBe('ok');
      expect(verdict('2026-10-05', '09:00', '2026-10-05T12:00:00.000Z')).toBe('ok');
      expect(verdict('2026-10-05', '09:00', '2026-10-05T12:00:00.001Z')).toBe('too-soon');
    });

    // Con la hora leída en UTC, el turno de las 11:00 de hoy "ya estaba a punto de pasar"
    // a las 08:00 de Colombia: se rechazaba con 3 horas de anticipación.
    it('a las 08:00 de Colombia acepta el turno de las 11:00 (3 horas) y el de las 10:00 (2 horas)', () => {
      const now = '2026-10-05T13:00:00.000Z';

      expect(verdict('2026-10-05', '11:00', now)).toBe('ok');
      expect(verdict('2026-10-05', '10:00', now)).toBe('ok');
    });

    // Con la hora leída en una zona por detrás de Colombia (Los Ángeles, Honolulu), un turno
    // con una hora de anticipación parecía tener más de dos.
    it('a las 08:00 de Colombia rechaza el turno de las 09:00 (1 hora)', () => {
      expect(verdict('2026-10-05', '09:00', '2026-10-05T13:00:00.000Z')).toBe('too-soon');
    });

    it('al día siguiente de noche: a las 22:00 de Colombia el turno de las 09:00 de mañana (11 horas) se acepta', () => {
      expect(verdict('2026-10-06', '09:00', '2026-10-06T03:00:00.000Z')).toBe('ok');
    });
  });

  describe('de noche, cuando UTC ya está en el día siguiente pero en Colombia sigue siendo hoy', () => {
    // 21:30 del lunes 5 en Colombia = 02:30 UTC del martes 6.
    const now = '2026-10-06T02:30:00.000Z';

    it('el último turno de "hoy" ya pasó', () => {
      expect(verdict('2026-10-05', '18:00', now)).toBe('too-soon');
    });

    it('el primer turno de "mañana" (martes 6, 09:00) está a 11 horas y media: se acepta', () => {
      expect(verdict('2026-10-06', '09:00', now)).toBe('ok');
    });

    it('el turno de "ayer" tampoco sirve', () => {
      expect(verdict('2026-10-04', '09:00', now)).toBe('too-soon');
    });
  });

  describe('fechas pasadas', () => {
    it.each([
      ['una fecha de hace años', '2020-01-15', '10:00', '2026-10-05T12:00:00.000Z'],
      ['ayer', '2026-10-04', '10:00', '2026-10-05T12:00:00.000Z'],
      ['hoy, un turno que ya empezó', '2026-10-05', '09:00', '2026-10-05T14:00:00.001Z'],
      ['hoy, un turno que empieza en este instante', '2026-10-05', '09:00', '2026-10-05T14:00:00.000Z'],
      // Honolulu va cinco horas por detrás de Colombia. Con la hora leída en el reloj del
      // servidor, este turno de hace 3 horas se aceptaba.
      ['hoy, un turno de hace 3 horas (20:00 en Colombia)', '2026-10-05', '17:00', '2026-10-06T01:00:00.000Z'],
    ])('rechaza %s', (_caso, date, time, now) => {
      expect(verdict(date, time, now)).toBe('too-soon');
    });
  });

  describe('fecha y hora que no existen', () => {
    it.each([
      ['un 31 de febrero', '2027-02-31', '10:00'],
      ['las 24:00', '2026-10-07', '24:00'],
      ['una hora sin cero a la izquierda', '2026-10-07', '9:00'],
      ['una fecha en otro formato', '07/10/2026', '10:00'],
      ['todo vacío', '', ''],
    ])('rechaza %s', (_caso, date, time) => {
      expect(verdict(date, time, '2026-10-05T12:00:00.000Z')).toBe('invalid-datetime');
    });
  });

  describe('orden de las reglas', () => {
    const now = '2026-10-05T12:00:00.000Z';

    it('primero que la fecha exista, antes que la anticipación', () => {
      expect(verdict('2020-02-31', '10:00', now)).toBe('invalid-datetime');
    });

    it('luego la anticipación, antes que la franja: un turno pasado y fuera de horario cuenta como pasado', () => {
      expect(verdict('2020-01-15', '08:00', now)).toBe('too-soon');
    });
  });

  it('devuelve el instante exacto del turno, para quien necesite compararlo o mostrarlo', () => {
    const check: BookingCheck = checkBookingRequest('2026-10-07', '09:00', new Date('2026-10-05T12:00:00.000Z'));

    expect(check).toEqual({ ok: true, startsAt: new Date('2026-10-07T14:00:00.000Z') });
  });

  it('sin `now` usa el reloj actual', () => {
    freezeClock('2026-10-05T12:00:01.000Z');

    // Un segundo después del límite de las 07:00 de Colombia.
    expect(checkBookingRequest('2026-10-05', '09:00')).toEqual({ ok: false, reason: 'too-soon' });

    freezeClock('2026-10-05T12:00:00.000Z');

    expect(checkBookingRequest('2026-10-05', '09:00').ok).toBe(true);
  });
});

/**
 * Qué días ofrece el calendario. `todayIso` es el "hoy" de Colombia que calcula el componente con
 * `businessDateOf()`; el día que se pregunta es una fecha de calendario (medianoche local del
 * navegador), así que el resultado no depende de la zona del navegador.
 *
 * Referencia: el lunes 2026-10-05.
 */
describe.each(SERVER_TIMEZONES)('isSelectableDay con el navegador en %s', (browserTimezone) => {
  beforeEach(() => stubServerTimezone(browserTimezone));
  afterEach(resetTestEnvironment);

  const TODAY = '2026-10-05';
  const selectable = (year: number, month: number, day: number, today = TODAY) =>
    isSelectableDay(new Date(year, month - 1, day), today);

  it('el primer día que se puede elegir es mañana', () => {
    expect(selectable(2026, 10, 6)).toBe(true);
  });

  it('hoy no se ofrece: un turno de hoy exige 2 horas de anticipación y el calendario nunca lo ofreció', () => {
    expect(selectable(2026, 10, 5)).toBe(false);
  });

  it.each([
    [2026, 10, 4],
    [2026, 10, 2],
    [2026, 9, 30],
    [2025, 10, 7],
  ])('un día pasado no se ofrece: %i-%i-%i', (year, month, day) => {
    expect(selectable(year, month, day)).toBe(false);
  });

  it.each([
    ['sábado', 2026, 10, 10],
    ['domingo', 2026, 10, 11],
    ['sábado lejano', 2027, 3, 6],
  ])('un %s no se ofrece aunque sea futuro', (_dia, year, month, day) => {
    expect(selectable(year, month, day)).toBe(false);
  });

  it('de lunes a viernes de la semana siguiente se ofrecen los cinco días', () => {
    expect([12, 13, 14, 15, 16].map((day) => selectable(2026, 10, day))).toEqual([true, true, true, true, true]);
  });

  it('cruza el cambio de mes y de año', () => {
    // 2026-12-31 es jueves: mañana es viernes 2027-01-01.
    expect(selectable(2027, 1, 1, '2026-12-31')).toBe(true);
    expect(selectable(2026, 12, 31, '2026-12-31')).toBe(false);
    // 2026-10-30 es viernes: el fin de semana siguiente no se ofrece y el lunes 2 de noviembre sí.
    expect([31, 1, 2].map((day, i) => selectable(2026, i === 0 ? 10 : 11, day, '2026-10-30'))).toEqual([
      false,
      false,
      true,
    ]);
  });

  // Colombia aún es 5 de octubre a las 21:30, aunque en UTC ya sea el 6: con el "hoy" del
  // navegador en UTC el 6 se deshabilitaba y el primer día disponible parecía ser el 7.
  it('de noche, mientras UTC ya está en el día siguiente, "hoy" sigue siendo el de Colombia', () => {
    const colombiaToday = businessDateOf(new Date('2026-10-06T02:30:00.000Z'));

    expect(colombiaToday).toBe('2026-10-05');
    expect(selectable(2026, 10, 6, colombiaToday)).toBe(true);
  });
});
