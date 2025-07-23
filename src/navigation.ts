import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Soluciones',
      links: [
        {
          text: 'Inteligencia Artificial',
          href: getPermalink('/servicios#servicios'),
        },
        {
          text: 'Desarrollo Web',
          href: getPermalink('/servicios#servicios'),
        },
        {
          text: 'Apps Multiplataforma',
          href: getPermalink('/servicios#servicios'),
        },
        {
          text: 'Automatizaciones',
          href: getPermalink('/servicios#servicios'),
        },
      ],
    },
    {
      text: 'Capacitaciones',
      links: [
        {
          text: 'Cursos de IA',
          href: getPermalink('/capacitaciones'),
        },
        {
          text: 'Desarrollo Web',
          href: getPermalink('/capacitaciones'),
        },
        {
          text: 'Programación',
          href: getPermalink('/capacitaciones'),
        },
        {
          text: 'Certificaciones',
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
        {
          text: 'Nuestro equipo',
          href: getPermalink('/about#equipo'),
        },
        {
          text: 'Casos de éxito',
          href: getPermalink('/casos-exito'),
        },
        {
          text: 'Blog',
          href: getBlogPermalink(),
        },
      ],
    },
    {
      text: 'Blog',
      links: [
        {
          text: 'Lista de Blog',
          href: getBlogPermalink(),
        },
        {
          text: 'Artículo',
          href: getPermalink('get-started-website-with-astro-tailwind-css', 'post'),
        },
        {
          text: 'Artículo (con MDX)',
          href: getPermalink('markdown-elements-demo-post', 'post'),
        },
        {
          text: 'Página de Categoría',
          href: getPermalink('tutorials', 'category'),
        },
        {
          text: 'Página de Etiqueta',
          href: getPermalink('astro', 'tag'),
        },
      ],
    },
    {
      text: 'Contacto',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Consulta Gratuita', href: getPermalink('/contact'), target: '_self' }],
};

export const footerData = {
  links: [
    {
      title: 'Producto',
      links: [
        { text: 'Características', href: '#' },
        { text: 'Seguridad', href: '#' },
        { text: 'Equipo', href: '#' },
        { text: 'Empresa', href: '#' },
        { text: 'Historias de clientes', href: '#' },
        { text: 'Precios', href: '#' },
        { text: 'Recursos', href: '#' },
      ],
    },
    {
      title: 'Plataforma',
      links: [
        { text: 'API de Desarrollador', href: '#' },
        { text: 'Socios', href: '#' },
        { text: 'Atom', href: '#' },
        { text: 'Electron', href: '#' },
        { text: 'AstroWind Desktop', href: '#' },
      ],
    },
    {
      title: 'Soporte',
      links: [
        { text: 'Documentación', href: '#' },
        { text: 'Foro de la Comunidad', href: '#' },
        { text: 'Servicios Profesionales', href: '#' },
        { text: 'Habilidades', href: '#' },
        { text: 'Estado', href: '#' },
      ],
    },
    {
      title: 'Compañía',
      links: [
        { text: 'Acerca de', href: '#' },
        { text: 'Blog', href: '#' },
        { text: 'Carreras', href: '#' },
        { text: 'Prensa', href: '#' },
        { text: 'Inclusión', href: '#' },
        { text: 'Impacto Social', href: '#' },
        { text: 'Tienda', href: '#' },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Términos', href: getPermalink('/terms') },
    { text: 'Política de Privacidad', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: '#' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/onwidget/astrowind' },
  ],
  footNote: `
      <img
          class='w-5 h-5 md:w-6 md:h-6 md:-mt-0.5 bg-cover mr-1.5 rtl:mr-0 rtl:ml-1.5 float-left rtl:float-right rounded-sm'
          src="./src/assets/favicons/favicon-96x96.png"
          alt='sonmyd logo'
          loading='lazy'
        />
      Made by <a class="text-blue-600 underline dark:text-muted" href="https://sonmyd.com/"> Sonmyd</a> · All rights reserved.
  `,
};
