import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as healthModule from '~/pages/api/health';
import { GET } from '~/pages/api/health';
import {
  StorageUnavailableError,
  createBlobsStore,
  createMemoryStore,
  setLeadStore,
  type LeadStore,
} from '~/lib/storage';
import { FakeBlobsStore } from './storage/fake-blobs';

const blobs = vi.hoisted(() => ({ getStore: vi.fn(), getDeployStore: vi.fn() }));

vi.mock('@netlify/blobs', () => blobs);

/** El error que lanza @netlify/blobs fuera de Netlify: se reconoce por el nombre. */
const outsideNetlify = () => {
  throw Object.assign(new Error('The environment has not been configured to use Netlify Blobs.'), {
    name: 'MissingBlobsEnvironmentError',
  });
};

const SECRETS = {
  SESSION_SECRET: 'SENTINELA-secreto-de-sesion-0123456789abcdef',
  ADMIN_PASSWORD_HASH: 'SENTINELA-hash-de-la-contrasena',
  ADMIN_EMAIL: 'SENTINELA-admin@example.com',
  SMTP_USER: 'SENTINELA-usuario-smtp',
  SMTP_PASS: 'SENTINELA-clave-smtp',
  NETLIFY_BLOBS_CONTEXT: 'SENTINELA-contexto-de-blobs',
};

/** Una petición a /api/health tal como la recibe el endpoint. */
const call = (locals: unknown = {}) => GET({ locals } as never);

const failingPing = (message: string): LeadStore => {
  const store = createMemoryStore();
  vi.spyOn(store, 'ping').mockRejectedValue(new Error(message));

  return store;
};

describe('GET /api/health', () => {
  beforeEach(() => {
    setLeadStore(null);
    blobs.getStore.mockImplementation(outsideNetlify);
    blobs.getDeployStore.mockImplementation(outsideNetlify);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('DEV', true);
  });

  afterEach(() => {
    setLeadStore(null);
    vi.unstubAllEnvs();
  });

  describe('cuando todo responde', () => {
    it('en los tests usa memoria: 200, JSON y { status, storage, scope, timestamp }', async () => {
      const before = Date.now();

      const response = await call();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(body).toEqual({
        status: 'healthy',
        storage: 'memory',
        scope: 'process',
        timestamp: expect.any(String),
      });
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
      expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(before);
    });

    it('con Netlify Blobs informa el store y su alcance: "site" en producción', async () => {
      setLeadStore(createBlobsStore(new FakeBlobsStore(), { scope: 'site' }));

      expect(await (await call()).json()).toMatchObject({ status: 'healthy', storage: 'netlify-blobs', scope: 'site' });
    });

    it('en un deploy preview informa el alcance "deploy", tomado del contexto que inyecta el adaptador', async () => {
      blobs.getDeployStore.mockImplementation(() => new FakeBlobsStore());
      const locals = { netlify: { context: { deploy: { context: 'deploy-preview' } } } };

      expect(await (await call(locals)).json()).toMatchObject({ storage: 'netlify-blobs', scope: 'deploy' });
      expect(blobs.getStore).not.toHaveBeenCalled();
    });

    it('cada respuesta lleva la hora de su petición', async () => {
      const first = await (await call()).json();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await (await call()).json();

      expect(Date.parse(second.timestamp)).toBeGreaterThan(Date.parse(first.timestamp));
    });

    it('solo lee: no deja ningún dato en el almacenamiento', async () => {
      const store = createMemoryStore();
      setLeadStore(store);

      await call();

      expect(await store.listContacts()).toEqual([]);
      expect(await store.listAppointments()).toEqual([]);
    });
  });

  describe('cuando el almacenamiento falla', () => {
    it('si ping falla responde 503 "unhealthy" con el tipo de almacenamiento y sin scope', async () => {
      setLeadStore(failingPing('connection refused'));

      const response = await call();

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: 'unhealthy', storage: 'memory', timestamp: expect.any(String) });
    });

    it('con Netlify Blobs caído responde 503 e identifica a Netlify Blobs como el que falló', async () => {
      const client = new FakeBlobsStore();
      client.fail('get', new Error('503 Service Unavailable'));
      setLeadStore(createBlobsStore(client, { scope: 'site' }));

      const response = await call();

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ status: 'unhealthy', storage: 'netlify-blobs' });
    });

    it('si el store ni siquiera se puede abrir responde 503 y apunta a Netlify Blobs, que es el único en producción', async () => {
      blobs.getStore.mockImplementation(() => {
        throw new Error('token revocado');
      });

      const response = await call();

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        status: 'unhealthy',
        storage: 'netlify-blobs',
        timestamp: expect.any(String),
      });
    });

    it('en el bundle de producción sin el entorno de Netlify NO se declara sano con memoria: responde 503', async () => {
      vi.stubEnv('DEV', false);

      const response = await call();

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ status: 'unhealthy', storage: 'netlify-blobs' });
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('el fallo se registra en los logs, con el error original', async () => {
      const failure = new Error('connection refused');
      const store = createMemoryStore();
      vi.spyOn(store, 'ping').mockRejectedValue(failure);
      setLeadStore(store);

      await call();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[api/health]'), failure);
    });

    it('en cuanto el almacenamiento se recupera, la siguiente petición vuelve a dar 200', async () => {
      const store = createMemoryStore();
      vi.spyOn(store, 'ping').mockRejectedValueOnce(new StorageUnavailableError('caído')).mockResolvedValue(undefined);
      setLeadStore(store);

      expect((await call()).status).toBe(503);
      expect((await call()).status).toBe(200);
    });
  });

  describe('no filtra secretos', () => {
    beforeEach(() => {
      for (const [name, value] of Object.entries(SECRETS)) vi.stubEnv(name, value);
    });

    const scenarios: Array<[string, () => void]> = [
      ['sano', () => setLeadStore(createMemoryStore())],
      ['con el ping caído', () => setLeadStore(failingPing('fallo con password=hunter2 en 10.0.0.5:5432'))],
      [
        'con el store sin abrir',
        () =>
          blobs.getStore.mockImplementation(() => {
            throw new Error(`token ${SECRETS.SESSION_SECRET} rechazado`);
          }),
      ],
    ];

    it.each(scenarios)(
      'la respuesta %s no incluye ninguna variable de entorno ni el detalle del error',
      async (_name, arrange) => {
        arrange();

        const text = await (await call()).text();

        expect(text).not.toContain('SENTINELA');
        expect(text).not.toMatch(/hunter2|10\.0\.0\.5|token|secret|password|hash/i);
      }
    );

    it.each(scenarios)('la respuesta %s tiene solo campos conocidos', async (_name, arrange) => {
      arrange();

      const body = await (await call()).json();

      expect(Object.keys(body).sort()).toEqual(expect.arrayContaining(['status', 'storage', 'timestamp']));
      expect(Object.keys(body).every((key) => ['status', 'storage', 'scope', 'timestamp'].includes(key))).toBe(true);
    });
  });

  describe('forma del endpoint', () => {
    it('no se prerenderiza: un archivo estático diría "sano" para siempre', () => {
      expect(healthModule.prerender).toBe(false);
    });

    it('solo responde a GET', () => {
      expect(Object.keys(healthModule).sort()).toEqual(['GET', 'prerender']);
    });
  });
});
