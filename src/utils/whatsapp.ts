import { BUSINESS } from '~/data/business';

/** Prefijo de todo enlace de contacto. El rastreo de clics lo usa para reconocerlos. */
export const WHATSAPP_URL_PREFIX = 'https://wa.me/';

export const WHATSAPP_BASE_URL = `${WHATSAPP_URL_PREFIX}${BUSINESS.whatsappNumber}`;

/** Texto por defecto de los botones y nombre accesible del botón flotante. */
export const WHATSAPP_DEFAULT_TEXT = 'Escríbenos por WhatsApp';

/**
 * Enlace de chat con el número del negocio. El mensaje es opcional: sin él se
 * abre el chat vacío, y si solo trae espacios se trata como si no existiera
 * para no dejar un `?text=` que prellena un mensaje en blanco.
 */
export const whatsappUrl = (message?: string): string => {
  const text = message?.trim();

  return text ? `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(text)}` : WHATSAPP_BASE_URL;
};

/**
 * Nombre accesible de un botón de WhatsApp. Si el texto visible ya nombra la
 * plataforma se usa tal cual; si no ("Cotizar ahora"), se le agrega, porque
 * quien navega con lector de pantalla tiene que saber que el enlace abre un
 * chat externo. Conserva el texto visible al inicio (WCAG 2.5.3, Label in Name).
 */
export const whatsappAccessibleName = (text: string): string => {
  const visible = text.trim();

  if (!visible) return WHATSAPP_DEFAULT_TEXT;

  return /whatsapp/i.test(visible) ? visible : `${visible} por WhatsApp`;
};
