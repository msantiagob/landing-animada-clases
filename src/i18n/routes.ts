export type LangPaths = { es: string; en: string };

/** Maps any page path (with or without trailing slash) → { es, en } canonical paths */
export const pathAliases: Record<string, LangPaths> = {
  '/':                               { es: '/',                               en: '/en' },
  '/en':                             { es: '/',                               en: '/en' },
  '/servicios':                      { es: '/servicios',                      en: '/en/services' },
  '/en/services':                    { es: '/servicios',                      en: '/en/services' },
  '/servicios/diagnostico':          { es: '/servicios/diagnostico',          en: '/en/services/diagnosis' },
  '/en/services/diagnosis':          { es: '/servicios/diagnostico',          en: '/en/services/diagnosis' },
  '/servicios/python-para-ia':       { es: '/servicios/python-para-ia',       en: '/en/services/python-for-ai' },
  '/en/services/python-for-ai':      { es: '/servicios/python-para-ia',       en: '/en/services/python-for-ai' },
  '/servicios/machine-learning':     { es: '/servicios/machine-learning',     en: '/en/services/machine-learning' },
  '/en/services/machine-learning':   { es: '/servicios/machine-learning',     en: '/en/services/machine-learning' },
  '/servicios/llms-ia-generativa':   { es: '/servicios/llms-ia-generativa',   en: '/en/services/llms-generative-ai' },
  '/en/services/llms-generative-ai': { es: '/servicios/llms-ia-generativa',   en: '/en/services/llms-generative-ai' },
  '/servicios/automatizacion-agentes': { es: '/servicios/automatizacion-agentes', en: '/en/services/agent-automation' },
  '/en/services/agent-automation':   { es: '/servicios/automatizacion-agentes', en: '/en/services/agent-automation' },
  '/servicios/aplicaciones-web':     { es: '/servicios/aplicaciones-web',     en: '/en/services/web-applications' },
  '/en/services/web-applications':   { es: '/servicios/aplicaciones-web',     en: '/en/services/web-applications' },
  '/servicios/automatizaciones':     { es: '/servicios/automatizaciones',     en: '/en/services/automations' },
  '/en/services/automations':        { es: '/servicios/automatizaciones',     en: '/en/services/automations' },
  '/servicios/soluciones-cloud':     { es: '/servicios/soluciones-cloud',     en: '/en/services/cloud-solutions' },
  '/en/services/cloud-solutions':    { es: '/servicios/soluciones-cloud',     en: '/en/services/cloud-solutions' },
  '/servicios/aplicaciones-nativas': { es: '/servicios/aplicaciones-nativas', en: '/en/services/native-apps' },
  '/en/services/native-apps':        { es: '/servicios/aplicaciones-nativas', en: '/en/services/native-apps' },
  '/terminos':                       { es: '/terminos',                       en: '/en/terms' },
  '/en/terms':                       { es: '/terminos',                       en: '/en/terms' },
  '/privacidad':                     { es: '/privacidad',                     en: '/en/privacy' },
  '/en/privacy':                     { es: '/privacidad',                     en: '/en/privacy' },
  '/agendar':                        { es: '/agendar',                        en: '/en/schedule' },
  '/en/schedule':                    { es: '/agendar',                        en: '/en/schedule' },
};

export function getAlternates(pathname: string, siteBase: string): { es: string; en: string } | null {
  // Normalize: strip trailing slash (except root)
  const key = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const pair = pathAliases[key];
  if (!pair) return null;
  const base = siteBase.replace(/\/$/, '');
  return {
    es: `${base}${pair.es}`,
    en: `${base}${pair.en}`,
  };
}
