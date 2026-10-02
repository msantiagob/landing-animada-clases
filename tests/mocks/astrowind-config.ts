// Stub del módulo virtual `astrowind:config`, que solo existe dentro del build
// de Astro. Sin esto, cualquier test que importe utils/seo.ts explota.
export const SITE = {
  name: 'Sonmyd',
  site: 'https://sonmyd.co',
  base: '/',
  trailingSlash: false,
};

export const I18N = { language: 'es', textDirection: 'ltr' };
export const METADATA = {};
export const APP_BLOG = { isEnabled: true };
export const UI = { theme: 'system' };
