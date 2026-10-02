import { randomBytes } from 'node:crypto';

/**
 * Identificadores ordenables por fecha, con la forma de un ULID: 26 caracteres
 * en base 32 de Crockford, 10 de tiempo (milisegundos desde 1970) y 16
 * aleatorios. Ordenar las claves por orden alfabético es ordenarlas por fecha
 * de creación, que es lo que usa el store para devolver "lo más nuevo primero"
 * sin guardar ningún índice aparte.
 *
 * Solo usa caracteres de URL seguros [0-9A-Z]: el cliente de Netlify Blobs
 * arma la URL con la clave tal cual, sin codificarla, así que una clave con
 * `?`, `#` o `%` se rompería.
 *
 * Es monotónico dentro de un mismo proceso: dos ids pedidos en el mismo
 * milisegundo (o con el reloj retrocediendo) siguen saliendo en orden. Entre
 * procesos distintos el orden dentro del mismo milisegundo es indiferente.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

const ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const isValidId = (value: unknown): value is string => typeof value === 'string' && ID_PATTERN.test(value);

export type RandomBytes = (length: number) => Uint8Array;

export interface IdGeneratorOptions {
  /** Reloj en milisegundos. Solo se reemplaza en los tests. */
  now?: () => number;
  /** Fuente de bytes aleatorios. Solo se reemplaza en los tests. */
  random?: RandomBytes;
}

export type IdGenerator = () => string;

const encodeTime = (milliseconds: number): string => {
  let remaining = Math.floor(milliseconds);
  let encoded = '';

  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = ALPHABET[remaining % ALPHABET.length] + encoded;
    remaining = Math.floor(remaining / ALPHABET.length);
  }

  return encoded;
};

/** Suma uno a los dígitos base 32. Devuelve `null` si ya estaban todos al máximo. */
const increment = (digits: number[]): number[] | null => {
  const next = [...digits];

  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index] < ALPHABET.length - 1) {
      next[index] += 1;
      return next;
    }

    next[index] = 0;
  }

  return null;
};

export const createIdGenerator = ({
  now = Date.now,
  random = (length) => randomBytes(length),
}: IdGeneratorOptions = {}): IdGenerator => {
  let lastTime = -1;
  let lastDigits: number[] = [];

  // 256 es múltiplo de 32: tomar el resto de cada byte no sesga la distribución.
  const freshDigits = () => Array.from(random(RANDOM_LENGTH), (byte) => byte % ALPHABET.length);

  return () => {
    let time = Math.max(now(), lastTime);
    let digits: number[] | null = time === lastTime ? increment(lastDigits) : freshDigits();

    if (digits === null) {
      // 32^16 ids en un milisegundo: no pasa, pero si pasara se sigue al siguiente.
      time += 1;
      digits = freshDigits();
    }

    lastTime = time;
    lastDigits = digits;

    return encodeTime(time) + digits.map((digit) => ALPHABET[digit]).join('');
  };
};

/** Generador compartido por el proceso. */
export const newId: IdGenerator = createIdGenerator();
