/**
 * Central registry of every SEO landing: the single source of truth.
 * Navigation, hubs, footer, llms.txt, lead interests and tests derive from here.
 *
 * Invariant: slug === src/pages/<slug>.astro === lead interest value.
 * Search intent: `curso` pages target "learn it" queries, `servicio` pages target
 * "hire it" queries. Each page links to its counterpart (`pair`) so both
 * intents stay separated without cannibalizing each other.
 */

export type LandingKind = 'curso' | 'servicio';

export type SiloId = 'formacion' | 'desarrollo' | 'ia-automatizacion' | 'cloud-seguridad' | 'marketing';

export type HubSlug = 'clases-de-programacion' | 'servicios' | 'marketing-digital';

export interface Landing {
  slug: string;
  kind: LandingKind;
  silo: SiloId;
  /** Short name for nav, cards, breadcrumbs and the lead form select */
  name: string;
  /** <title> with ignoreTitleTemplate: 30–60 characters, contains `keyword` */
  title: string;
  /** Meta description: 120–158 characters */
  description: string;
  /** Primary keyword: must appear in the title and the H1 */
  keyword: string;
  /** Secondary keywords to work naturally into H2s, copy and FAQs */
  secondary: string[];
  /** Card blurb for hubs, home and related links (≤ 110 characters) */
  summary: string;
  /** Learn ↔ hire counterpart: a landing of the other kind */
  pair: string;
  /** Sibling landings to cross-link */
  related: string[];
  /** Blog post ids (file name in src/data/post without extension) */
  posts: string[];
  /** Key in src/data/seo-images */
  image: string;
  /** Prefilled WhatsApp message */
  whatsapp: string;
}

export interface Hub {
  slug: HubSlug;
  name: string;
  title: string;
  description: string;
  keyword: string;
  silos: SiloId[];
  image: string;
}

export const SILOS: Record<SiloId, { name: string; hub: HubSlug }> = {
  formacion: { name: 'Cursos', hub: 'clases-de-programacion' },
  desarrollo: { name: 'Desarrollo', hub: 'servicios' },
  'ia-automatizacion': { name: 'IA y automatización', hub: 'servicios' },
  'cloud-seguridad': { name: 'Cloud y seguridad', hub: 'servicios' },
  marketing: { name: 'Marketing', hub: 'marketing-digital' },
};

export const HUBS: Hub[] = [
  {
    slug: 'clases-de-programacion',
    name: 'Clases de programación',
    title: 'Clases de programación en Medellín: cursos 1 a 1 | Sonmyd',
    description:
      'Clases de programación en Medellín u online: inteligencia artificial, Python, JavaScript, desarrollo web, apps, AWS, Linux, n8n y marketing digital.',
    keyword: 'clases de programación',
    silos: ['formacion'],
    image: 'clases-de-programacion',
  },
  {
    slug: 'servicios',
    name: 'Servicios',
    title: 'Servicios de software, IA y marketing en Medellín | Sonmyd',
    description:
      'Servicios de tecnología en Medellín: desarrollo de software, apps y páginas web, bots y agentes de IA, automatización con n8n, AWS y marketing digital.',
    keyword: 'servicios de software',
    silos: ['desarrollo', 'ia-automatizacion', 'cloud-seguridad', 'marketing'],
    image: 'servicios',
  },
  {
    slug: 'marketing-digital',
    name: 'Marketing digital',
    title: 'Agencia de marketing digital en Medellín | Sonmyd',
    description:
      'Agencia de marketing digital en Medellín: publicidad en Meta Ads, Google Shopping, posicionamiento SEO y llamadas con IA para conseguir clientes.',
    keyword: 'agencia de marketing digital',
    silos: ['marketing'],
    image: 'marketing-digital',
  },
];

export const LANDINGS: Landing[] = [
  // ── Formación: "learn it" intent ────────────────────────────────────────────
  {
    slug: 'clases-de-ia',
    kind: 'curso',
    silo: 'formacion',
    name: 'Clases de IA',
    title: 'Clases de inteligencia artificial (IA) en Medellín | Sonmyd',
    description:
      'Aprende inteligencia artificial con un profesor 1 a 1 en Medellín u online: ChatGPT, prompts, automatización y Python para IA, con proyectos reales.',
    keyword: 'clases de inteligencia artificial',
    secondary: ['clases de IA', 'curso de inteligencia artificial', 'profesor de IA', 'curso de ChatGPT'],
    summary: 'Aprende IA desde cero con un profesor: prompts, herramientas y automatización.',
    pair: 'agentes-de-ia',
    related: ['clases-de-python', 'curso-de-n8n', 'capacitaciones'],
    posts: ['aprender-inteligencia-artificial-desde-cero', 'que-es-un-agente-de-ia'],
    image: 'clases-de-ia',
    whatsapp: 'Hola, quiero información sobre las clases de inteligencia artificial.',
  },
  {
    slug: 'clases-de-python',
    kind: 'curso',
    silo: 'formacion',
    name: 'Clases de Python',
    title: 'Clases y curso de Python en Medellín desde cero | Sonmyd',
    description:
      'Curso de Python desde cero con clases 1 a 1 en Medellín u online: automatiza tareas, analiza datos y crea proyectos con IA. Agenda tu primera clase.',
    keyword: 'curso de Python',
    secondary: ['clases de Python', 'aprender Python desde cero', 'profesor de Python', 'Python para IA'],
    summary: 'Python desde cero: automatiza tareas, analiza datos y crea proyectos con IA.',
    pair: 'desarrollo-de-software',
    related: ['clases-de-ia', 'clases-de-javascript', 'curso-de-n8n'],
    posts: ['python-para-automatizar-tareas', 'aprender-inteligencia-artificial-desde-cero'],
    image: 'clases-de-python',
    whatsapp: 'Hola, quiero información sobre las clases de Python.',
  },
  {
    slug: 'clases-de-javascript',
    kind: 'curso',
    silo: 'formacion',
    name: 'Clases de JavaScript',
    title: 'Curso de JavaScript en Medellín: clases 1 a 1 | Sonmyd',
    description:
      'Curso de JavaScript desde cero hasta crear aplicaciones reales: DOM, TypeScript, Node.js y React. Clases personalizadas en Medellín u online.',
    keyword: 'curso de JavaScript',
    secondary: ['clases de JavaScript', 'aprender JavaScript', 'curso de TypeScript', 'curso de Node.js'],
    summary: 'De cero a crear aplicaciones con JavaScript, TypeScript, Node.js y React.',
    pair: 'desarrollo-web',
    related: ['curso-de-desarrollo-web', 'clases-de-python', 'curso-de-desarrollo-de-apps'],
    posts: ['como-aprender-javascript-desde-cero'],
    image: 'clases-de-javascript',
    whatsapp: 'Hola, quiero información sobre el curso de JavaScript.',
  },
  {
    slug: 'curso-de-desarrollo-web',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de desarrollo web',
    title: 'Curso de desarrollo web en Medellín: crea páginas web',
    description:
      'Curso de desarrollo web práctico: aprende HTML, CSS, JavaScript, React y Astro, y publica sitios rápidos y optimizados para SEO. En Medellín u online.',
    keyword: 'curso de desarrollo web',
    secondary: ['aprender a crear páginas web', 'curso de programación web', 'curso de HTML y CSS', 'curso de React'],
    summary: 'Aprende a crear y publicar páginas web con HTML, CSS, JavaScript y React.',
    pair: 'desarrollo-web',
    related: ['clases-de-javascript', 'curso-de-desarrollo-de-apps', 'curso-de-marketing-digital'],
    posts: ['cuanto-cuesta-una-pagina-web-en-colombia', 'como-aprender-javascript-desde-cero'],
    image: 'curso-de-desarrollo-web',
    whatsapp: 'Hola, quiero información sobre el curso de desarrollo web.',
  },
  {
    slug: 'curso-de-desarrollo-de-apps',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de desarrollo de apps',
    title: 'Curso de desarrollo de apps móviles en Medellín | Sonmyd',
    description:
      'Curso de desarrollo de apps para Android e iOS con React Native, Flutter o nativo (Kotlin y Swift), hasta publicarlas en las tiendas. Medellín u online.',
    keyword: 'curso de desarrollo de apps',
    secondary: ['curso de aplicaciones móviles', 'curso de Flutter', 'curso de React Native', 'aprender a crear apps'],
    summary: 'Crea apps Android e iOS con React Native, Flutter, Kotlin o Swift y publícalas.',
    pair: 'desarrollo-de-aplicaciones-moviles',
    related: ['clases-de-javascript', 'curso-de-desarrollo-web', 'curso-de-aws'],
    posts: ['app-nativa-vs-hibrida', 'cuanto-cuesta-una-app-en-colombia'],
    image: 'curso-de-desarrollo-de-apps',
    whatsapp: 'Hola, quiero información sobre el curso de desarrollo de apps móviles.',
  },
  {
    slug: 'curso-de-aws',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de AWS',
    title: 'Curso de AWS en Medellín: certifícate en la nube | Sonmyd',
    description:
      'Curso de AWS práctico: EC2, S3, IAM, VPC, Lambda y costos. Prepárate para AWS Cloud Practitioner y Solutions Architect, en Medellín u online.',
    keyword: 'curso de AWS',
    secondary: [
      'clases de AWS',
      'certificación AWS Cloud Practitioner',
      'curso de cloud computing',
      'AWS Solutions Architect',
    ],
    summary: 'Aprende AWS con práctica real y prepara tu certificación Cloud Practitioner.',
    pair: 'consultoria-aws',
    related: ['curso-de-linux', 'curso-de-n8n', 'clases-de-python'],
    posts: ['certificacion-aws-cloud-practitioner'],
    image: 'curso-de-aws',
    whatsapp: 'Hola, quiero información sobre el curso de AWS.',
  },
  {
    slug: 'curso-de-linux',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de Linux',
    title: 'Curso de Linux y servidores en Medellín | Sonmyd',
    description:
      'Curso de Linux desde la terminal: comandos, Bash, permisos, SSH, Nginx, Docker y administración de servidores. Clases prácticas en Medellín u online.',
    keyword: 'curso de Linux',
    secondary: ['clases de Linux', 'administración de servidores Linux', 'comandos de Linux', 'curso de Bash'],
    summary: 'Domina la terminal, Bash y la administración de servidores Linux.',
    pair: 'servidores-y-vps',
    related: ['curso-de-aws', 'clases-de-python', 'curso-de-n8n'],
    posts: ['comandos-basicos-de-linux', 'que-es-un-vps-y-cuando-lo-necesitas'],
    image: 'curso-de-linux',
    whatsapp: 'Hola, quiero información sobre el curso de Linux.',
  },
  {
    slug: 'curso-de-n8n',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de n8n',
    title: 'Curso de n8n en español: automatiza con IA | Sonmyd',
    description:
      'Curso de n8n en español: crea flujos con APIs, webhooks, WhatsApp, Google Sheets y agentes de IA, e instálalo en tu servidor. Clases en Medellín u online.',
    keyword: 'curso de n8n',
    secondary: ['aprender n8n', 'curso de automatización', 'n8n en español', 'curso de agentes de IA'],
    summary: 'Automatiza procesos con n8n: APIs, webhooks, WhatsApp y agentes de IA.',
    pair: 'automatizacion-con-n8n',
    related: ['clases-de-ia', 'curso-de-aws', 'clases-de-python'],
    posts: ['que-es-n8n', 'n8n-vs-zapier-vs-make'],
    image: 'curso-de-n8n',
    whatsapp: 'Hola, quiero información sobre el curso de n8n.',
  },
  {
    slug: 'curso-de-marketing-digital',
    kind: 'curso',
    silo: 'formacion',
    name: 'Curso de marketing digital',
    title: 'Curso de marketing digital en Medellín: Meta Ads y SEO',
    description:
      'Curso de marketing digital práctico: campañas en Meta Ads, Google Ads y Google Shopping, SEO y analítica para conseguir clientes. En Medellín u online.',
    keyword: 'curso de marketing digital',
    secondary: ['curso de Meta Ads', 'curso de Google Ads', 'curso de SEO', 'curso de Facebook Ads'],
    summary: 'Aprende Meta Ads, Google Shopping y SEO para conseguir clientes en internet.',
    pair: 'publicidad-en-meta-ads',
    related: ['curso-de-desarrollo-web', 'curso-de-n8n', 'clases-de-ia'],
    posts: ['cuanto-invertir-en-meta-ads', 'seo-local-medellin'],
    image: 'curso-de-marketing-digital',
    whatsapp: 'Hola, quiero información sobre el curso de marketing digital.',
  },
  {
    slug: 'capacitaciones',
    kind: 'curso',
    silo: 'formacion',
    name: 'Capacitaciones para empresas',
    title: 'Capacitación en IA para empresas en Medellín | Sonmyd',
    description:
      'Capacitación en IA y tecnología para empresas: talleres prácticos para que tu equipo use ChatGPT, automatice tareas y trabaje mejor. En Medellín y en línea.',
    keyword: 'capacitación en IA para empresas',
    secondary: [
      'capacitación en inteligencia artificial',
      'talleres de IA para empresas',
      'formación empresarial en tecnología',
    ],
    summary: 'Talleres de IA y tecnología a la medida de tu equipo.',
    pair: 'agentes-de-ia',
    related: ['clases-de-ia', 'curso-de-n8n', 'curso-de-marketing-digital'],
    posts: ['aprender-inteligencia-artificial-desde-cero'],
    image: 'capacitaciones',
    whatsapp: 'Hola, quiero información sobre capacitaciones de IA para mi empresa.',
  },

  // ── Desarrollo: "hire it" intent ────────────────────────────────────────────
  {
    slug: 'desarrollo-de-software',
    kind: 'servicio',
    silo: 'desarrollo',
    name: 'Desarrollo de software',
    title: 'Desarrollo de software a medida en Medellín | Sonmyd',
    description:
      'Desarrollo de software a medida en Medellín: sistemas, APIs, integraciones y plataformas web con IA, hechos para tu negocio y con soporte cercano.',
    keyword: 'desarrollo de software',
    secondary: [
      'empresa de desarrollo de software en Medellín',
      'software a medida',
      'desarrollo de APIs',
      'fábrica de software',
    ],
    summary: 'Software a medida: sistemas, APIs e integraciones para tu negocio.',
    pair: 'clases-de-python',
    related: ['desarrollo-web', 'desarrollo-de-aplicaciones-moviles', 'agentes-de-ia'],
    posts: ['zapier-make-o-codigo-propio', 'cuanto-cuesta-una-app-en-colombia'],
    image: 'desarrollo-de-software',
    whatsapp: 'Hola, quiero cotizar un desarrollo de software a medida.',
  },
  {
    slug: 'desarrollo-web',
    kind: 'servicio',
    silo: 'desarrollo',
    name: 'Desarrollo web',
    title: 'Diseño y desarrollo de páginas web en Medellín | Sonmyd',
    description:
      'Diseño y desarrollo de páginas web en Medellín: sitios corporativos, landing pages y tiendas online rápidas, optimizadas para SEO y listas para vender.',
    keyword: 'desarrollo de páginas web',
    secondary: ['diseño de páginas web en Medellín', 'desarrollo web en Medellín', 'tiendas online', 'landing pages'],
    summary: 'Sitios web, landing pages y tiendas online rápidas y optimizadas para SEO.',
    pair: 'curso-de-desarrollo-web',
    related: ['posicionamiento-seo', 'desarrollo-de-software', 'google-shopping'],
    posts: ['cuanto-cuesta-una-pagina-web-en-colombia'],
    image: 'desarrollo-web',
    whatsapp: 'Hola, quiero cotizar una página web.',
  },
  {
    slug: 'desarrollo-de-aplicaciones-moviles',
    kind: 'servicio',
    silo: 'desarrollo',
    name: 'Desarrollo de apps móviles',
    title: 'Desarrollo de aplicaciones móviles en Medellín | Sonmyd',
    description:
      'Desarrollo de aplicaciones móviles nativas e híbridas para Android e iOS: diseño, backend y publicación en App Store y Google Play, desde Medellín.',
    keyword: 'desarrollo de aplicaciones móviles',
    secondary: [
      'empresa de desarrollo de apps en Medellín',
      'crear una app',
      'apps nativas iOS y Android',
      'desarrollo de apps con Flutter',
    ],
    summary: 'Apps nativas e híbridas para Android e iOS, del diseño a las tiendas.',
    pair: 'curso-de-desarrollo-de-apps',
    related: ['desarrollo-de-software', 'desarrollo-web', 'consultoria-aws'],
    posts: ['cuanto-cuesta-una-app-en-colombia', 'app-nativa-vs-hibrida'],
    image: 'desarrollo-de-aplicaciones-moviles',
    whatsapp: 'Hola, quiero cotizar el desarrollo de una app móvil.',
  },
  {
    slug: 'desarrollo-de-bots',
    kind: 'servicio',
    silo: 'desarrollo',
    name: 'Desarrollo de bots',
    title: 'Desarrollo de bots y chatbots con IA en Medellín | Sonmyd',
    description:
      'Desarrollo de bots y chatbots con IA para WhatsApp, Telegram y tu web: responden, venden y agendan 24 horas, conectados a tu CRM y tus sistemas.',
    keyword: 'desarrollo de bots',
    secondary: [
      'chatbot con IA para empresas',
      'bot de WhatsApp',
      'bot de Telegram',
      'desarrollo de chatbots en Colombia',
    ],
    summary: 'Bots para WhatsApp, Telegram y web que atienden, venden y agendan con IA.',
    pair: 'curso-de-n8n',
    related: ['asistente-de-whatsapp', 'agentes-de-ia', 'whatsapp-business-api'],
    posts: ['como-crear-un-chatbot-de-whatsapp', 'que-es-whatsapp-business-api'],
    image: 'desarrollo-de-bots',
    whatsapp: 'Hola, quiero cotizar el desarrollo de un bot.',
  },

  // ── IA y automatización ─────────────────────────────────────────────────────
  {
    slug: 'agentes-de-ia',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'Agentes de IA',
    title: 'Agentes de IA para empresas en Colombia | Sonmyd',
    description:
      'Agentes de IA para empresas: automatizan la gestión de pólizas, documentos, correos y atención al cliente, conectados a tus sistemas. Equipo en Medellín.',
    keyword: 'agentes de IA para empresas',
    secondary: [
      'agentes de inteligencia artificial',
      'automatización con agentes de IA',
      'automatización de pólizas con IA',
      'IA para empresas en Colombia',
    ],
    summary: 'Agentes de IA que leen documentos, gestionan procesos y operan tus sistemas.',
    pair: 'clases-de-ia',
    related: ['automatizaciones', 'automatizacion-con-n8n', 'desarrollo-de-bots'],
    posts: ['que-es-un-agente-de-ia', 'automatizar-google-workspace'],
    image: 'agentes-de-ia',
    whatsapp: 'Hola, quiero implementar agentes de IA en mi empresa.',
  },
  {
    slug: 'automatizaciones',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'Automatización de procesos',
    title: 'Automatización de procesos con IA en Medellín | Sonmyd',
    description:
      'Automatización de procesos con IA: conectamos WhatsApp, Google Workspace, tu CRM y tus hojas de cálculo para eliminar tareas repetitivas. Desde Medellín.',
    keyword: 'automatización de procesos',
    secondary: [
      'automatización de procesos empresariales',
      'integraciones de WhatsApp, Google y CRM',
      'automatizar tareas repetitivas',
    ],
    summary: 'Integraciones entre WhatsApp, Google, tu CRM y tus sistemas, sin tareas manuales.',
    pair: 'curso-de-n8n',
    related: ['automatizacion-con-n8n', 'agentes-de-ia', 'asistente-de-whatsapp'],
    posts: ['conectar-whatsapp-con-google-sheets', 'automatizar-google-workspace', 'zapier-make-o-codigo-propio'],
    image: 'automatizaciones',
    whatsapp: 'Hola, quiero automatizar procesos de mi empresa.',
  },
  {
    slug: 'automatizacion-con-n8n',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'Automatización con n8n',
    title: 'Automatización con n8n para empresas en Colombia | Sonmyd',
    description:
      'Automatización con n8n: diseñamos, implementamos y mantenemos tus flujos (CRM, WhatsApp, correo, IA) en tu propio servidor. Consultores n8n en Medellín.',
    keyword: 'automatización con n8n',
    secondary: ['consultor n8n', 'agencia n8n', 'implementación de n8n', 'n8n self-hosted'],
    summary: 'Implementamos y mantenemos flujos n8n con IA en tu propio servidor.',
    pair: 'curso-de-n8n',
    related: ['automatizaciones', 'agentes-de-ia', 'servidores-y-vps'],
    posts: ['que-es-n8n', 'n8n-vs-zapier-vs-make'],
    image: 'automatizacion-con-n8n',
    whatsapp: 'Hola, quiero implementar automatizaciones con n8n.',
  },
  {
    slug: 'asistente-de-whatsapp',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'Asistente de WhatsApp con IA',
    title: 'Asistente de WhatsApp con IA para empresas | Sonmyd',
    description:
      'Asistente de WhatsApp con IA que responde, califica clientes y agenda citas en Google Calendar las 24 horas, y pasa a un humano cuando hace falta.',
    keyword: 'asistente de WhatsApp',
    secondary: ['chatbot de WhatsApp con IA', 'bot de WhatsApp para empresas', 'atención automática por WhatsApp'],
    summary: 'Atiende, califica y agenda por WhatsApp las 24 horas con IA.',
    pair: 'clases-de-ia',
    related: ['whatsapp-business-api', 'desarrollo-de-bots', 'gestor-de-llamadas'],
    posts: ['que-es-whatsapp-business-api', 'como-crear-un-chatbot-de-whatsapp'],
    image: 'asistente-de-whatsapp',
    whatsapp: 'Hola, quiero un asistente de WhatsApp con IA para mi negocio.',
  },
  {
    slug: 'whatsapp-business-api',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'WhatsApp Business API',
    title: 'WhatsApp Business API en Colombia: habilitación | Sonmyd',
    description:
      'Habilitamos tu WhatsApp Business API con Meta: verificación, número oficial, plantillas e integración con tu CRM y chatbots. Implementación desde Medellín.',
    keyword: 'WhatsApp Business API',
    secondary: [
      'API de WhatsApp',
      'WhatsApp Cloud API',
      'verificación de WhatsApp Business',
      'proveedor de WhatsApp API en Colombia',
    ],
    summary: 'Habilitación oficial de la API de WhatsApp con Meta e integración con tu CRM.',
    pair: 'curso-de-n8n',
    related: ['asistente-de-whatsapp', 'desarrollo-de-bots', 'automatizaciones'],
    posts: [
      'que-es-whatsapp-business-api',
      'cuanto-cuesta-whatsapp-business-api',
      'conectar-whatsapp-con-google-sheets',
    ],
    image: 'whatsapp-business-api',
    whatsapp: 'Hola, quiero habilitar WhatsApp Business API.',
  },
  {
    slug: 'gestor-de-llamadas',
    kind: 'servicio',
    silo: 'ia-automatizacion',
    name: 'Gestor de llamadas con IA',
    title: 'Gestor de llamadas con IA: recepcionista virtual | Sonmyd',
    description:
      'Gestor de llamadas con IA: una recepcionista virtual que contesta, filtra, agenda citas y transfiere llamadas de tu empresa. Implementación en Medellín.',
    keyword: 'gestor de llamadas',
    secondary: ['recepcionista virtual con IA', 'contestador inteligente', 'atención telefónica automática'],
    summary: 'Recepcionista virtual con IA que contesta, agenda y transfiere llamadas.',
    pair: 'clases-de-ia',
    related: ['llamadas-de-marketing', 'asistente-de-whatsapp', 'agentes-de-ia'],
    posts: [],
    image: 'gestor-de-llamadas',
    whatsapp: 'Hola, quiero información sobre el gestor de llamadas con IA.',
  },

  // ── Cloud y seguridad ───────────────────────────────────────────────────────
  {
    slug: 'consultoria-aws',
    kind: 'servicio',
    silo: 'cloud-seguridad',
    name: 'Consultoría AWS',
    title: 'Consultoría AWS en Medellín: migración y costos | Sonmyd',
    description:
      'Consultoría AWS: migramos tus aplicaciones a la nube, diseñamos arquitecturas seguras y escalables y reducimos tu factura de AWS. Desde Medellín.',
    keyword: 'consultoría AWS',
    secondary: [
      'servicios AWS en Colombia',
      'migración a AWS',
      'arquitectura en la nube',
      'optimización de costos en AWS',
      'DevOps en Medellín',
    ],
    summary: 'Migración, arquitectura y optimización de costos en Amazon Web Services.',
    pair: 'curso-de-aws',
    related: ['servidores-y-vps', 'ciberseguridad', 'desarrollo-de-software'],
    posts: ['certificacion-aws-cloud-practitioner', 'que-es-un-vps-y-cuando-lo-necesitas'],
    image: 'consultoria-aws',
    whatsapp: 'Hola, quiero una consultoría de AWS.',
  },
  {
    slug: 'servidores-y-vps',
    kind: 'servicio',
    silo: 'cloud-seguridad',
    name: 'Servidores Linux y VPS',
    title: 'Administración de servidores Linux y VPS en Medellín',
    description:
      'Administración de servidores Linux y VPS: instalación, seguridad, copias de respaldo, monitoreo y despliegues. Soporte desde Medellín.',
    keyword: 'administración de servidores Linux',
    secondary: ['servidores VPS en Colombia', 'soporte de servidores Linux', 'hosting administrado', 'DevOps'],
    summary: 'Instalación, seguridad, respaldos y monitoreo de servidores Linux y VPS.',
    pair: 'curso-de-linux',
    related: ['consultoria-aws', 'ciberseguridad', 'automatizacion-con-n8n'],
    posts: ['que-es-un-vps-y-cuando-lo-necesitas', 'comandos-basicos-de-linux'],
    image: 'servidores-y-vps',
    whatsapp: 'Hola, necesito ayuda con la administración de un servidor.',
  },
  {
    slug: 'ciberseguridad',
    kind: 'servicio',
    silo: 'cloud-seguridad',
    name: 'Ciberseguridad para pymes',
    title: 'Ciberseguridad para pymes en Medellín | Sonmyd',
    description:
      'Ciberseguridad para pymes: auditoría de seguridad, protección de servidores y correos, copias de respaldo y capacitación para tu equipo, desde Medellín.',
    keyword: 'ciberseguridad para pymes',
    secondary: ['auditoría de seguridad informática', 'seguridad informática para empresas', 'protección de datos'],
    summary: 'Auditoría, protección y respaldos para que tu empresa no pierda información.',
    pair: 'curso-de-linux',
    related: ['servidores-y-vps', 'consultoria-aws', 'desarrollo-de-software'],
    posts: ['seguridad-informatica-para-pymes'],
    image: 'ciberseguridad',
    whatsapp: 'Hola, quiero una auditoría de ciberseguridad.',
  },

  // ── Marketing ───────────────────────────────────────────────────────────────
  {
    slug: 'publicidad-en-meta-ads',
    kind: 'servicio',
    silo: 'marketing',
    name: 'Publicidad en Meta Ads',
    title: 'Publicidad en Meta Ads en Medellín: Facebook e Instagram',
    description:
      'Publicidad en Meta Ads para Facebook e Instagram: estrategia, creativos, píxel y API de conversiones para generar ventas y leads. Agencia en Medellín.',
    keyword: 'publicidad en Meta Ads',
    secondary: [
      'agencia de Meta Ads en Medellín',
      'publicidad en Facebook',
      'publicidad en Instagram',
      'pauta en redes sociales',
    ],
    summary: 'Campañas en Facebook e Instagram enfocadas en ventas y leads.',
    pair: 'curso-de-marketing-digital',
    related: ['google-shopping', 'posicionamiento-seo', 'llamadas-de-marketing'],
    posts: ['cuanto-invertir-en-meta-ads'],
    image: 'publicidad-en-meta-ads',
    whatsapp: 'Hola, quiero información sobre campañas en Meta Ads.',
  },
  {
    slug: 'google-shopping',
    kind: 'servicio',
    silo: 'marketing',
    name: 'Google Shopping',
    title: 'Google Shopping en Colombia: campañas y Merchant Center',
    description:
      'Google Shopping para tiendas online en Colombia: configuramos Merchant Center, optimizamos tu feed y gestionamos campañas Shopping y Performance Max.',
    keyword: 'Google Shopping',
    secondary: ['Google Merchant Center', 'campañas de Shopping', 'Performance Max', 'anuncios de productos en Google'],
    summary: 'Merchant Center, feed de productos y campañas Shopping que venden.',
    pair: 'curso-de-marketing-digital',
    related: ['publicidad-en-meta-ads', 'posicionamiento-seo', 'desarrollo-web'],
    posts: ['como-vender-en-google-shopping-colombia'],
    image: 'google-shopping',
    whatsapp: 'Hola, quiero vender con Google Shopping.',
  },
  {
    slug: 'posicionamiento-seo',
    kind: 'servicio',
    silo: 'marketing',
    name: 'Posicionamiento SEO',
    title: 'Posicionamiento SEO en Medellín: agencia y consultoría',
    description:
      'Posicionamiento SEO en Medellín: SEO técnico, contenido, SEO local en Google Maps y optimización para buscadores con IA, para que te encuentren clientes.',
    keyword: 'posicionamiento SEO',
    secondary: [
      'agencia SEO en Medellín',
      'consultor SEO',
      'SEO local',
      'posicionamiento web en Medellín',
      'SEO para buscadores con IA',
    ],
    summary: 'SEO técnico, contenido y SEO local para aparecer en Google y en buscadores con IA.',
    pair: 'curso-de-marketing-digital',
    related: ['desarrollo-web', 'google-shopping', 'publicidad-en-meta-ads'],
    posts: ['seo-local-medellin'],
    image: 'posicionamiento-seo',
    whatsapp: 'Hola, quiero mejorar el posicionamiento SEO de mi sitio.',
  },
  {
    slug: 'llamadas-de-marketing',
    kind: 'servicio',
    silo: 'marketing',
    name: 'Llamadas de marketing con IA',
    title: 'Llamadas de marketing con IA: campañas de voz | Sonmyd',
    description:
      'Llamadas de marketing con IA: campañas de voz que contactan, califican y agendan a tus prospectos automáticamente, con reportes de cada llamada.',
    keyword: 'llamadas de marketing',
    secondary: ['campañas de llamadas automatizadas', 'telemarketing con IA', 'llamadas automáticas a clientes'],
    summary: 'Campañas de voz con IA que contactan y califican prospectos.',
    pair: 'curso-de-marketing-digital',
    related: ['gestor-de-llamadas', 'publicidad-en-meta-ads', 'asistente-de-whatsapp'],
    posts: [],
    image: 'llamadas-de-marketing',
    whatsapp: 'Hola, quiero información sobre las llamadas de marketing con IA.',
  },
];
