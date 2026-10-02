import { describe, expect, it, vi } from 'vitest';
import { getDeployContext, runInBackground, type RequestLocals } from '~/lib/netlify';

/**
 * Lo poco que el sitio lee de `Astro.locals` en Netlify: el contexto del despliegue y
 * `waitUntil`, que mantiene viva la función mientras termina un correo que ya no retrasa la
 * respuesta. Fuera de Netlify (desarrollo, tests) nada de eso existe y todo tiene que seguir
 * funcionando.
 */

type NetlifyContext = NonNullable<NonNullable<RequestLocals['netlify']>['context']>;

const withContext = (context: NetlifyContext): RequestLocals => ({ netlify: { context } });

/** Lo que Astro entrega fuera de Netlify o con el contexto a medias: no trae ni despliegue ni `waitUntil`. */
const NOT_ON_NETLIFY: Array<[label: string, locals: RequestLocals | undefined]> = [
  ['sin locals', undefined],
  ['locals vacío', {}],
  ['netlify vacío', { netlify: {} }],
  ['un contexto vacío', { netlify: { context: {} } }],
  ['netlify en null', { netlify: null } as unknown as RequestLocals],
];

/** Lo mismo, más un contexto que sí informa el despliegue pero no trae `waitUntil`. */
const WITHOUT_WAIT_UNTIL: Array<[label: string, locals: RequestLocals | undefined]> = [
  ...NOT_ON_NETLIFY,
  ['un contexto solo con el despliegue', withContext({ deploy: { context: 'dev' } })],
];

describe('getDeployContext', () => {
  it.each(['production', 'deploy-preview', 'branch-deploy', 'dev'])(
    'devuelve "%s" tal como lo informa Netlify',
    (name) => {
      expect(getDeployContext(withContext({ deploy: { context: name } }))).toBe(name);
    }
  );

  it('no inventa un valor: un contexto que Netlify no conoce se devuelve igual', () => {
    expect(getDeployContext(withContext({ deploy: { context: 'otro-contexto' } }))).toBe('otro-contexto');
  });

  it.each([
    ...NOT_ON_NETLIFY,
    ['un despliegue sin contexto', withContext({ deploy: {} })],
    ['un despliegue en null', withContext({ deploy: null } as unknown as NetlifyContext)],
  ])('devuelve undefined, y no lanza, con %s', (_caso, locals) => {
    expect(getDeployContext(locals)).toBeUndefined();
  });

  it('sin argumentos tampoco lanza', () => {
    expect(getDeployContext()).toBeUndefined();
  });
});

describe('runInBackground con waitUntil de Netlify', () => {
  it('le entrega la tarea a waitUntil para que la función siga viva hasta que termine', async () => {
    const waitUntil = vi.fn();
    let finish!: () => void;
    const task = new Promise<void>((resolve) => {
      finish = resolve;
    });

    runInBackground(withContext({ waitUntil }), task);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    const handed: unknown = waitUntil.mock.calls[0][0];
    expect(handed).toBeInstanceOf(Promise);

    // Lo que se le entrega no termina antes que la tarea: si terminara antes, Netlify podría
    // congelar la función con el correo a medio enviar.
    let settled = false;
    void (handed as Promise<unknown>).then(() => {
      settled = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    finish();
    await handed;
    expect(settled).toBe(true);
  });

  it('vuelve al instante, sin esperar a la tarea: la respuesta no se retrasa', () => {
    const waitUntil = vi.fn();
    const never = new Promise<void>(() => undefined);

    const returned = runInBackground(withContext({ waitUntil }), never);

    expect(returned).toBeUndefined();
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('cada tarea se entrega por separado: la confirmación y el aviso de una cita son dos', () => {
    const waitUntil = vi.fn();

    runInBackground(withContext({ waitUntil }), Promise.resolve(1));
    runInBackground(withContext({ waitUntil }), Promise.resolve(2));

    expect(waitUntil).toHaveBeenCalledTimes(2);
    expect(waitUntil.mock.calls[0][0]).not.toBe(waitUntil.mock.calls[1][0]);
  });

  it('si la tarea falla, registra el fallo y lo que le dio a waitUntil termina bien, sin rechazar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const waitUntil = vi.fn();
    const failure = new Error('SMTP caído');

    runInBackground(withContext({ waitUntil }), Promise.reject(failure));

    // Si rechazara, Netlify registraría un error no capturado aunque la respuesta ya salió bien.
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('[background] La tarea en segundo plano falló:', failure);
  });

  it('un fallo no se propaga a quien lo llama ni afecta a la otra tarea', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const waitUntil = vi.fn();

    expect(() => {
      runInBackground(withContext({ waitUntil }), Promise.reject(new Error('uno')));
      runInBackground(withContext({ waitUntil }), Promise.resolve('dos'));
    }).not.toThrow();

    await expect(Promise.all(waitUntil.mock.calls.map(([promise]) => promise))).resolves.toEqual([undefined, 'dos']);
  });

  it('una tarea que termina bien no deja nada en los logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const waitUntil = vi.fn();

    runInBackground(withContext({ waitUntil }), Promise.resolve('listo'));

    await expect(waitUntil.mock.calls[0][0]).resolves.toBe('listo');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('invoca waitUntil como método: funciona aunque Netlify lo implemente apoyándose en `this`', async () => {
    // Un método de clase real: extraído y llamado suelto, `this` es undefined y lanza.
    class RuntimeContext {
      readonly pending: Array<Promise<unknown>> = [];

      waitUntil(promise: Promise<unknown>): void {
        this.pending.push(promise);
      }
    }
    const context = new RuntimeContext();

    runInBackground(withContext(context), Promise.resolve('aviso enviado'));

    expect(context.pending).toHaveLength(1);
    await expect(context.pending[0]).resolves.toBe('aviso enviado');
  });

  it('si waitUntil lanza, no tumba la respuesta: lo registra y la tarea sigue corriendo', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = new Error('waitUntil no disponible');
    const effect = vi.fn();
    const task = Promise.resolve().then(effect);

    expect(() =>
      runInBackground(
        withContext({
          waitUntil: () => {
            throw broken;
          },
        }),
        task
      )
    ).not.toThrow();

    await task;
    expect(effect).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[background] waitUntil falló; la tarea sigue sin la extensión de vida:',
      broken
    );
  });
});

describe('runInBackground fuera de Netlify (desarrollo y tests: no hay waitUntil)', () => {
  it.each(WITHOUT_WAIT_UNTIL)('no lanza con %s y la tarea corre sola', async (_caso, locals) => {
    const effect = vi.fn();
    const task = Promise.resolve().then(effect);

    expect(() => runInBackground(locals, task)).not.toThrow();

    await task;
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it.each(WITHOUT_WAIT_UNTIL)(
    'con %s, un fallo de la tarea se registra y no queda sin capturar',
    async (_caso, locals) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      const failure = new Error('SMTP caído');

      try {
        runInBackground(locals, Promise.reject(failure));
        await new Promise((resolve) => setImmediate(resolve));
      } finally {
        process.off('unhandledRejection', unhandled);
      }

      expect(consoleError).toHaveBeenCalledWith('[background] La tarea en segundo plano falló:', failure);
      expect(unhandled).not.toHaveBeenCalled();
    }
  );

  // Un `waitUntil` que no es una función (lo que sea que Astro o un mock pongan ahí) se ignora.
  it.each([null, 'no soy una función', 42, {}])('ignora un waitUntil que es %j', async (waitUntil) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('SMTP caído');
    const locals = withContext({ waitUntil } as unknown as NetlifyContext);

    expect(() => runInBackground(locals, Promise.reject(failure))).not.toThrow();

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('[background] La tarea en segundo plano falló:', failure)
    );
  });
});
