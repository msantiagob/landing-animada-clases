/**
 * Lo poco que el sitio lee de `Astro.locals`. El adaptador de Netlify lo
 * inyecta en cada petición (`locals.netlify.context`); en los tests y fuera de
 * Netlify puede faltar, así que todo se lee con cuidado.
 */
export interface RequestLocals {
  netlify?: {
    context?: {
      deploy?: { context?: string };
      waitUntil?: (promise: Promise<unknown>) => void;
    };
  };
}

/** `production`, `deploy-preview`, `branch-deploy` o `dev`. `undefined` si no se sabe. */
export const getDeployContext = (locals?: RequestLocals): string | undefined =>
  locals?.netlify?.context?.deploy?.context;

/**
 * Trabajo que no debe retrasar la respuesta, como un aviso por correo.
 *
 * En una función serverless, lo que sigue ejecutándose después de devolver la
 * respuesta puede quedar congelado y no terminar nunca: con un simple `void`
 * el correo que avisa de un lead nuevo se perdería en silencio. `waitUntil`
 * le pide a Netlify que mantenga viva la función hasta que termine. Fuera de
 * Netlify (desarrollo, tests) no existe y la promesa corre sola.
 *
 * Un fallo de la tarea se registra y no se propaga: la respuesta ya salió.
 */
export const runInBackground = (locals: RequestLocals | undefined, task: Promise<unknown>): void => {
  const guarded = task.catch((error: unknown) => {
    console.error('[background] La tarea en segundo plano falló:', error);
  });

  const context = locals?.netlify?.context;

  if (typeof context?.waitUntil !== 'function') return;

  // Se invoca como método: si Netlify lo implementa apoyándose en `this`, extraerlo lo rompería.
  // Y si aun así falla, no debe tumbar la respuesta: el lead ya está guardado y un error haría
  // que la persona reenviara el formulario.
  try {
    context.waitUntil(guarded);
  } catch (error) {
    console.error('[background] waitUntil falló; la tarea sigue sin la extensión de vida:', error);
  }
};
