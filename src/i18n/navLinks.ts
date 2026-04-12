import type { Lang } from './utils';

export function getNavLinks(lang: Lang) {
  if (lang === 'en') {
    return {
      main: [
        {
          title: 'AI Mentorship',
          groups: [
            {
              label: 'AI Mentorship',
              items: [
                { title: 'Free Diagnosis', url: '/en/services/diagnosis', icon: '🎁', desc: 'Free 30-min session to assess your level' },
                { title: 'Python for AI', url: '/en/services/python-for-ai', icon: '🐍', desc: 'From zero to real AI projects with Python' },
                { title: 'Machine Learning', url: '/en/services/machine-learning', icon: '🤖', desc: 'Algorithms, models and real-world evaluation' },
                { title: 'LLMs & Generative AI', url: '/en/services/llms-generative-ai', icon: '🧠', desc: 'GPT, Claude, Llama, RAG & Prompt Engineering' },
                { title: 'Agent Automation', url: '/en/services/agent-automation', icon: '⚙️', desc: 'Autonomous agents with LangChain and CrewAI' },
              ],
            },
          ],
        },
        {
          title: 'Dev & Consulting',
          groups: [
            {
              label: 'Development & Consulting',
              items: [
                { title: 'Web Applications', url: '/en/services/web-applications', icon: '🌐', desc: 'Modern full-stack web apps with backend & AI' },
                { title: 'Automations', url: '/en/services/automations', icon: '🔄', desc: 'Automated flows that eliminate manual work' },
                { title: 'Cloud Solutions', url: '/en/services/cloud-solutions', icon: '☁️', desc: 'Scalable infrastructure on AWS, GCP or Azure' },
                { title: 'Native Apps', url: '/en/services/native-apps', icon: '📱', desc: 'High-performance mobile and desktop apps' },
              ],
            },
          ],
        },
      ],
      legalLinks: [
        { title: 'Terms & Conditions', url: '/en/terms' },
        { title: 'Privacy Policy', url: '/en/privacy' },
      ],
      ctaLink: { title: "Let's Talk", url: 'https://wa.me/573106041144?text=Hi%2C+I%27m+interested+in+learning+more+about+the+AI+classes.' },
    };
  }

  // Spanish (default)
  return {
    main: [
      {
        title: 'Mentoría en IA',
        groups: [
          {
            label: 'Mentoría en IA',
            items: [
              { title: 'Diagnóstico Gratuito', url: '/servicios/diagnostico', icon: '🎁', desc: 'Sesión de 30 min sin costo para evaluar tu nivel' },
              { title: 'Python para IA', url: '/servicios/python-para-ia', icon: '🐍', desc: 'Desde cero hasta proyectos reales con Python' },
              { title: 'Machine Learning', url: '/servicios/machine-learning', icon: '🤖', desc: 'Algoritmos, modelos y evaluación con datos reales' },
              { title: 'LLMs & IA Generativa', url: '/servicios/llms-ia-generativa', icon: '🧠', desc: 'GPT, Claude, Llama, RAG y Prompt Engineering' },
              { title: 'Automatización con Agentes', url: '/servicios/automatizacion-agentes', icon: '⚙️', desc: 'Agentes autónomos con LangChain y CrewAI' },
            ],
          },
        ],
      },
      {
        title: 'Desarrollo & Consultoría',
        groups: [
          {
            label: 'Desarrollo & Consultoría',
            items: [
              { title: 'Aplicaciones Web', url: '/servicios/aplicaciones-web', icon: '🌐', desc: 'Apps web modernas, full stack con backend e IA' },
              { title: 'Automatizaciones', url: '/servicios/automatizaciones', icon: '🔄', desc: 'Flujos automáticos que eliminan trabajo manual' },
              { title: 'Soluciones Cloud', url: '/servicios/soluciones-cloud', icon: '☁️', desc: 'Infraestructura escalable en AWS, GCP o Azure' },
              { title: 'Aplicaciones Nativas', url: '/servicios/aplicaciones-nativas', icon: '📱', desc: 'Apps móviles y de escritorio de alto rendimiento' },
            ],
          },
        ],
      },
    ],
    legalLinks: [
      { title: 'Términos y condiciones', url: '/terminos' },
      { title: 'Política de privacidad', url: '/privacidad' },
    ],
    ctaLink: { title: 'Hablemos', url: 'https://wa.me/573106041144?text=Hola%2C+quiero+m%C3%A1s+informaci%C3%B3n+sobre+las+clases+de+IA.' },
  };
}
