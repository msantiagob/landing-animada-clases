import { createHmac, timingSafeEqual } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COOKIE, buildAuthCookie, buildLogoutCookie } from '~/lib/auth';
import { MIN_SECRET_LENGTH, SESSION_TTL_SECONDS, isUsableSecret, signSession, verifySession } from '~/lib/session';

// Se envuelve la comparación real para comprobar que la verificación usa la de tiempo constante.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();

  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const SECRET = '0f'.repeat(32);
const OTHER_SECRET = 'a1'.repeat(32);
const EMAIL = 'admin@sonmyd.co';
const NOW = Date.UTC(2031, 2, 14, 15, 0, 0);
const NOW_SECONDS = NOW / 1000;

const encode = (value: string) => Buffer.from(value).toString('base64url');
const hmac = (data: string, secret = SECRET) => createHmac('sha256', secret).update(data).digest('base64url');
/** Un token con firma VÁLIDA y el contenido que se quiera: lo que solo podría fabricar quien tuviera el secreto. */
const forge = (claims: unknown, secret = SECRET) => {
  const payload = encode(JSON.stringify(claims));

  return `${payload}.${hmac(payload, secret)}`;
};
const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
const goodClaims = { sub: EMAIL, role: 'admin', iat: NOW_SECONDS, exp: NOW_SECONDS + 3600 };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('isUsableSecret', () => {
  it('acepta desde 32 caracteres y rechaza menos', () => {
    expect(isUsableSecret('x'.repeat(MIN_SECRET_LENGTH))).toBe(true);
    expect(isUsableSecret('x'.repeat(MIN_SECRET_LENGTH - 1))).toBe(false);
    expect(MIN_SECRET_LENGTH).toBe(32);
  });

  it.each([undefined, null, '', 32, ['x'.repeat(32)], { length: 64 }])(
    'rechaza lo que no es un texto largo (%j)',
    (value) => {
      expect(isUsableSecret(value)).toBe(false);
    }
  );
});

describe('signSession', () => {
  it('firma "datos.firma" en base64url: HMAC-SHA256 del bloque de datos con SESSION_SECRET', () => {
    const token = signSession(EMAIL, SECRET, { now: NOW });
    const [payload, signature] = token.split('.');

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(signature).toBe(hmac(payload));
    expect(Buffer.from(signature, 'base64url')).toHaveLength(32);
  });

  it('los datos dicen quién es, que es admin, cuándo se emitió y cuándo vence (7 días)', () => {
    const token = signSession(EMAIL, SECRET, { now: NOW });

    expect(decode(token)).toEqual({
      sub: EMAIL,
      role: 'admin',
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 7 * 24 * 60 * 60,
    });
    expect(SESSION_TTL_SECONDS).toBe(604_800);
  });

  it('trunca los milisegundos al segundo y respeta una duración propia', () => {
    const claims = decode(signSession(EMAIL, SECRET, { now: NOW + 999, ttlSeconds: 60 }));

    expect(claims).toMatchObject({ iat: NOW_SECONDS, exp: NOW_SECONDS + 60 });
  });

  it('con el reloj del sistema por defecto, emite con la hora actual', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);

    expect(decode(signSession(EMAIL, SECRET))).toMatchObject({ iat: NOW_SECONDS });
  });

  it('es determinista, y cambiar el secreto o la persona cambia la firma', () => {
    const token = signSession(EMAIL, SECRET, { now: NOW });

    expect(signSession(EMAIL, SECRET, { now: NOW })).toBe(token);
    expect(signSession(EMAIL, OTHER_SECRET, { now: NOW })).not.toBe(token);
    expect(signSession('otra@sonmyd.co', SECRET, { now: NOW })).not.toBe(token);
  });

  it('el token no contiene el secreto', () => {
    const token = signSession(EMAIL, SECRET, { now: NOW });

    expect(token).not.toContain(SECRET);
    expect(Buffer.from(token.split('.')[0], 'base64url').toString()).not.toContain(SECRET);
  });

  it.each([undefined, '', 'corto', 'x'.repeat(MIN_SECRET_LENGTH - 1)])(
    'lanza si SESSION_SECRET falta o es demasiado corto (%j): es un error de configuración',
    (secret) => {
      expect(() => signSession(EMAIL, secret)).toThrow(/SESSION_SECRET.*mínimo 32/);
    }
  );

  it('con exactamente 32 caracteres ya firma', () => {
    expect(() => signSession(EMAIL, 'x'.repeat(32))).not.toThrow();
  });
});

describe('verifySession', () => {
  const token = signSession(EMAIL, SECRET, { now: NOW });

  it('ida y vuelta: devuelve los datos que se firmaron', () => {
    expect(verifySession(token, SECRET, NOW)).toEqual({
      sub: EMAIL,
      role: 'admin',
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + SESSION_TTL_SECONDS,
    });
  });

  it('con el reloj del sistema por defecto, vale hasta un segundo antes de vencer', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW + (SESSION_TTL_SECONDS - 1) * 1000);

    expect(verifySession(token, SECRET)).not.toBeNull();

    vi.setSystemTime(NOW + SESSION_TTL_SECONDS * 1000);

    expect(verifySession(token, SECRET)).toBeNull();
  });

  describe('vencimiento', () => {
    const expiresAt = (NOW_SECONDS + SESSION_TTL_SECONDS) * 1000;

    it('vale hasta el último milisegundo antes de exp', () => {
      expect(verifySession(token, SECRET, expiresAt - 1)).not.toBeNull();
    });

    it('en el instante exacto de exp y después ya no vale', () => {
      expect(verifySession(token, SECRET, expiresAt)).toBeNull();
      expect(verifySession(token, SECRET, expiresAt + 1)).toBeNull();
      expect(verifySession(token, SECRET, expiresAt + 365 * 24 * 3600 * 1000)).toBeNull();
    });

    it.each([0, -60])('un token con duración %i nace vencido', (ttlSeconds) => {
      expect(verifySession(signSession(EMAIL, SECRET, { now: NOW, ttlSeconds }), SECRET, NOW)).toBeNull();
    });
  });

  describe('secreto', () => {
    it('con otro secreto no vale: cambiar SESSION_SECRET cierra todas las sesiones', () => {
      expect(verifySession(token, OTHER_SECRET, NOW)).toBeNull();
    });

    it.each([undefined, '', 'corto', 'x'.repeat(MIN_SECRET_LENGTH - 1)])(
      'con un secreto que falta o es corto (%j) devuelve null y no lanza, aunque la firma coincida con ese secreto',
      (secret) => {
        const weakToken = secret ? forge(goodClaims, secret) : token;

        expect(verifySession(weakToken, secret, NOW)).toBeNull();
      }
    );
  });

  describe('datos manipulados', () => {
    const [payload, signature] = token.split('.');
    const withPayload = (claims: unknown) => `${encode(JSON.stringify(claims))}.${signature}`;

    it.each([
      ['otra persona', { ...goodClaims, sub: 'intruso@example.com' }],
      ['vencimiento más lejano', { ...goodClaims, exp: goodClaims.exp + 10 * 365 * 24 * 3600 }],
      ['otro rol', { ...goodClaims, role: 'superadmin' }],
    ])('cambiar %s en los datos conservando la firma original invalida el token', (_name, claims) => {
      expect(verifySession(withPayload(claims), SECRET, NOW)).toBeNull();
    });

    it('cambiar un solo carácter de los datos invalida el token', () => {
      const flipped = `${payload.slice(0, 5)}${payload[5] === 'A' ? 'B' : 'A'}${payload.slice(6)}.${signature}`;

      expect(verifySession(flipped, SECRET, NOW)).toBeNull();
    });

    it('los datos de un token con la firma de otro tampoco valen', () => {
      const other = signSession('otra@sonmyd.co', SECRET, { now: NOW });

      expect(verifySession(`${payload}.${other.split('.')[1]}`, SECRET, NOW)).toBeNull();
      expect(verifySession(`${other.split('.')[0]}.${signature}`, SECRET, NOW)).toBeNull();
    });

    it('invertir datos y firma no vale', () => {
      expect(verifySession(`${signature}.${payload}`, SECRET, NOW)).toBeNull();
    });
  });

  describe('firma manipulada', () => {
    const [payload, signature] = token.split('.');
    const flip = (char: string) => (char === 'A' ? 'B' : 'A');

    it.each([
      ['el primer carácter cambiado', `${flip(signature[0])}${signature.slice(1)}`],
      ['un carácter del medio cambiado', `${signature.slice(0, 20)}${flip(signature[20])}${signature.slice(21)}`],
      ['sin el último carácter', signature.slice(0, -1)],
      ['con un carácter de más', `${signature}A`],
      ['con relleno "="', `${signature}=`],
      ['vacía', ''],
      ['del largo correcto pero toda de ceros', 'A'.repeat(signature.length)],
      ['en hexadecimal', Buffer.from(signature, 'base64url').toString('hex')],
      ['en base64 con + y /', Buffer.from(signature, 'base64url').toString('base64')],
    ])('no vale con la firma %s', (_name, forged) => {
      expect(verifySession(`${payload}.${forged}`, SECRET, NOW)).toBeNull();
    });

    it('rechaza la variante no canónica de la misma firma (otro texto que decodifica a los mismos bytes)', () => {
      // 32 bytes son 43 caracteres base64url y el último solo usa 4 de sus 6 bits: hay 4 textos por firma.
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      const last = alphabet.indexOf(signature.at(-1)!);
      const sibling = alphabet[(last & ~3) | ((last + 1) & 3)];
      const variant = `${signature.slice(0, -1)}${sibling}`;

      expect(Buffer.from(variant, 'base64url').equals(Buffer.from(signature, 'base64url'))).toBe(true);
      expect(variant).not.toBe(signature);
      expect(verifySession(`${payload}.${variant}`, SECRET, NOW)).toBeNull();
      expect(verifySession(token, SECRET, NOW)).not.toBeNull();
    });
  });

  describe('tokens mal formados: devuelve null, nunca lanza', () => {
    it.each([
      null,
      undefined,
      '',
      ' ',
      'abc',
      '.',
      '..',
      'a.',
      '.b',
      'a.b.c',
      'Bearer abc.def',
      'x'.repeat(10_000),
      `${token}\n`,
      ` ${token}`,
      `${token}.extra`,
    ])('%j', (value) => {
      expect(() => verifySession(value as string, SECRET, NOW)).not.toThrow();
      expect(verifySession(value as string, SECRET, NOW)).toBeNull();
    });
  });

  describe('datos con firma válida pero contenido inválido', () => {
    it('el contenido de partida (control) sí vale', () => {
      expect(verifySession(forge(goodClaims), SECRET, NOW)).toEqual(goodClaims);
    });

    it.each([
      ['sin sub', { role: 'admin', iat: 1, exp: NOW_SECONDS + 1 }],
      ['con sub vacío', { ...goodClaims, sub: '' }],
      ['con sub que no es texto', { ...goodClaims, sub: 42 }],
      ['sin role', { sub: EMAIL, iat: 1, exp: NOW_SECONDS + 1 }],
      ['con otro role', { ...goodClaims, role: 'user' }],
      ['sin iat', { sub: EMAIL, role: 'admin', exp: NOW_SECONDS + 1 }],
      ['con iat en texto', { ...goodClaims, iat: '1' }],
      ['con iat no finito', { ...goodClaims, iat: null }],
      ['sin exp', { sub: EMAIL, role: 'admin', iat: 1 }],
      ['con exp en texto', { ...goodClaims, exp: String(NOW_SECONDS + 1) }],
      ['con exp nulo', { ...goodClaims, exp: null }],
      ['un arreglo', [goodClaims]],
      ['null', null],
      ['un número', 42],
      ['un texto', 'admin'],
    ])('no vale %s', (_name, claims) => {
      expect(verifySession(forge(claims), SECRET, NOW)).toBeNull();
    });

    it('datos que no son JSON no valen', () => {
      const payload = encode('esto no es json');

      expect(verifySession(`${payload}.${hmac(payload)}`, SECRET, NOW)).toBeNull();
    });
  });

  describe('comparación en tiempo constante', () => {
    it('compara la firma con timingSafeEqual sobre dos buffers de 32 bytes', () => {
      vi.mocked(timingSafeEqual).mockClear();

      verifySession(token, SECRET, NOW);

      expect(timingSafeEqual).toHaveBeenCalledTimes(1);
      const [provided, expected] = vi.mocked(timingSafeEqual).mock.calls[0] as [Buffer, Buffer];
      expect([provided.length, expected.length]).toEqual([32, 32]);
    });

    it('una firma de otro largo se descarta antes de comparar, porque timingSafeEqual lanzaría', () => {
      vi.mocked(timingSafeEqual).mockClear();

      expect(verifySession(`${token.split('.')[0]}.AAAA`, SECRET, NOW)).toBeNull();
      expect(timingSafeEqual).not.toHaveBeenCalled();
    });
  });
});

describe('cookie de sesión', () => {
  const token = signSession(EMAIL, SECRET, { now: NOW });
  const attributes = (cookie: string) => cookie.split('; ').slice(1);

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('lleva el token en la cookie "auth-token" y nada más antes del primer atributo', () => {
    expect(AUTH_COOKIE).toBe('auth-token');
    expect(buildAuthCookie(token).startsWith(`auth-token=${token}; `)).toBe(true);
  });

  it('tiene exactamente HttpOnly, Secure, Path=/, Max-Age y SameSite=Lax', () => {
    expect(attributes(buildAuthCookie(token)).sort()).toEqual(
      ['HttpOnly', 'Max-Age=604800', 'Path=/', 'SameSite=Lax', 'Secure'].sort()
    );
  });

  it('no fija Domain (queda atada al host) ni Expires (manda Max-Age)', () => {
    expect(buildAuthCookie(token)).not.toMatch(/Domain=|Expires=/i);
  });

  it('dura lo mismo que la sesión que contiene', () => {
    const maxAge = Number(/Max-Age=(\d+)/.exec(buildAuthCookie(token))![1]);

    expect(maxAge).toBe(SESSION_TTL_SECONDS);
    expect(maxAge).toBe(decode(token).exp - decode(token).iat);
  });

  it('el token cabe en la cookie sin escapar y verifica al sacarlo de ella', () => {
    const value = /^auth-token=([^;]*);/.exec(buildAuthCookie(token))![1];

    expect(value).toBe(token);
    expect(value).not.toMatch(/[\s;,"\\]/);
    expect(verifySession(value, SECRET, NOW)).not.toBeNull();
  });

  it.each(['production', 'test', undefined])('con NODE_ENV=%s la cookie es Secure', (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv);

    expect(attributes(buildAuthCookie(token))).toContain('Secure');
  });

  it('solo en el servidor de desarrollo (http://localhost) se omite Secure; el resto de atributos se mantiene', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(attributes(buildAuthCookie(token)).sort()).toEqual(
      ['HttpOnly', 'Max-Age=604800', 'Path=/', 'SameSite=Lax'].sort()
    );
  });

  it('la cookie de cierre de sesión vacía el valor y vence ya, con los mismos atributos para que el navegador la reemplace', () => {
    const logout = buildLogoutCookie();

    expect(logout.startsWith('auth-token=; ')).toBe(true);
    expect(attributes(logout).sort()).toEqual(['HttpOnly', 'Max-Age=0', 'Path=/', 'SameSite=Lax', 'Secure'].sort());
    expect(attributes(logout).filter((a) => !a.startsWith('Max-Age'))).toEqual(
      attributes(buildAuthCookie(token)).filter((a) => !a.startsWith('Max-Age'))
    );
  });
});
