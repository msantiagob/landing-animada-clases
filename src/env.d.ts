// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

// El adaptador de Netlify inyecta en cada petición `Astro.locals.netlify.context`
// (contexto del deploy, `waitUntil`...). No existe en las páginas prerenderizadas.
type NetlifyLocals = import('@astrojs/netlify').NetlifyLocals;

declare namespace App {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Locals extends NetlifyLocals {}
}
