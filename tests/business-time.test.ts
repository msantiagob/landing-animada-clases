import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUSINESS, BUSINESS_TIMEZONE } from '~/data/business';
import {
  BUSINESS_TIME_LABEL,
  businessDateOf,
  businessDateTimeToInstant,
  formatBusinessDateTime,
  withBusinessTimeLabel,
} from '~/utils/business-time';
import { SERVER_TIMEZONES, freezeClock, resetTestEnvironment, stubServerTimezone } from './helpers';

/**
 * La hora del negocio es la de Colombia (UTC-5, sin horario de verano), no la del servidor.
 * Netlify corre las funciones en UTC: antes, "2026-10-05 11:00" se leía como las 11:00 de
 * UTC, cinco horas antes de lo que la persona eligió.
 *
 * Todo lo de abajo se ejecuta con el servidor en varias zonas (`stubServerTimezone`) y tiene
 * que dar exactamente lo mismo en todas.
 */

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe('la zona del negocio', () => {
  it('es la de Colombia: America/Bogota, UTC-5', () => {
    expect(BUSINESS_TIMEZONE).toBe('America/Bogota');
    expect(BUSINESS.timezone).toBe(BUSINESS_TIMEZONE);
    expect(BUSINESS.utcOffsetMinutes).toBe(-5 * 60);
  });

  // La conversión fecha+hora → instante usa el desfase fijo; la inversa usa Intl con el nombre
  // de la zona. Si Colombia volviera a adoptar un horario de verano, los dos dejarían de coincidir
  // y este test avisa, en vez de que las citas se corran una hora en silencio.
  it('Colombia no cambia de hora: de 2020 a 2040 el desfase fijo y Intl dicen lo mismo', () => {
    const mismatches: string[] = [];

    for (let year = 2020; year <= 2040; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (const day of [1, 15]) {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const [y, m, d] = date.split('-');

          for (const time of ['00:00', '09:00', '18:00', '23:59']) {
            const instant = businessDateTimeToInstant(date, time);
            const expected = `${d}/${m}/${y} ${time}`;
            const actual = instant ? formatBusinessDateTime(instant) : 'inválido';

            if (actual !== expected) mismatches.push(`${date} ${time} → ${actual}`);
          }
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});

describe.each(SERVER_TIMEZONES)('con el servidor en %s', (serverTimezone) => {
  beforeEach(() => stubServerTimezone(serverTimezone));
  afterEach(resetTestEnvironment);

  describe('businessDateTimeToInstant: fecha y hora de Colombia → instante', () => {
    it.each([
      ['la apertura, 09:00', '2026-10-05', '09:00', '2026-10-05T14:00:00.000Z'],
      ['el último turno, 18:00', '2026-10-05', '18:00', '2026-10-05T23:00:00.000Z'],
      ['una hora que cruza la medianoche de UTC, 19:00', '2026-10-05', '19:00', '2026-10-06T00:00:00.000Z'],
      ['la medianoche de Colombia, 00:00', '2026-10-05', '00:00', '2026-10-05T05:00:00.000Z'],
      ['el último minuto del año, 23:59', '2026-12-31', '23:59', '2027-01-01T04:59:00.000Z'],
      ['un 29 de febrero bisiesto', '2028-02-29', '10:00', '2028-02-29T15:00:00.000Z'],
    ])('%s', (_caso, date, time, expected) => {
      expect(iso(businessDateTimeToInstant(date, time))).toBe(expected);
    });
  });

  describe('businessDateOf: en qué día está Colombia en un instante', () => {
    it.each([
      ['el mediodía', '2026-10-05T17:00:00.000Z', '2026-10-05'],
      // El caso que rompe a quien usa la fecha de UTC: ya es "mañana" allá, pero en Colombia es de noche.
      ['de noche, con UTC ya en el día siguiente', '2026-10-06T02:30:00.000Z', '2026-10-05'],
      ['el último milisegundo del día', '2026-10-06T04:59:59.999Z', '2026-10-05'],
      ['la medianoche exacta de Colombia', '2026-10-06T05:00:00.000Z', '2026-10-06'],
      ['el último instante del año', '2026-01-01T04:59:59.999Z', '2025-12-31'],
      ['el primer instante del año', '2026-01-01T05:00:00.000Z', '2026-01-01'],
      ['el 29 de febrero, de noche', '2028-03-01T04:59:00.000Z', '2028-02-29'],
    ])('%s', (_caso, instant, expected) => {
      expect(businessDateOf(new Date(instant))).toBe(expected);
    });

    it('sin argumento usa el reloj actual', () => {
      freezeClock('2026-10-06T02:30:00.000Z');

      expect(businessDateOf()).toBe('2026-10-05');
    });
  });

  describe('formatBusinessDateTime: un instante guardado en UTC → hora de Colombia', () => {
    it.each([
      ['de noche, con UTC ya en el día siguiente', '2026-10-06T02:30:00.000Z', '05/10/2026 21:30'],
      ['de mañana', '2026-10-05T14:05:00.000Z', '05/10/2026 09:05'],
      ['a la medianoche, como 00:00 y no 24:00', '2026-10-06T05:00:00.000Z', '06/10/2026 00:00'],
      ['el primer minuto del año', '2026-01-01T05:01:00.000Z', '01/01/2026 00:01'],
    ])('%s', (_caso, value, expected) => {
      expect(formatBusinessDateTime(value)).toBe(expected);
    });

    it('acepta también un Date', () => {
      expect(formatBusinessDateTime(new Date('2026-10-06T02:30:00.000Z'))).toBe('05/10/2026 21:30');
    });
  });
});

describe('businessDateTimeToInstant: lo que no es una fecha y hora real', () => {
  it.each([
    ['un 31 de febrero (V8 lo pasaría a marzo)', '2027-02-31', '10:00'],
    ['un 29 de febrero de un año que no es bisiesto', '2027-02-29', '10:00'],
    ['un 31 de abril', '2026-04-31', '10:00'],
    ['el mes 13', '2026-13-01', '10:00'],
    ['el mes 00', '2026-00-10', '10:00'],
    ['el día 00', '2026-10-00', '10:00'],
    ['el día 32', '2026-10-32', '10:00'],
    ['las 24:00 (V8 las pasaría al día siguiente)', '2026-10-05', '24:00'],
    ['las 25:00', '2026-10-05', '25:00'],
    ['el minuto 60', '2026-10-05', '09:60'],
    ['un año de dos cifras', '0026-10-05', '10:00'],
    ['un mes sin cero a la izquierda', '2026-1-05', '10:00'],
    ['una hora sin cero a la izquierda', '2026-10-05', '9:00'],
    ['una hora con segundos', '2026-10-05', '09:00:00'],
    ['una fecha con hora pegada', '2026-10-05T09:00', '09:00'],
    ['una fecha con otro orden', '05/10/2026', '09:00'],
    ['una fecha con espacios', ' 2026-10-05', '09:00'],
    ['texto', 'mañana', 'temprano'],
    ['todo vacío', '', ''],
  ])('devuelve null ante %s', (_caso, date, time) => {
    expect(businessDateTimeToInstant(date, time)).toBeNull();
  });

  it('acepta los dos extremos del día: 00:00 y 23:59', () => {
    expect(businessDateTimeToInstant('2026-10-05', '00:00')).not.toBeNull();
    expect(businessDateTimeToInstant('2026-10-05', '23:59')).not.toBeNull();
  });
});

describe('formatBusinessDateTime: lo que no es una fecha', () => {
  it.each(['no es una fecha', '', '2026-13-45T99:00:00Z'])('devuelve el texto tal como llegó: "%s"', (value) => {
    expect(formatBusinessDateTime(value)).toBe(value);
  });
});

describe('la hora en los textos para las personas', () => {
  it('se nombra "hora de Colombia"', () => {
    expect(BUSINESS_TIME_LABEL).toBe('hora de Colombia');
  });

  it('withBusinessTimeLabel aclara la zona, para quien reserva desde otro país', () => {
    expect(withBusinessTimeLabel('10:00')).toBe('10:00 (hora de Colombia)');
  });
});
