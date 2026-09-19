import { getPermalink } from './utils/permalinks';

/**
 * El enlazado interno es una señal directa de SEO: las páginas que apuntamos
 * desde el header y el footer son las que Google entiende como prioritarias.
 * Por eso los cuatro servicios objetivo están en el primer nivel del menú.
 */
export const headerData = {
  links: [
    {
      text: 'Servicios de IA',
      links: [
        {
          text: 'Asistente de WhatsApp con IA',
          href: getPermalink('/asistente-de-whatsapp'),
        },
        {
          text: 'Llamadas de marketing con IA',
          href: getPermalink('/llamadas-de-marketing'),
        },
        {
          text: 'Gestor de llamadas',
          href: getPermalink('/gestor-de-llamadas'),
        },
        {
          text: 'Todos los servicios',
          href: getPermalink('/servicios'),
        },
      ],
    },
    {
      text: 'Clases de IA',
      links: [
        {
          text: 'Clases particulares de IA',
          href: getPermalink('/clases-de-ia'),
        },
        {
          text: 'Capacitaciones para empresas',
          href: getPermalink('/capacitaciones'),
        },
      ],
    },
    {
      text: 'Empresa',
      links: [
        {
          text: 'Acerca de nosotros',
          href: getPermalink('/about'),
        },
      ],
    },
    {
      text: 'Contacto',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Consulta gratuita', href: getPermalink('/booking'), target: '_self' }],
};

export const footerData = {
  links: [
    {
      title: 'Servicios de IA',
      links: [
        { text: 'Asistente de WhatsApp con IA', href: getPermalink('/asistente-de-whatsapp') },
        { text: 'Llamadas de marketing con IA', href: getPermalink('/llamadas-de-marketing') },
        { text: 'Gestor de llamadas', href: getPermalink('/gestor-de-llamadas') },
        { text: 'Automatización de procesos', href: getPermalink('/servicios') },
      ],
    },
    {
      title: 'Formación',
      links: [
        { text: 'Clases de IA', href: getPermalink('/clases-de-ia') },
        { text: 'Profesor de IA particular', href: getPermalink('/clases-de-ia') },
        { text: 'Capacitaciones para empresas', href: getPermalink('/capacitaciones') },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { text: 'Acerca de nosotros', href: getPermalink('/about') },
        { text: 'Contacto', href: getPermalink('/contact') },
        { text: 'Agendar una reunión', href: getPermalink('/booking') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Términos', href: getPermalink('/terms') },
    { text: 'Política de privacidad', href: getPermalink('/privacy') },
  ],
  // Sin redes propias todavía; el RSS se quitó porque el blog está desactivado y devuelve 404.
  socialLinks: [],
  description:
    'Formación y automatización con inteligencia artificial para empresas: clases de IA, asistentes de WhatsApp y agentes de voz para llamadas.',
  footNote: `© ${new Date().getFullYear()} Sonmyd. Todos los derechos reservados.`,
};
