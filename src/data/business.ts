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
} as const;
