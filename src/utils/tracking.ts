import { WHATSAPP_URL_PREFIX } from '~/utils/whatsapp';

/**
 * Medición vía Google Tag Manager.
 *
 * Todo evento viaja por `window.dataLayer` y GTM decide qué hacer con él (GA4,
 * Meta, Ads). Así el código del sitio no conoce a ningún proveedor: cambiar de
 * herramienta es tocar el contenedor, no el repositorio.
 *
 * Regla de oro de este módulo: medir NUNCA puede romper la página ni el
 * formulario que dispara el evento. Por eso nada de acá lanza excepciones.
 */

export const LEAD_EVENT = 'generate_lead';
export const WHATSAPP_EVENT = 'whatsapp_click';

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,10}$/;

/**
 * El ID se interpola dentro de un <script> inline, así que se valida con una
 * lista cerrada de caracteres: lo que no tenga la forma de un contenedor real
 * jamás llega al HTML.
 */
export const isValidGtmId = (id: unknown): id is string => typeof id === 'string' && GTM_ID_PATTERN.test(id);

const assertGtmId = (id: string) => {
  if (!isValidGtmId(id)) throw new Error(`Invalid Google Tag Manager id: "${id}"`);
};

/** Fragmento oficial de <head> de GTM, sin las etiquetas <script>. */
export const gtmHeadSnippet = (id: string): string => {
  assertGtmId(id);

  return (
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
    `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
    `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=` +
    `'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
    `})(window,document,'script','dataLayer','${id}');`
  );
};

/** URL del iframe <noscript> que GTM pide como primer hijo de <body>. */
export const gtmNoscriptUrl = (id: string): string => {
  assertGtmId(id);

  return `https://www.googletagmanager.com/ns.html?id=${id}`;
};

/** Lo mínimo que se usa de `window`; así los tests pueden simularlo sin un DOM. */
interface TrackingWindow {
  dataLayer?: unknown[];
  location?: { pathname?: string };
  __sonmydWhatsAppTracking?: boolean;
}

const getWindow = (): TrackingWindow | null =>
  typeof window === 'undefined' ? null : (window as unknown as TrackingWindow);

/**
 * Empuja un evento al dataLayer. En el servidor no hace nada. En el cliente
 * crea el arreglo si GTM todavía no cargó: GTM procesa lo ya encolado cuando
 * arranca, así que no se pierde ningún evento por llegar antes.
 */
export const pushDataLayer = (event: string, params: Record<string, unknown> = {}): void => {
  const win = getWindow();
  if (!win) return;

  try {
    if (!Array.isArray(win.dataLayer)) win.dataLayer = [];
    // `event` va al final a propósito: un `params.event` no puede pisar el nombre.
    win.dataLayer.push({ ...params, event });
  } catch {
    // Medir nunca debe romper la página ni el formulario que lo disparó.
  }
};

export interface LeadTrackingInput {
  /** Servicio por el que preguntó la persona; vacío se reporta como "sin-especificar". */
  interest?: string | null;
  /** Qué formulario fue (`lead`, `booking`...), para separarlos en los informes. */
  formId: string;
}

/** Un lead capturado. `generate_lead` es el evento recomendado de GA4 para esto. */
export const trackLead = ({ interest, formId }: LeadTrackingInput): void =>
  pushDataLayer(LEAD_EVENT, { interest: interest?.trim() || 'sin-especificar', form_id: formId });

/** Un clic en cualquier enlace a WhatsApp; `location` dice en qué parte de la página estaba. */
export const trackWhatsAppClick = (location: string): void =>
  pushDataLayer(WHATSAPP_EVENT, { link_location: location, page_path: getWindow()?.location?.pathname ?? '' });

export const WHATSAPP_LINK_SELECTOR = `a[href^="${WHATSAPP_URL_PREFIX}"]`;

interface ClickableLike {
  closest?: (selector: string) => { dataset?: Record<string, string | undefined> } | null;
}

/**
 * Si el clic cayó dentro de un enlace a WhatsApp devuelve dónde estaba el
 * botón (`data-whatsapp-location`, o "link" si no lo declara); si no, `null`.
 * Usa `closest` porque el clic suele caer en el icono SVG de dentro del enlace.
 */
export const whatsappLocationFromClick = (event: { target: unknown }): string | null => {
  const target = event.target as ClickableLike | null;
  if (typeof target?.closest !== 'function') return null;

  const link = target.closest(WHATSAPP_LINK_SELECTOR);
  if (!link) return null;

  return link.dataset?.whatsappLocation || 'link';
};

/**
 * UN solo listener delegado en `document` para todos los enlaces a WhatsApp:
 * los de los botones, el flotante y los que se escriban a mano en una página.
 * Delegar evita volver a enlazar tras cada navegación del ClientRouter, y la
 * marca en `window` evita duplicarlo si este código se ejecutara dos veces
 * (un doble listener contaría cada clic doble).
 *
 * Devuelve `true` solo cuando registró el listener.
 */
export const initWhatsAppTracking = (target?: Pick<Document, 'addEventListener'>): boolean => {
  const win = getWindow();
  const root = target ?? (typeof document === 'undefined' ? undefined : document);

  if (!win || !root || win.__sonmydWhatsAppTracking) return false;
  win.__sonmydWhatsAppTracking = true;

  root.addEventListener('click', (event) => {
    const location = whatsappLocationFromClick(event);
    if (location) trackWhatsAppClick(location);
  });

  return true;
};
