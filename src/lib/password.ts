import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hash de contraseñas con scrypt, que viene en Node (sin dependencias). La
 * contraseña del administrador vive como un hash en la variable de entorno
 * ADMIN_PASSWORD_HASH; nunca en texto plano y nunca en el repositorio.
 *
 * Formato (autodescriptivo, así se pueden subir los costos sin invalidar los
 * hashes viejos):
 *
 *   scrypt:<N>:<r>:<p>:<sal en base64url>:<hash en base64url>
 *
 * A propósito NO usa el formato habitual `$scrypt$...` ni el `$2b$...` de
 * bcrypt: el signo `$` lo expanden los archivos `.env` (dotenv-expand) y el
 * shell, y un hash pegado ahí se corrompe sin avisar. Este solo lleva
 * [A-Za-z0-9_:-] y viaja intacto por variables de entorno, TOML y comillas.
 *
 * scripts/hash-password.mjs genera hashes con este mismo formato y parámetros
 * (tests/scripts.hash-password.test.ts comprueba que sigan siendo compatibles).
 */

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** N=2^15, r=8, p=3: la configuración de OWASP para scrypt con 32 MiB de memoria. ~0,3 s en un portátil. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 32768, r: 8, p: 3 };

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const isPowerOfTwo = (value: number) => Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;

const areSafeParams = ({ N, r, p }: ScryptParams): boolean =>
  isPowerOfTwo(N) &&
  N <= 2 ** 20 &&
  Number.isInteger(r) &&
  r >= 1 &&
  r <= 32 &&
  Number.isInteger(p) &&
  p >= 1 &&
  p <= 16;

/** La memoria que pide scrypt, con margen. Node la rechaza si supera `maxmem` (32 MiB por defecto). */
const memoryLimit = ({ N, r, p }: ScryptParams) => 256 * r * (N + p + 8);

const derive = (password: string, salt: Buffer, params: ScryptParams, length: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, length, { ...params, maxmem: memoryLimit(params) }, (error, key) =>
      error ? reject(error) : resolve(key)
    );
  });

export const hashPassword = async (
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
  salt: Buffer = randomBytes(SALT_LENGTH)
): Promise<string> => {
  if (!areSafeParams(params)) throw new Error('Parámetros de scrypt fuera de rango.');

  const key = await derive(password, salt, params, KEY_LENGTH);

  return [ALGORITHM, params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join(':');
};

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
}

const parseHash = (stored: string | undefined): ParsedHash | null => {
  if (!stored) return null;

  const [algorithm, rawN, rawR, rawP, rawSalt, rawKey, ...extra] = stored.split(':');
  if (algorithm !== ALGORITHM || extra.length > 0 || !rawSalt || !rawKey) return null;

  const params: ScryptParams = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!areSafeParams(params)) return null;

  const salt = Buffer.from(rawSalt, 'base64url');
  const key = Buffer.from(rawKey, 'base64url');
  if (salt.length === 0 || key.length < 16 || key.length > 128) return null;

  return { params, salt, key };
};

/** Si el texto tiene la forma de un hash de este módulo. No comprueba ninguna contraseña. */
export const isPasswordHash = (value: string | undefined): boolean => parseHash(value) !== null;

/**
 * Compara en tiempo constante. Un hash mal formado devuelve `false` en vez de
 * lanzar: una variable de entorno corrupta tiene que dar "credenciales
 * inválidas", no un error del servidor que revele cómo está configurado.
 */
export const verifyPassword = async (password: string, stored: string | undefined): Promise<boolean> => {
  const parsed = parseHash(stored);
  if (!parsed) return false;

  try {
    const actual = await derive(password, parsed.salt, parsed.params, parsed.key.length);

    return timingSafeEqual(actual, parsed.key);
  } catch {
    return false;
  }
};
