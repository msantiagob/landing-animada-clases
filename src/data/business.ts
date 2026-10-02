/**
 * Single source of truth for the business data (NAP) used by the
 * structured data, the contact surfaces and the analytics.
 * Only verified data goes here: never invent an address, email or phone.
 */
export const BUSINESS = {
  name: 'Sonmyd',
  url: 'https://sonmyd.co',
  /** Shown to people */
  telephone: '+57 310 604 1144',
  /** wa.me format: country code + number, digits only */
  whatsappNumber: '573106041144',
  address: {
    locality: 'Medellín',
    region: 'Antioquia',
    country: 'CO',
  },
  /** Center of Medellín */
  geo: {
    latitude: 6.2442,
    longitude: -75.5812,
  },
  /** Municipalities served in person; online classes and services cover all of Colombia */
  areaServed: ['Medellín', 'Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella', 'Rionegro'],
  gtmId: 'GTM-KNZPFWXB',
  /**
   * Zona horaria del negocio: la de Colombia. Las citas se agendan SIEMPRE en esta hora, esté
   * donde esté el servidor (Netlify corre en UTC) o quien reserva.
   */
  timezone: 'America/Bogota',
  /**
   * Desfase de `timezone` respecto de UTC, en minutos. Es fijo porque Colombia usa UTC-5 todo el
   * año, sin horario de verano; tests/business-time.test.ts comprueba que `Intl` siga diciendo lo mismo.
   */
  utcOffsetMinutes: -300,
} as const;

/** Atajo de `BUSINESS.timezone`: el identificador IANA que entiende `Intl`. */
export const BUSINESS_TIMEZONE = BUSINESS.timezone;
