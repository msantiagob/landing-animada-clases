import { describe, expect, it } from 'vitest';
import { createIdGenerator, isValidId, newId } from '~/lib/storage/ids';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const decodeTime = (id: string): number =>
  [...id.slice(0, 10)].reduce((total, char) => total * 32 + ALPHABET.indexOf(char), 0);

const zeros = (length: number) => new Uint8Array(length);
const filled = (value: number) => (length: number) => new Uint8Array(length).fill(value);

describe('createIdGenerator', () => {
  it('genera 26 caracteres del alfabeto Crockford, válidos para isValidId', () => {
    const next = createIdGenerator();

    for (let index = 0; index < 100; index += 1) {
      const id = next();

      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(isValidId(id)).toBe(true);
    }
  });

  it('codifica el reloj en los 10 primeros caracteres: se puede recuperar la hora de creación', () => {
    const moment = Date.UTC(2031, 2, 14, 15, 9, 26, 535);
    const next = createIdGenerator({ now: () => moment, random: zeros });

    expect(decodeTime(next())).toBe(moment);
    expect(createIdGenerator({ now: () => 0, random: zeros })().slice(0, 10)).toBe('0000000000');
  });

  it('usa el resto de cada byte aleatorio módulo 32: el byte 255 es "Z" y el 32 es "0"', () => {
    const maximum = createIdGenerator({ now: () => 1, random: filled(255) })();
    const wrapped = createIdGenerator({ now: () => 1, random: filled(32) })();

    expect(maximum.slice(10)).toBe('Z'.repeat(16));
    expect(wrapped.slice(10)).toBe('0'.repeat(16));
  });

  it('dos ids pedidos en el mismo milisegundo salen en orden: el segundo suma uno al azar anterior', () => {
    const next = createIdGenerator({ now: () => 1000, random: zeros });

    const ids = [next(), next(), next()];

    expect(ids.map((id) => id.slice(10))).toEqual(['0000000000000000', '0000000000000001', '0000000000000002']);
    expect([...ids].sort()).toEqual(ids);
  });

  it('el acarreo al sumar uno recorre los dígitos base 32', () => {
    const bytes = new Uint8Array(16).fill(31, 14); // ...ZZ
    const next = createIdGenerator({ now: () => 1000, random: () => bytes });

    expect(next().slice(10)).toBe('00000000000000ZZ');
    expect(next().slice(10)).toBe('0000000000000100');
  });

  it('si el azar del milisegundo se agota, sigue al milisegundo siguiente y el orden se mantiene', () => {
    const next = createIdGenerator({ now: () => 5000, random: filled(31) });

    const [first, second, third] = [next(), next(), next()];

    expect([decodeTime(first), decodeTime(second), decodeTime(third)]).toEqual([5000, 5001, 5002]);
    expect(first < second && second < third).toBe(true);
  });

  it('si el reloj retrocede, los ids siguen creciendo en vez de repetirse o desordenarse', () => {
    const clock = [2000, 1500, 1000, 2500];
    const next = createIdGenerator({ now: () => clock.shift()!, random: zeros });

    const ids = [next(), next(), next(), next()];

    expect(ids.map(decodeTime)).toEqual([2000, 2000, 2000, 2500]);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(4);
  });

  it('si el reloj avanza, el id nuevo es mayor aunque el azar sea menor', () => {
    const randoms = [filled(255), zeros];
    let now = 1000;
    const next = createIdGenerator({ now: () => now, random: (length) => randoms.shift()!(length) });

    const early = next();
    now = 1001;
    const late = next();

    expect(late > early).toBe(true);
  });

  it('el orden alfabético de los ids es el orden cronológico', () => {
    const moments = [0, 1, 31, 32, 1_000, 1_700_000_000_000, 1_900_000_000_000, 2_000_000_000_000];
    const ids = moments.map((moment) => createIdGenerator({ now: () => moment })());

    expect([...ids].sort()).toEqual(ids);
  });

  it('10.000 ids seguidos son únicos y estrictamente crecientes', () => {
    const next = createIdGenerator();
    const ids = Array.from({ length: 10_000 }, next);

    expect(new Set(ids).size).toBe(10_000);
    expect(ids.slice(1).every((id, index) => id > ids[index])).toBe(true);
  });
});

describe('newId', () => {
  it('es el generador compartido del proceso: monotónico entre llamadas', () => {
    const ids = Array.from({ length: 1_000 }, newId);

    expect(ids.slice(1).every((id, index) => id > ids[index])).toBe(true);
  });
});

describe('isValidId', () => {
  const valid = '01JZ8K3M5N7P9Q2R4S6T8V0WXY';

  it('acepta un id con la forma correcta', () => {
    expect(isValidId(valid)).toBe(true);
    expect(isValidId(newId())).toBe(true);
  });

  it.each([undefined, null, 0, 123, {}, [], [valid], true])('rechaza lo que no es un texto (%j)', (value) => {
    expect(isValidId(value)).toBe(false);
  });

  it.each([
    ['vacío', ''],
    ['de 25 caracteres', valid.slice(1)],
    ['de 27 caracteres', `${valid}0`],
    ['en minúsculas', valid.toLowerCase()],
    ['con espacios', ` ${valid.slice(1)}`],
    ['con salto de línea final', `${valid.slice(1)}\n`],
    ['con barra', `${valid.slice(0, 21)}/../x`],
    ['con porcentaje', `${valid.slice(0, 23)}%2F`],
    ['con interrogación', `${valid.slice(0, 25)}?`],
    ['con numeral', `${valid.slice(0, 25)}#`],
    ['con un dígito que no es ASCII', `${valid.slice(0, 25)}٣`],
    ['con el carácter nulo', `${valid.slice(0, 25)}\0`],
  ])('rechaza un id %s', (_name, value) => {
    expect(isValidId(value)).toBe(false);
  });

  it.each(['I', 'L', 'O', 'U'])(
    'rechaza la letra %s, que Crockford excluye por confundirse con otros caracteres',
    (letter) => {
      expect(isValidId(`${valid.slice(0, 25)}${letter}`)).toBe(false);
    }
  );
});
