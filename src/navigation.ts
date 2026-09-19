import { getBlogPermalink, getPermalink } from './utils/permalinks';

/**
 * El enlazado interno es una señal directa de SEO: las páginas que apuntamos
 * desde el header y el footer son las que Google entiende como prioritarias.
 *
 * El menú está agrupado por SILO, no por capricho de diseño. Cada grupo es un
 * bloque temático cerrado con su página pilar. Mezclar servicios de silos
 * distintos en un mismo desplegable diluye justamente la señal que buscamos.
 */
export const headerData = {
  links: [
    {
      text: 'IA y WhatsApp',
      links: [
        {
          text: 'Asistente de WhatsApp con IA',
          href: getPermalink('/asistente-de-whatsapp'),
        },
        {
          text: 'WhatsApp Business API',
          href: getPermalink('/whatsapp-business-api'),
        },
        {
          text: 'Llamadas de marketing con IA',
          href: getPermalink('/llamadas-de-marketing'),
        },
        {
          text: 'Gestor de llamadas',
          href: getPermalink('/gestor-de-llamadas'),
        },
      ],
    },
    {
      text: 'Formación',
      links: [
        {
          text: 'Clases de IA',
          href: getPermalink('/clases-de-ia'),
        },
        {
          text: 'Clases de Python',
          href: getPermalink('/clases-de-python'),
        },
        {
          text: 'Capacitaciones para empresas',
          href: getPermalink('/capacitaciones'),
        },
      ],
    },
    {
      text: 'Tecnología',
      links: [
        {
          text: 'Automatizaciones',
          href: getPermalink('/automatizaciones'),
        },
        {
          text: 'Desarrollo de software',
          href: getPermalink('/desarrollo-de-software'),
        },
        {
          text: 'Servidores y VPS',
          href: getPermalink('/servidores-y-vps'),
        },
        {
          text: 'Ciberseguridad',
          href: getPermalink('/ciberseguridad'),
        },
      ],
    },
    {
      text: 'Empresa',
      links: [
        {
          text: 'Todos los servicios',
          href: getPermalink('/servicios'),
        },
        {
          text: 'Blog',
          href: getBlogPermalink(),
        },
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
      title: 'IA y WhatsApp',
      links: [
        { text: 'Asistente de WhatsApp con IA', href: getPermalink('/asistente-de-whatsapp') },
        { text: 'WhatsApp Business API', href: getPermalink('/whatsapp-business-api') },
        { text: 'Llamadas de marketing con IA', href: getPermalink('/llamadas-de-marketing') },
        { text: 'Gestor de llamadas', href: getPermalink('/gestor-de-llamadas') },
      ],
    },
    {
      title: 'Formación',
      links: [
        { text: 'Clases de IA', href: getPermalink('/clases-de-ia') },
        { text: 'Clases de Python', href: getPermalink('/clases-de-python') },
        { text: 'Capacitaciones para empresas', href: getPermalink('/capacitaciones') },
      ],
    },
    {
      title: 'Tecnología',
      links: [
        { text: 'Automatizaciones e integraciones', href: getPermalink('/automatizaciones') },
        { text: 'Desarrollo de software', href: getPermalink('/desarrollo-de-software') },
        { text: 'Servidores y VPS', href: getPermalink('/servidores-y-vps') },
        { text: 'Ciberseguridad', href: getPermalink('/ciberseguridad') },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { text: 'Todos los servicios', href: getPermalink('/servicios') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'Acerca de nosotros', href: getPermalink('/about') },
        { text: 'Agendar una reunión', href: getPermalink('/booking') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Términos', href: getPermalink('/terms') },
    { text: 'Política de privacidad', href: getPermalink('/privacy') },
  ],
  // Sin redes propias todavía. Se agregan cuando existan cuentas reales:
  // un enlace a un perfil vacío daña más la confianza que la ausencia.
  socialLinks: [],
  description:
    'Formación y automatización con inteligencia artificial para empresas: clases de IA y Python, asistentes de WhatsApp, desarrollo a medida, servidores y seguridad.',
};
