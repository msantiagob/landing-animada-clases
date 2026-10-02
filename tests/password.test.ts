import { spawnSync } from 'node:child_process';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SCRYPT_PARAMS, hashPassword, isPasswordHash, verifyPassword } from '~/lib/password';

// Se envuelve la comparación real para comprobar que la verificación usa la de tiempo constante.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();

  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const PASSWORD = 'correct-horse-battery-staple-7';
/** Costos mínimos para que los tests no tarden: el hash lleva sus parámetros y se verifica con ellos. */
const LIGHT = { N: 1024, r: 8, p: 1 };
const SALT = Buffer.alloc(16, 7);

const fields = (hash: string) => {
  const [algorithm, N, r, p, salt, key] = hash.split(':');

  return { algorithm, N: Number(N), r: Number(r), p: Number(p), salt, key };
};

/** Un hash con el formato del módulo pero con los bytes que se pidan (largo de clave, parámetros...). */
const handmade = (keyLength: number, params = LIGHT, salt = SALT) => {
  const key = scryptSync(PASSWORD, salt, keyLength, { ...params, maxmem: 256 * params.r * (params.N + params.p + 8) });

  return ['scrypt', params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join(':');
};

afterEach(() => {
  vi.mocked(timingSafeEqual).mockClear();
});

describe('hashPassword', () => {
  it('produce "scrypt:N:r:p:sal:hash" con los costos por defecto de OWASP (N=2^15, r=8, p=3)', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(DEFAULT_SCRYPT_PARAMS).toEqual({ N: 32768, r: 8, p: 3 });
    expect(fields(hash)).toMatchObject({ algorithm: 'scrypt', N: 32768, r: 8, p: 3 });
    expect(hash.split(':')).toHaveLength(6);
  });

  it('usa una sal de 16 bytes y una clave de 32', async () => {
    const { salt, key } = fields(await hashPassword(PASSWORD, LIGHT));

    expect(Buffer.from(salt, 'base64url')).toHaveLength(16);
    expect(Buffer.from(key, 'base64url')).toHaveLength(32);
  });

  it('solo usa [A-Za-z0-9_:-]: sin "$", comillas, espacios ni "=" que un .env, el shell o TOML pudieran alterar', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await hashPassword(PASSWORD, LIGHT)).toMatch(/^[A-Za-z0-9_:-]+$/);
    }
  });

  it('cada hash lleva una sal nueva: la misma contraseña da textos distintos, y los dos sirven', async () => {
    const [first, second] = [await hashPassword(PASSWORD, LIGHT), await hashPassword(PASSWORD, LIGHT)];

    expect(first).not.toBe(second);
    expect(fields(first).salt).not.toBe(fields(second).salt);
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
  });

  it('con la misma sal da el mismo hash, y es el scrypt estándar de Node con esos parámetros', async () => {
    const hash = await hashPassword(PASSWORD, LIGHT, SALT);
    const expected = scryptSync(PASSWORD, SALT, 32, { ...LIGHT, maxmem: 256 * 8 * (1024 + 1 + 8) });

    expect(await hashPassword(PASSWORD, LIGHT, SALT)).toBe(hash);
    expect(fields(hash).key).toBe(expected.toString('base64url'));
  });

  it('guarda los parámetros que se le pidieron, para poder subirlos más adelante sin invalidar los hashes viejos', async () => {
    const hash = await hashPassword(PASSWORD, { N: 2048, r: 4, p: 2 });

    expect(fields(hash)).toMatchObject({ N: 2048, r: 4, p: 2 });
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
  });

  it('sube el límite de memoria de Node (32 MiB) cuando los costos lo necesitan', async () => {
    // N=2^16 con r=8 pide 64 MiB: sin el maxmem que calcula el módulo, Node lo rechaza.
    const hash = await hashPassword(PASSWORD, { N: 65536, r: 8, p: 1 });

    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
  });

  it.each([
    ['N que no es potencia de 2', { N: 1000, r: 8, p: 1 }],
    ['N demasiado chico', { N: 1, r: 8, p: 1 }],
    ['N en cero', { N: 0, r: 8, p: 1 }],
    ['N decimal', { N: 1024.5, r: 8, p: 1 }],
    ['N por encima de 2^20', { N: 2 ** 21, r: 8, p: 1 }],
    ['r en cero', { N: 1024, r: 0, p: 1 }],
    ['r por encima de 32', { N: 1024, r: 33, p: 1 }],
    ['r decimal', { N: 1024, r: 1.5, p: 1 }],
    ['p en cero', { N: 1024, r: 8, p: 0 }],
    ['p por encima de 16', { N: 1024, r: 8, p: 17 }],
    ['parámetros que no son números', { N: Number.NaN, r: 8, p: 1 }],
  ])('rechaza parámetros fuera de rango: %s', async (_name, params) => {
    await expect(hashPassword(PASSWORD, params)).rejects.toThrow('Parámetros de scrypt fuera de rango.');
  });

  it.each([
    ['con acentos, eñes y emojis', 'contraseña-ñandú-🚀-única'],
    ['muy larga', 'x'.repeat(10_000)],
    ['con espacios en los bordes', '  con espacios  '],
    ['vacía', ''],
  ])('acepta una contraseña %s y después la verifica', async (_name, password) => {
    const hash = await hashPassword(password, LIGHT);

    expect(await verifyPassword(password, hash)).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('ida y vuelta: la contraseña correcta pasa', async () => {
    expect(await verifyPassword(PASSWORD, await hashPassword(PASSWORD, LIGHT))).toBe(true);
  });

  it.each([
    ['otra contraseña', 'otra-contraseña-distinta-1'],
    ['la misma con otra capitalización', PASSWORD.toUpperCase()],
    ['la misma con un espacio al final', `${PASSWORD} `],
    ['la misma con un espacio al principio', ` ${PASSWORD}`],
    ['un prefijo de la correcta', PASSWORD.slice(0, -1)],
    ['la correcta con algo de más', `${PASSWORD}x`],
    ['vacía', ''],
  ])('rechaza %s', async (_name, attempt) => {
    expect(await verifyPassword(attempt, await hashPassword(PASSWORD, LIGHT))).toBe(false);
  });

  it('usa los parámetros del propio hash, no los de por defecto', async () => {
    const hash = handmade(32, { N: 2048, r: 8, p: 2 });

    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('otra-contraseña-1', hash)).toBe(false);
  });

  it.each([16, 32, 64, 128])('acepta hashes con una clave de %i bytes', async (keyLength) => {
    const hash = handmade(keyLength);

    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('otra-contraseña-1', hash)).toBe(false);
  });

  describe('hashes mal formados: devuelve false, nunca lanza', () => {
    const valid = handmade(32);
    const [algorithm, N, r, p, salt, key] = valid.split(':');

    it.each([
      ['sin definir', undefined],
      ['vacío', ''],
      ['texto plano', PASSWORD],
      ['solo el algoritmo', 'scrypt'],
      ['con un campo menos', ['scrypt', N, r, p, salt].join(':')],
      ['con un campo de más', `${valid}:extra`],
      ['de otro algoritmo', ['argon2', N, r, p, salt, key].join(':')],
      ['de bcrypt', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'],
      ['con N no numérico', [algorithm, 'mil', r, p, salt, key].join(':')],
      ['con N que no es potencia de 2', [algorithm, '1000', r, p, salt, key].join(':')],
      ['con N por encima del tope', [algorithm, String(2 ** 21), r, p, salt, key].join(':')],
      ['con r en cero', [algorithm, N, '0', p, salt, key].join(':')],
      ['con p por encima del tope', [algorithm, N, r, '17', salt, key].join(':')],
      ['con parámetros decimales', [algorithm, '1024.5', r, p, salt, key].join(':')],
      ['con la sal vacía', [algorithm, N, r, p, '', key].join(':')],
      ['con la clave vacía', [algorithm, N, r, p, salt, ''].join(':')],
      ['con una clave de 15 bytes', handmade(15)],
      ['con una clave de 129 bytes', handmade(129)],
      ['con la sal hecha solo de caracteres inválidos', [algorithm, N, r, p, '!!!!', key].join(':')],
    ])('%s', async (_name, stored) => {
      await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(false);
      expect(isPasswordHash(stored)).toBe(false);
    });

    it('un hash con costos que el módulo admite pero Node rechaza (N demasiado grande para r) da false, no una excepción', async () => {
      // scrypt exige N < 2^(16·r): con r=1, N=131072 no es calculable.
      const unsupported = ['scrypt', 131072, 1, 1, salt, key].join(':');

      expect(isPasswordHash(unsupported)).toBe(true);
      await expect(verifyPassword(PASSWORD, unsupported)).resolves.toBe(false);
    });

    it('no llega a calcular nada con un hash que no es válido', async () => {
      await verifyPassword(PASSWORD, 'scrypt:1000:8:1:abc:def');

      expect(timingSafeEqual).not.toHaveBeenCalled();
    });
  });

  describe('comparación en tiempo constante', () => {
    it('compara con timingSafeEqual dos buffers del mismo largo: el de la clave guardada', async () => {
      const hash = handmade(48);

      await verifyPassword(PASSWORD, hash);

      expect(timingSafeEqual).toHaveBeenCalledTimes(1);
      const [actual, stored] = vi.mocked(timingSafeEqual).mock.calls[0] as [Buffer, Buffer];
      expect([actual.length, stored.length]).toEqual([48, 48]);
    });

    it('también compara cuando la contraseña es incorrecta: no corta en el primer byte distinto', async () => {
      await verifyPassword('otra-contraseña-1', handmade(32));

      expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    });
  });
});

describe('isPasswordHash', () => {
  it('reconoce un hash del módulo sin comprobar ninguna contraseña', async () => {
    expect(isPasswordHash(await hashPassword(PASSWORD, LIGHT))).toBe(true);
    expect(timingSafeEqual).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'texto', '$2b$10$abc'])('no reconoce %j', (value) => {
    expect(isPasswordHash(value)).toBe(false);
  });
});

describe('scripts/hash-password.mjs', () => {
  const SCRIPT = resolve(__dirname, '../scripts/hash-password.mjs');

  /**
   * Corre el script como lo haría `npm run hash-password` con la contraseña por la
   * entrada estándar (sin terminal). Entorno vacío: no hereda ninguna variable. La
   * contraseña de estos tests es de ejemplo y no se escribe en ningún archivo.
   */
  const runScript = (input: string, args: string[] = [], cwd?: string) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], {
      input,
      encoding: 'utf8',
      env: {},
      cwd,
      timeout: 30_000,
    });

    return { status, stdout, stderr };
  };

  describe('con una contraseña válida', () => {
    let result: ReturnType<typeof runScript>;
    let hash: string;
    let filesWritten: string[];

    beforeAll(() => {
      // Corre en un directorio vacío: si el script escribiera algún archivo, aparecería ahí.
      const directory = mkdtempSync(join(tmpdir(), 'hash-password-'));

      try {
        result = runScript(`${PASSWORD}\n`, [], directory);
        filesWritten = readdirSync(directory);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }

      hash = result.stdout.trimEnd();
    });

    it('termina bien e imprime SOLO el hash, en una línea', () => {
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${hash}\n`);
      expect(hash).not.toContain('\n');
      expect(result.stdout).not.toContain(PASSWORD);
    });

    it('el hash tiene el formato del módulo y lo acepta isPasswordHash', () => {
      expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
      expect(isPasswordHash(hash)).toBe(true);
    });

    it('usa los mismos costos, sal y clave que password.ts: si se desincronizan, este test avisa', () => {
      const { N, r, p, salt, key } = fields(hash);

      expect({ N, r, p }).toEqual(DEFAULT_SCRYPT_PARAMS);
      expect(Buffer.from(salt, 'base64url')).toHaveLength(16);
      expect(Buffer.from(key, 'base64url')).toHaveLength(32);
    });

    it('verifyPassword del sitio acepta la contraseña y rechaza otra', async () => {
      expect(await verifyPassword(PASSWORD, hash)).toBe(true);
      expect(await verifyPassword(`${PASSWORD}x`, hash)).toBe(false);
    });

    it('las instrucciones salen por la salida de errores y no repiten ni la contraseña ni el hash', () => {
      expect(result.stderr).toContain('ADMIN_PASSWORD_HASH');
      expect(result.stderr).not.toContain(PASSWORD);
      expect(result.stderr).not.toContain(hash);
    });

    it('no escribe ningún archivo', () => {
      expect(filesWritten).toEqual([]);
    });

    it('cada ejecución usa una sal nueva', () => {
      const again = runScript(`${PASSWORD}\n`).stdout.trimEnd();

      expect(again).not.toBe(hash);
      expect(isPasswordHash(again)).toBe(true);
    });
  });

  describe('lectura de la contraseña', () => {
    it('quita solo el salto de línea final (también el de Windows) y conserva los espacios de los bordes', async () => {
      const password = ' espacios-que-importan-123 ';
      const { status, stdout } = runScript(`${password}\r\n`);

      expect(status).toBe(0);
      expect(await verifyPassword(password, stdout.trimEnd())).toBe(true);
      expect(await verifyPassword(password.trim(), stdout.trimEnd())).toBe(false);
    });

    it('acepta una contraseña de exactamente 12 caracteres, aunque no termine en salto de línea; con 11 no', async () => {
      const accepted = runScript('abcdefghijkl');
      const rejected = runScript('abcdefghijk\n');

      expect(accepted.status).toBe(0);
      expect(await verifyPassword('abcdefghijkl', accepted.stdout.trimEnd())).toBe(true);
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toBe('');
      expect(rejected.stderr).toContain('al menos 12 caracteres');
    });

    it('sin contraseña (entrada vacía) falla y no imprime ningún hash', () => {
      const { status, stdout } = runScript('');

      expect(status).toBe(1);
      expect(stdout).toBe('');
    });

    it('no acepta la contraseña como argumento (quedaría en el historial del shell)', () => {
      const { status, stdout, stderr } = runScript('', ['contraseña-pasada-por-argumento-123']);

      expect(status).toBe(1);
      expect(stdout).toBe('');
      expect(stderr).not.toContain('contraseña-pasada-por-argumento-123');
    });
  });
});
