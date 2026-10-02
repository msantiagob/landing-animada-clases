import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_NAME,
  StorageUnavailableError,
  createLeadStore,
  getLeadStore,
  setLeadStore,
  type LeadStoreEnvironment,
} from '~/lib/storage';
import { FakeBlobsStore } from './storage/fake-blobs';
import { contactInput } from './storage/helpers';

const blobs = vi.hoisted(() => ({ getStore: vi.fn(), getDeployStore: vi.fn() }));

vi.mock('@netlify/blobs', () => blobs);

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Lo mismo que lanza @netlify/blobs cuando el entorno no es Netlify: se reconoce por el nombre. */
class MissingBlobsEnvironmentError extends Error {
  constructor() {
    super('The environment has not been configured to use Netlify Blobs.');
    this.name = 'MissingBlobsEnvironmentError';
  }
}

const REQUEST = { name: 'leads', consistency: 'strong' } as const;

/** Un entorno de Netlify que funciona: devuelve un almacén en memoria con la forma del cliente de Blobs. */
const netlifyEnvironment = (overrides: Partial<LeadStoreEnvironment> = {}) => {
  const environment = {
    isDev: false,
    deployContext: 'production',
    getStore: vi.fn(() => new FakeBlobsStore()),
    getDeployStore: vi.fn(() => new FakeBlobsStore()),
    warn: vi.fn(),
    ...overrides,
  } satisfies LeadStoreEnvironment;

  return environment;
};

const outsideNetlify = () => {
  throw new MissingBlobsEnvironmentError();
};

describe('createLeadStore: dónde se guardan los leads', () => {
  describe('en Netlify', () => {
    it('abre el store "leads" del sitio con consistencia fuerte y no avisa de nada', () => {
      const environment = netlifyEnvironment();

      const store = createLeadStore(environment);

      expect(store).toMatchObject({ backend: 'netlify-blobs', scope: 'site' });
      expect(environment.getStore).toHaveBeenCalledExactlyOnceWith(REQUEST);
      expect(environment.getDeployStore).not.toHaveBeenCalled();
      expect(environment.warn).not.toHaveBeenCalled();
      expect(STORE_NAME).toBe('leads');
    });

    it.each([undefined, 'production', 'dev', 'otro-contexto-que-no-conozco', ''])(
      'con el contexto de deploy %j usa el store del sitio: un contexto ilegible nunca deja a producción sin dónde guardar',
      (deployContext) => {
        const environment = netlifyEnvironment({ deployContext });

        expect(createLeadStore(environment).scope).toBe('site');
        expect(environment.getDeployStore).not.toHaveBeenCalled();
      }
    );

    it.each(['deploy-preview', 'branch-deploy'])(
      'en %s usa un store atado al deploy, para no mezclar leads de prueba con los de producción',
      (deployContext) => {
        const environment = netlifyEnvironment({ deployContext });

        const store = createLeadStore(environment);

        expect(store).toMatchObject({ backend: 'netlify-blobs', scope: 'deploy' });
        expect(environment.getDeployStore).toHaveBeenCalledExactlyOnceWith(REQUEST);
        expect(environment.getStore).not.toHaveBeenCalled();
      }
    );

    it('si no se puede abrir el store de un deploy preview, NO cae al store del sitio', () => {
      const failure = new Error('deploy desconocido');
      const environment = netlifyEnvironment({
        deployContext: 'deploy-preview',
        getDeployStore: vi.fn(() => {
          throw failure;
        }),
      });

      expect(() => createLeadStore(environment)).toThrow(StorageUnavailableError);
      expect(environment.getStore).not.toHaveBeenCalled();
    });
  });

  describe('sin el entorno de Netlify', () => {
    it('en desarrollo cae a memoria con UN aviso que dice que los leads se pierden', () => {
      const environment = netlifyEnvironment({ isDev: true, getStore: vi.fn(outsideNetlify) });

      const store = createLeadStore(environment);

      expect(store).toMatchObject({ backend: 'memory', scope: 'process' });
      expect(environment.warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('EN MEMORIA'));
    });

    it('el store en memoria funciona de verdad', async () => {
      const store = createLeadStore(netlifyEnvironment({ isDev: true, getStore: vi.fn(outsideNetlify) }));

      const created = await store.createContact(contactInput());

      expect(await store.listContacts()).toEqual([created]);
    });

    it('fuera del servidor de desarrollo NUNCA cae a memoria: lanza StorageUnavailableError', () => {
      const environment = netlifyEnvironment({ isDev: false, getStore: vi.fn(outsideNetlify) });

      const error = (() => {
        try {
          createLeadStore(environment);
        } catch (caught) {
          return caught as StorageUnavailableError;
        }
      })();

      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect(error?.message).toBe('El entorno no está configurado para usar Netlify Blobs.');
      expect(error?.cause).toBeInstanceOf(MissingBlobsEnvironmentError);
      expect(environment.warn).not.toHaveBeenCalled();
    });

    it('en desarrollo, un fallo que NO es "falta el entorno" tampoco cae a memoria', () => {
      const failure = new Error('Blob store name must not contain slashes');
      const environment = netlifyEnvironment({
        isDev: true,
        getStore: vi.fn(() => {
          throw failure;
        }),
      });

      expect(() => createLeadStore(environment)).toThrow('No se pudo abrir el store de Netlify Blobs.');
      expect(environment.warn).not.toHaveBeenCalled();
    });

    it('si el entorno de desarrollo sí tiene Netlify Blobs (netlify dev), usa Blobs y no memoria', () => {
      const store = createLeadStore(netlifyEnvironment({ isDev: true }));

      expect(store.backend).toBe('netlify-blobs');
    });

    it('el error de entorno se reconoce por su nombre, no por su mensaje ni por heredar de otra clase', () => {
      const lookalike = Object.assign(new Error('The environment has not been configured to use Netlify Blobs.'), {
        name: 'OtroError',
      });
      const environment = netlifyEnvironment({
        isDev: true,
        getStore: vi.fn(() => {
          throw lookalike;
        }),
      });

      expect(() => createLeadStore(environment)).toThrow(StorageUnavailableError);
    });
  });

  describe('cuando Netlify Blobs falla', () => {
    it('el fallo sale como error en cada operación: no se guarda en memoria en silencio', async () => {
      const client = new FakeBlobsStore();
      const environment = netlifyEnvironment({ getStore: vi.fn(() => client) });
      const store = createLeadStore(environment);
      client.fail('setJSON');
      client.fail('list');

      await expect(store.createContact(contactInput())).rejects.toBeInstanceOf(StorageUnavailableError);
      await expect(store.listContacts()).rejects.toBeInstanceOf(StorageUnavailableError);

      expect(client.keys()).toEqual([]);
      expect(environment.warn).not.toHaveBeenCalled();
    });

    it('cuando el servicio se recupera, los datos nuevos llegan a Blobs y no hay nada "pendiente" en memoria', async () => {
      const client = new FakeBlobsStore();
      const store = createLeadStore(netlifyEnvironment({ getStore: vi.fn(() => client) }));
      client.fail('setJSON', undefined, { times: 1 });

      await expect(store.createContact(contactInput({ name: 'Perdido' }))).rejects.toBeInstanceOf(
        StorageUnavailableError
      );
      await store.createContact(contactInput({ name: 'Guardado' }));

      expect((await store.listContacts()).map((contact) => contact.name)).toEqual(['Guardado']);
      expect(client.keys('contact/')).toHaveLength(1);
    });
  });

  describe('con la librería real', () => {
    it('@netlify/blobs sin entorno lanza un error que se llama MissingBlobsEnvironmentError', async () => {
      const real = await vi.importActual<typeof import('@netlify/blobs')>('@netlify/blobs');
      vi.stubEnv('NETLIFY_BLOBS_CONTEXT', '');

      const error = (() => {
        try {
          real.getStore(REQUEST);
        } catch (caught) {
          return caught as Error;
        }
      })();

      expect(error?.name).toBe('MissingBlobsEnvironmentError');
    });

    it('con ese error real: en desarrollo cae a memoria y en producción lanza', async () => {
      const real = await vi.importActual<typeof import('@netlify/blobs')>('@netlify/blobs');
      vi.stubEnv('NETLIFY_BLOBS_CONTEXT', '');
      const realStore = (options: typeof REQUEST) => real.getStore(options);

      expect(createLeadStore(netlifyEnvironment({ isDev: true, getStore: realStore })).backend).toBe('memory');
      expect(() => createLeadStore(netlifyEnvironment({ isDev: false, getStore: realStore }))).toThrow(
        StorageUnavailableError
      );
    });
  });
});

describe('getLeadStore: el store de la instancia', () => {
  beforeEach(() => {
    setLeadStore(null);
    blobs.getStore.mockImplementation(outsideNetlify);
    blobs.getDeployStore.mockImplementation(outsideNetlify);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('DEV', true);

    return () => setLeadStore(null);
  });

  it('en desarrollo y sin Netlify usa memoria, y el aviso sale UNA sola vez aunque lleguen muchas peticiones', () => {
    for (let request = 0; request < 5; request += 1) getLeadStore();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(blobs.getStore).toHaveBeenCalledTimes(1);
  });

  it('devuelve siempre la misma instancia: el store en memoria no se vacía entre peticiones', async () => {
    const first = getLeadStore();
    const created = await first.createContact(contactInput());

    expect(getLeadStore()).toBe(first);
    expect(await getLeadStore().listContacts()).toEqual([created]);
  });

  it('en el bundle de producción (DEV es false) y sin Netlify NO hay memoria: lanza StorageUnavailableError', () => {
    vi.stubEnv('DEV', false);

    expect(() => getLeadStore()).toThrow(StorageUnavailableError);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('pide a Blobs el store "leads" con consistencia fuerte', () => {
    blobs.getStore.mockImplementation(() => new FakeBlobsStore());

    const store = getLeadStore();

    expect(store.backend).toBe('netlify-blobs');
    expect(blobs.getStore).toHaveBeenCalledExactlyOnceWith(REQUEST);
  });

  it('toma el contexto del deploy de locals.netlify.context.deploy.context', () => {
    blobs.getDeployStore.mockImplementation(() => new FakeBlobsStore());
    const locals = { netlify: { context: { deploy: { context: 'deploy-preview' } } } };

    const store = getLeadStore(locals);

    expect(store.scope).toBe('deploy');
    expect(blobs.getDeployStore).toHaveBeenCalledExactlyOnceWith(REQUEST);
    expect(blobs.getStore).not.toHaveBeenCalled();
  });

  it('si la primera vez falla, no deja el fallo guardado: la siguiente petición lo reintenta', () => {
    vi.stubEnv('DEV', false);
    blobs.getStore.mockImplementationOnce(() => {
      throw new Error('hipo de la red');
    });
    blobs.getStore.mockImplementation(() => new FakeBlobsStore());

    expect(() => getLeadStore()).toThrow(StorageUnavailableError);
    expect(getLeadStore().backend).toBe('netlify-blobs');
  });

  it('setLeadStore inyecta un store y, con null, lo descarta', () => {
    const injected = createLeadStore(netlifyEnvironment());
    setLeadStore(injected);

    expect(getLeadStore()).toBe(injected);
    expect(blobs.getStore).not.toHaveBeenCalled();

    setLeadStore(null);

    expect(getLeadStore()).not.toBe(injected);
  });
});
