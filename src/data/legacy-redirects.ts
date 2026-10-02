/**
 * URLs del sitio anterior que Google ya tiene indexadas, con su destino actual.
 *
 * Cada una responde 301 (astro.config.ts) para que el posicionamiento que
 * acumularon pase a la página nueva en lugar de convertirse en un 404.
 *
 * Reglas para tocar este archivo:
 * - Una redirección REEMPLAZA a la página con la misma ruta. Por eso `/servicios`,
 *   que es una página real (el hub de servicios), nunca puede ser un origen.
 * - Un destino no puede ser a su vez un origen: encadenar redirecciones gasta
 *   presupuesto de rastreo y diluye la señal.
 * - Los destinos son páginas que existen: la raíz, una landing o un hub del
 *   registro (src/data/landings.ts) o una de las páginas sueltas del sitio.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/agendar': '/booking',
  '/dashboard': '/admin/dashboard',

  '/servicios/aplicaciones-nativas': '/desarrollo-de-aplicaciones-moviles',
  '/servicios/aplicaciones-web': '/desarrollo-web',
  '/servicios/automatizacion-agentes': '/agentes-de-ia',
  '/servicios/automatizaciones': '/automatizaciones',
  '/servicios/diagnostico': '/booking',
  '/servicios/llms-ia-generativa': '/agentes-de-ia',
  '/servicios/machine-learning': '/desarrollo-de-software',
  '/servicios/python-para-ia': '/clases-de-python',
  '/servicios/soluciones-cloud': '/consultoria-aws',

  '/en': '/',
  '/en/schedule': '/booking',
  '/en/services': '/servicios',
  '/en/services/agent-automation': '/agentes-de-ia',
  '/en/services/automations': '/automatizaciones',
  '/en/services/cloud-solutions': '/consultoria-aws',
  '/en/services/diagnosis': '/booking',
  '/en/services/llms-generative-ai': '/agentes-de-ia',
  '/en/services/machine-learning': '/desarrollo-de-software',
  '/en/services/native-apps': '/desarrollo-de-aplicaciones-moviles',
  '/en/services/python-for-ai': '/clases-de-python',
  '/en/services/web-applications': '/desarrollo-web',

  // Páginas legales: /privacy y /terms eran el texto de demostración de la
  // plantilla (en inglés) y se eliminaron; las reemplazan /privacidad y /terminos.
  '/en/privacy': '/privacidad',
  '/en/terms': '/terminos',
  '/privacy': '/privacidad',
  '/terms': '/terminos',
};
