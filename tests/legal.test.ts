import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSINESS } from '~/data/business';
import { KeyValueLeadStore } from '~/lib/storage/core';
import { MemoryBackend, createMemoryStore } from '~/lib/storage/memory';
import { BOOKING_DURATION_MINUTES } from '~/utils/booking';
import { personSchema } from '~/utils/seo';
import { trackLead, trackWhatsAppClick } from '~/utils/tracking';

import { ROOT, metadataOf, pageSource, read, visibleText } from './source';
import { findVoseo } from './voseo';

/**
 * Páginas legales: /privacidad y /terminos.
 *
 * Son las URL que Google tiene registradas para la verificación de la aplicación
 * OAuth de Sonmyd (junto con el inicio). Tienen que seguir existiendo, indexables,
 * enlazadas desde el inicio, y decir la verdad sobre ESTE sitio.
 *
 * Qué se comprueba y por qué:
 * - Los compromisos de la política y los términos del sitio anterior siguen ahí
 *   (derechos, plazos, "no vendemos ni cedemos", condiciones comerciales...).
 * - Cada dato personal que el sitio guarda (los campos de ContactRecord y AppointmentRecord,
 *   en src/lib/storage/types.ts) está declarado en la política. Si alguien agrega un campo,
 *   este test obliga a decidir si hay que declararlo.
 * - Las frases sobre medición se contrastan con lo que el código realmente envía.
 * - La duración que digan los términos es la del turno de reserva.
 * - El bloque informativo del inicio (marca, Google Calendar, enlaces legales) es
 *   texto visible en el HTML: Google lo lee sin ejecutar JavaScript.
 *
 * Los .astro no se pueden importar desde Vitest, así que se lee el código fuente
 * (tests/source.ts).
 */

const PRIVACY = pageSource('privacidad');
const TERMS = pageSource('terminos');
const privacyText = visibleText(PRIVACY.markup);
const termsText = visibleText(TERMS.markup);

const PAGES = [
  { name: 'privacidad', file: 'src/pages/privacidad.astro', path: '/privacidad', page: PRIVACY },
  { name: 'terminos', file: 'src/pages/terminos.astro', path: '/terminos', page: TERMS },
] as const;

describe.each(PAGES)('/$name: la URL que Google tiene registrada', ({ file, path, page }) => {
  const metadata = metadataOf(page.frontmatter);

  it('existe como página del sitio', () => {
    expect(existsSync(resolve(ROOT, file))).toBe(true);
    expect(file).toBe(`src/pages${path}.astro`);
  });

  it('declara su propia ruta como canonical, absoluta tras la normalización de Metadata.astro', () => {
    expect(page.frontmatter).toContain(`const PATH = '${path}';`);
    expect(metadata.canonical).toBe('PATH');
  });

  it('el título lleva la marca UNA sola vez: ignora la plantilla y no repite al responsable', () => {
    expect(metadata.ignoreTitleTemplate).toBe(true);
    expect(metadata.title.match(/Sonmyd/g)).toHaveLength(1);
    expect(metadata.title.length).toBeLessThanOrEqual(60);
    expect(metadata.title).not.toMatch(/Miguel|Zuluaga|—/);
  });

  it('tiene descripción propia', () => {
    expect(metadata.description.length).toBeGreaterThan(40);
    expect(metadata.description).toContain('Sonmyd');
  });

  // Google verifica que la política sea accesible: un noindex o un redirect rompería la verificación.
  it('es indexable: no declara robots ni noindex', () => {
    expect(page.frontmatter).not.toMatch(/\brobots\b/);
    expect(page.markup).not.toMatch(/noindex/i);
  });

  it('usa el layout público, con su cabecera, su pie y los enlaces legales', () => {
    expect(page.frontmatter).toMatch(/import Layout from '~\/layouts\/PageLayout\.astro';/);
  });

  it('lleva migas de pan visibles además del JSON-LD', () => {
    expect(page.markup).toMatch(/<Breadcrumbs/);
    expect(page.markup).toMatch(/breadcrumbSchema/);
  });

  it('tiene un solo H1', () => {
    expect(page.markup.match(/<h1\b/g)).toHaveLength(1);
  });

  it('muestra la fecha de la última actualización', () => {
    expect(page.frontmatter).toMatch(/const LAST_UPDATED = '\d{1,2} de [a-záéíóú]+ de \d{4}';/);
    expect(page.markup).toContain('Última actualización: {LAST_UPDATED}');
  });

  it('está en español de Colombia, sin voseo', () => {
    expect(findVoseo(page.frontmatter + page.markup)).toEqual([]);
  });

  it('ofrece WhatsApp como canal para ejercer derechos o consultar, tomado de BUSINESS', () => {
    expect(page.frontmatter).toMatch(/import \{ BUSINESS \} from '~\/data\/business';/);
    expect(page.frontmatter).toMatch(/import \{ whatsappUrl \} from '~\/utils\/whatsapp';/);
    expect(page.markup).toContain('{BUSINESS.telephone}');
    expect(page.markup).not.toMatch(/\+57|\b310\b|wa\.me/);
  });

  it('no publica ningún correo: el dominio no recibe mensajes', () => {
    expect(page.markup).not.toMatch(/mailto:|[\w.+-]+@[\w-]+\.[\w.-]+/);
  });
});

describe('/privacidad: los compromisos de la política anterior siguen ahí', () => {
  // Cada línea es una frase de la política publicada en el sitio anterior (que no
  // decía nada de Google Calendar ni de OAuth). Quitarla o debilitarla es una
  // decisión del dueño, no algo que pase por limpiar el texto.
  const COMMITMENTS: Array<[string, RegExp]> = [
    ['Ley 1581 de 2012', /Ley 1581 de 2012/],
    ['Decreto 1377 de 2013', /Decreto 1377 de 2013/],
    ['RGPD cuando aplique', /Reglamento General de Protección de Datos \(RGPD\)/],
    ['no se venden ni ceden los datos', /No vendemos ni cedemos tus datos personales a terceros con fines comerciales/],
    ['proveedores bajo confidencialidad', /bajo estrictas obligaciones de confidencialidad/],
    ['base legal: consentimiento explícito', /Tu consentimiento explícito/],
    ['base legal: ejecución del contrato', /La ejecución del contrato de servicios/],
    ['base legal: interés legítimo', /El interés legítimo/],
    ['conservación mientras exista la relación', /mientras exista una relación comercial activa/],
    ['eliminación a solicitud, en cualquier momento', /Puedes solicitar su eliminación en cualquier momento/],
    ['derecho a acceder', /Acceder a los datos personales que tenemos sobre ti/],
    ['derecho a rectificar', /Rectificar datos incorrectos o desactualizados/],
    ['derecho a suprimir', /Suprimir tus datos cuando ya no sean necesarios/],
    ['derecho a oponerse al marketing', /Oponerte al tratamiento de tus datos para fines de marketing/],
    ['derecho a revocar el consentimiento', /Revocar tu consentimiento en cualquier momento/],
    ['queja ante la SIC', /Presentar una queja ante la Superintendencia de Industria y Comercio \(SIC\)/],
    ['respuesta en 15 días hábiles', /Responderemos en un plazo máximo de 15 días hábiles/],
    ['seguridad razonable', /medidas técnicas y organizativas razonables/],
    ['solo mayores de 18 años', /dirigidos a personas mayores de 18 años/],
    ['menores: se eliminan sus datos', /procederemos a eliminarlos de inmediato/],
    ['transferencias internacionales', /Algunos proveedores listados operan fuera de Colombia/],
    [
      'cookies: se gestionan desde el navegador',
      /gestionar tus preferencias de cookies desde la configuración de tu navegador/,
    ],
    ['antifraude en formularios', /honeypot y rate limiting en formularios/],
    [
      'cambios de la política con nueva fecha',
      /Los cambios se publicarán en esta página con la nueva fecha de actualización/,
    ],
  ];

  it.each(COMMITMENTS)('conserva: %s', (_name, pattern) => {
    expect(privacyText).toMatch(pattern);
  });

  it('sigue declarando Google Tag Manager y Google Analytics en finalidades, cookies y terceros', () => {
    expect(privacyText).toMatch(/mediante Google Analytics \/ Google Tag Manager/);
    expect(privacyText).toMatch(/Utilizamos Google Tag Manager y Google Analytics/);
    expect(privacyText).toMatch(/Google \(Analytics \/ Tag Manager\) — análisis de tráfico web/);
  });

  it('tiene las 13 secciones numeradas de la política anterior, en el mismo orden', () => {
    const headings = [...PRIVACY.markup.matchAll(/<h2>([^<]+)<\/h2>/g)].map(([, heading]) => heading);

    expect(headings).toEqual([
      '1. Responsable del tratamiento',
      '2. Datos que recopilamos',
      '3. Finalidades del tratamiento',
      '4. Base legal',
      '5. Almacenamiento de datos',
      '6. Cookies y tecnologías de seguimiento',
      '7. Compartición con terceros',
      '8. Transferencias internacionales',
      '9. Tus derechos',
      '10. Seguridad',
      '11. Menores de edad',
      '12. Cambios en esta política',
      '13. Contacto',
    ]);
  });
});

describe('/privacidad: describe ESTE sitio y no el anterior', () => {
  it('identifica al responsable que firma el sitio, igual que la página del autor', () => {
    expect(personSchema().name).toBe('Santiago Bedoya');
    expect(privacyText).toContain('operado por Santiago Bedoya');
    expect(privacyText).toContain('Nombre: Santiago Bedoya');
    expect(privacyText).toContain(`Marca: ${BUSINESS.name}`);
    expect(privacyText).toContain(`Domicilio: ${BUSINESS.address.locality}, ${BUSINESS.address.region}, Colombia`);
  });

  it('no nombra al responsable ni a los proveedores del sitio anterior', () => {
    expect(privacyText).not.toMatch(/Miguel|Zuluaga|Supabase|SOC 2|mentoría|Firebase/i);
  });

  it('dice dónde se guardan los formularios: el servicio de almacenamiento del proveedor de alojamiento (Netlify)', () => {
    expect(privacyText).toMatch(
      /formularios de contacto y de agendamiento de citas se almacenan en el servicio de almacenamiento de nuestro proveedor de alojamiento en la nube \(Netlify\)/
    );
    expect(privacyText).toMatch(/proveedor de alojamiento en la nube/);
  });

  // Los datos vivían en una base de datos del propio servidor del sitio anterior. Ya no: están en el
  // almacenamiento de Netlify (Netlify Blobs, ver src/lib/storage). Decir lo contrario sería falso.
  it('ya no afirma que los datos viven en una base de datos ni en un servidor propio', () => {
    expect(privacyText).not.toMatch(/base de datos/i);
    expect(privacyText).not.toMatch(/nuestro (?:propio )?servidor|servidor propio|propio servidor/i);
  });

  // El proveedor que nombra la política tiene que ser el que el sitio de verdad usa: el adaptador de
  // despliegue y el almacenamiento son de Netlify.
  it('el proveedor que nombra es el que el sitio usa: hospedaje y almacenamiento de Netlify', () => {
    const { dependencies } = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };

    expect(dependencies).toHaveProperty(['@astrojs/netlify']);
    expect(dependencies).toHaveProperty(['@netlify/blobs']);
    expect(privacyText).toContain('(Netlify)');
  });

  it('lista como proveedores a Google, al alojamiento y al correo, y avisa de que WhatsApp es de Meta', () => {
    const sharing = privacyText.slice(
      privacyText.indexOf('7. Compartición con terceros'),
      privacyText.indexOf('8. Transferencias')
    );

    expect(sharing).toMatch(/Google \(Analytics \/ Tag Manager\)/);
    expect(sharing).toMatch(/Proveedor de alojamiento en la nube/);
    expect(sharing).toMatch(/Proveedor de correo electrónico/);
    // Y dice qué hace el alojamiento con los datos: ahí vive el almacenamiento de los formularios.
    expect(sharing).toMatch(
      /Proveedor de alojamiento en la nube \(Netlify\) — infraestructura donde funciona el sitio y servicio de almacenamiento donde se guardan los datos de los formularios/
    );
    expect(sharing).toMatch(/WhatsApp.*\(Meta\)/);
  });

  it('el correo del que habla es el que el código envía: aviso de cada consulta y confirmación de la cita', () => {
    const email = read('src/lib/email.ts');

    expect(email).toMatch(/sendContactFormNotification/);
    expect(email).toMatch(/sendAppointmentConfirmation/);
    expect(privacyText).toMatch(/aviso de cada consulta y de la confirmación de las citas/);
    expect(privacyText).toMatch(/confirmación de tu cita cuando agendas una asesoría/);
  });

  it('no habla de cuentas de usuario ni de inicio de sesión de visitantes: no existen', () => {
    // Solo hay un panel de administración sin registro público.
    expect(privacyText).not.toMatch(/cuenta de usuario|inicia(?:r)? sesión con Google|registro de usuarios/i);
  });
});

describe('/privacidad: declara cada dato personal que el sitio guarda', () => {
  /**
   * Campos de los registros donde se guardan los formularios y las citas
   * (`ContactRecord` y `AppointmentRecord`, src/lib/storage/types.ts) → frase de la
   * política que los declara. Si se agrega un campo y no está acá, el test falla:
   * hay que decidir si es un dato personal y, si lo es, decirlo en /privacidad.
   */
  const DECLARED: Record<string, Record<string, RegExp>> = {
    ContactRecord: {
      name: /Nombre completo/,
      email: /Correo electrónico/,
      phone: /Número de teléfono \/ WhatsApp \(opcional\)/,
      company: /Empresa \(opcional\)/,
      interest: /Servicio de interés/,
      message: /Tu mensaje/,
      ip_address: /dirección IP, el tipo de navegador y la página desde la que lo enviaste/,
      user_agent: /dirección IP, el tipo de navegador y la página desde la que lo enviaste/,
      source_page: /dirección IP, el tipo de navegador y la página desde la que lo enviaste/,
    },
    AppointmentRecord: {
      name: /Nombre completo/,
      email: /Correo electrónico/,
      phone: /Número de teléfono \/ WhatsApp \(opcional\)/,
      company: /Empresa \(opcional\)/,
      service_type: /el servicio, la fecha y la hora que eliges/,
      date: /el servicio, la fecha y la hora que eliges/,
      time: /el servicio, la fecha y la hora que eliges/,
      message: /Tu mensaje/,
    },
  };

  /** Campos técnicos o fijados por el servidor: la persona no los escribe. */
  const NOT_PERSONAL = new Set(['id', 'status', 'created_at', 'updated_at', 'timezone', 'duration']);

  /**
   * Los campos de una interfaz de src/lib/storage/types.ts, leídos del código fuente
   * (los tipos no existen en tiempo de ejecución). Se parsea con el compilador de
   * TypeScript y no con una expresión regular: no depende de cómo estén escritos
   * los comentarios ni el formato.
   */
  const fieldsOf = (interfaceName: string): string[] => {
    const sourceFile = ts.createSourceFile(
      'types.ts',
      read('src/lib/storage/types.ts'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const declaration = sourceFile.statements.find(
      (statement): statement is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName
    );

    if (!declaration) throw new Error(`No existe la interfaz ${interfaceName} en src/lib/storage/types.ts`);

    return declaration.members.filter(ts.isPropertySignature).map((member) => member.name.getText(sourceFile));
  };

  it('lee los campos de las dos interfaces de types.ts', () => {
    // Si el parser dejara de encontrarlos, los demás tests pasarían en vacío.
    expect(fieldsOf('ContactRecord')).toEqual(expect.arrayContaining(['id', 'name', 'email', 'message', 'ip_address']));
    expect(fieldsOf('AppointmentRecord')).toEqual(
      expect.arrayContaining(['id', 'name', 'email', 'service_type', 'date', 'time'])
    );
  });

  it.each(Object.keys(DECLARED))('%s: cada campo personal tiene su frase en la política', (record) => {
    const personal = fieldsOf(record).filter((field) => !NOT_PERSONAL.has(field));

    expect(
      personal.filter((field) => !(field in DECLARED[record])),
      `campos de ${record} sin declarar en /privacidad: agrégalos a la política y a este test`
    ).toEqual([]);
  });

  it.each(Object.keys(DECLARED))('%s: la política contiene cada frase declarada', (record) => {
    Object.entries(DECLARED[record]).forEach(([field, pattern]) => {
      expect(privacyText, `${record}.${field}`).toMatch(pattern);
    });
  });

  it.each(Object.keys(DECLARED))('%s: no declara campos que ya no existen', (record) => {
    const existing = new Set(fieldsOf(record));

    Object.keys(DECLARED[record]).forEach((field) => expect(existing.has(field), `${record}.${field}`).toBe(true));
  });

  it('el formulario de contacto solo guarda IP, navegador y página además de lo que escribe la persona', () => {
    const technical = fieldsOf('ContactRecord').filter(
      (field) =>
        !NOT_PERSONAL.has(field) && !['name', 'email', 'phone', 'company', 'interest', 'message'].includes(field)
    );

    expect(technical.sort()).toEqual(['ip_address', 'source_page', 'user_agent']);
  });

  it('la IP y el navegador se guardan SOLO con el formulario de contacto, como dice la política', () => {
    expect(fieldsOf('AppointmentRecord')).not.toContain('ip_address');
    expect(fieldsOf('AppointmentRecord')).not.toContain('user_agent');
    expect(privacyText).toMatch(
      /Cuando envías el formulario de contacto, también guardamos, junto con tu consulta, la dirección IP/
    );
  });

  // types.ts es el contrato, pero lo que cuenta para la privacidad es lo que el store de verdad
  // escribe. Si core.ts guardara un campo que no está en la interfaz, este test lo delata.
  describe('lo que el store escribe coincide con types.ts', () => {
    const contact = {
      name: 'Persona Contacto',
      email: 'persona.contacto@example.com',
      message: 'Hola',
      phone: '+57 300 000 0001',
      company: 'Acme',
      interest: 'otro',
      ip: '203.0.113.7',
      userAgent: 'Vitest/1.0',
      sourcePage: '/contacto',
    };
    const appointment = {
      name: 'Persona Cita',
      email: 'persona.cita@example.com',
      phone: '+57 300 000 0002',
      company: 'Acme',
      serviceType: 'Otro',
      date: '2099-03-02',
      time: '10:00',
      timezone: 'America/Bogota',
      duration: 60,
      message: 'Hola',
    };

    it('un contacto guardado tiene exactamente los campos de ContactRecord', async () => {
      const store = createMemoryStore();

      const created = await store.createContact(contact);
      const [listed] = await store.listContacts();

      expect(Object.keys(created).sort()).toEqual(fieldsOf('ContactRecord').sort());
      expect(Object.keys(listed).sort()).toEqual(fieldsOf('ContactRecord').sort());
    });

    it('una cita guardada tiene exactamente los campos de AppointmentRecord', async () => {
      const store = createMemoryStore();

      const result = await store.createAppointment(appointment);
      const [listed] = await store.listAppointments();

      expect(result.created).toBe(true);
      expect(Object.keys(listed).sort()).toEqual(fieldsOf('AppointmentRecord').sort());
    });

    it('los datos personales solo viven en los registros declarados: el índice de horarios no los copia', async () => {
      const backend = new MemoryBackend();
      const store = new KeyValueLeadStore(backend, { backend: 'memory', scope: 'process' });
      await store.createContact(contact);
      await store.createAppointment(appointment);

      const keys = await backend.keys('');

      // Solo existen estas clases de claves: una nueva (un índice por correo, por ejemplo)
      // obliga a pensar si guarda datos personales y si hay que declararlo.
      expect(new Set(keys.map((key) => key.split('/')[0]))).toEqual(new Set(['appointment', 'contact', 'slot']));

      const slots = keys.filter((key) => key.startsWith('slot/'));
      expect(slots).toHaveLength(1);

      for (const key of slots) {
        expect(JSON.stringify(await backend.get(key))).not.toMatch(/Persona|example\.com|\+57|203\.0\.113|Vitest|Acme/);
      }
    });
  });
});

describe('/privacidad: la medición que declara es la que el código hace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Eventos que el sitio empuja al dataLayer de GTM ante un lead y un clic de WhatsApp. */
  const eventsPushed = () => {
    const win = { dataLayer: [] as Array<Record<string, unknown>>, location: { pathname: '/contact' } };
    vi.stubGlobal('window', win);

    trackLead({ interest: 'clases-de-ia', formId: 'lead-contacto' });
    trackWhatsAppClick('contact');

    return win.dataLayer;
  };

  it('mide los clics en WhatsApp y el envío de los formularios', () => {
    expect(eventsPushed().map((event) => event.event)).toEqual(['generate_lead', 'whatsapp_click']);
    expect(privacyText).toMatch(/medimos los clics en los botones de WhatsApp y el envío de los formularios/);
  });

  it('esos eventos no llevan el nombre, el correo ni el teléfono, como dice la política', () => {
    const keys = eventsPushed().flatMap((event) => Object.keys(event));

    expect(privacyText).toMatch(/Esos eventos no incluyen tu nombre, tu correo ni tu teléfono/);
    expect([...new Set(keys)].sort()).toEqual(['event', 'form_id', 'interest', 'link_location', 'page_path']);
    keys.forEach((key) => expect(key).not.toMatch(/name|nombre|mail|correo|phone|tel|whatsapp_number/i));
  });

  it('los valores de esos eventos tampoco contienen datos de la persona', () => {
    const values = eventsPushed().flatMap((event) => Object.values(event).map(String));

    values.forEach((value) => expect(value).not.toMatch(/@|\+57|\d{7,}/));
  });

  it('el contenedor de GTM es el del negocio, declarado una sola vez en BUSINESS', () => {
    expect(BUSINESS.gtmId).toMatch(/^GTM-[A-Z0-9]{4,10}$/);
    expect(privacyText).not.toContain(BUSINESS.gtmId);
  });
});

describe('/privacidad: Google Calendar y las APIs de Google', () => {
  /**
   * La política anterior NO tenía texto sobre datos de usuario de Google, Google API
   * Services, Uso Limitado (Limited Use) ni alcances de OAuth, y la publicada tampoco.
   * La única mención a Google Calendar está en el bloque informativo del inicio.
   *
   * Este repositorio no tiene código que llame a una API de Google (solo GTM). Si
   * eso cambia, la política tiene que decir qué alcances se piden y cómo se usan los
   * datos, con lo que apruebe el dueño; este test lo exige en ese momento.
   */
  const SOURCE_DIRS = ['src/lib', 'src/pages', 'src/utils', 'src/components', 'src/layouts'];
  const GOOGLE_API_CODE =
    /googleapis|google-auth-library|calendar\/v3|oauth2\.googleapis|accounts\.google\.com|gapi\.|GoogleAuthProvider|signInWithPopup/;

  const sourceFiles = SOURCE_DIRS.flatMap((dir) =>
    (readdirSync(resolve(ROOT, dir), { recursive: true, encoding: 'utf8' }) as string[])
      .filter((file) => /\.(astro|ts|js|mjs)$/.test(file))
      .map((file) => `${dir}/${file}`)
  );

  const filesCallingGoogleApis = sourceFiles.filter((file) => GOOGLE_API_CODE.test(read(file)));

  const dependencies = Object.keys({
    ...JSON.parse(read('package.json')).dependencies,
    ...JSON.parse(read('package.json')).devDependencies,
  });
  const googleDependencies = dependencies.filter((name) =>
    /^(googleapis|google-auth-library|@googleapis\/|firebase)/.test(name)
  );

  it('revisa el código de verdad: encuentra archivos y dependencias que recorrer', () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
    expect(dependencies.length).toBeGreaterThan(10);
  });

  it('si el sitio empieza a llamar a una API de Google, la política declara el Uso Limitado', () => {
    const usesGoogleApis = filesCallingGoogleApis.length > 0 || googleDependencies.length > 0;
    const declares = /Uso Limitado|Limited Use/i.test(privacyText) && /alcances|scopes/i.test(privacyText);

    expect(
      !usesGoogleApis || declares,
      `El sitio usa APIs de Google (${[...filesCallingGoogleApis, ...googleDependencies].join(', ')}) pero /privacidad no declara los alcances ni el Uso Limitado`
    ).toBe(true);
  });

  it('el inicio y la política dicen lo mismo de las herramientas de Google que sí se usan', () => {
    const home = visibleText(pageSource('index').markup);

    expect(home).toMatch(/Google Analytics, a través de Google Tag Manager/);
    expect(privacyText).toMatch(/Google Tag Manager y Google Analytics/);
  });
});

describe('/terminos: las condiciones comerciales anteriores se conservan', () => {
  // Cada línea es una condición de los términos del sitio anterior. El código marca
  // que las debe confirmar el dueño: no se cambian al pasar por una limpieza de copy.
  const CONDITIONS: Array<[string, RegExp]> = [
    [
      'la reserva se confirma con disponibilidad y pago',
      /únicamente una vez que el Prestador confirme la disponibilidad/,
    ],
    ['la sesión gratuita no obliga a contratar', /no implica obligación de contratar ningún plan posterior/],
    ['paquete intensivo: 10 horas', /Paquete Intensivo:\s*10 horas de clase/],
    ['clase individual: 60 minutos', /Clase Individual:\s*sesión de 60 minutos/],
    ['pagos: transferencia, Nequi, PayPal', /transferencia bancaria, Nequi, PayPal u otros acordados/],
    [
      'cancelación con más de 24 horas: sin costo',
      /más de 24 horas de anticipación:\s*el Cliente puede reprogramar la sesión sin costo alguno/,
    ],
    ['cancelación con menos de 24 horas: se consume', /menos de 24 horas:\s*la sesión se considerará consumida/],
    ['reembolso proporcional con 10% administrativo', /tarifa administrativa del 10%/],
    ['sin reembolso pasada la mitad del paquete', /No se aplican reembolsos una vez completada la mitad del paquete/],
    ['reembolso total si cancela el Prestador', /reembolso total del valor pagado por dicha sesión/],
    ['materiales de uso personal', /uso exclusivo del Cliente para su aprendizaje personal/],
    ['grabaciones de uso personal', /grabaciones de las clases son de uso personal del Cliente/],
    ['conducta respetuosa', /comunicación respetuosa durante todas las sesiones/],
    ['sin garantía de resultados', /no garantiza resultados específicos \(empleo, ingresos, certificaciones\)/],
    ['cambios de los términos', /podrá actualizar estos Términos y Condiciones en cualquier momento/],
    ['ley colombiana', /se rigen por las leyes de la República de Colombia/],
    ['jurisdicción de Medellín', /tribunales competentes de la ciudad de Medellín, Colombia/],
  ];

  it.each(CONDITIONS)('conserva: %s', (_name, pattern) => {
    expect(termsText).toMatch(pattern);
  });

  it('tiene las 10 secciones numeradas de los términos anteriores, en el mismo orden', () => {
    const headings = [...TERMS.markup.matchAll(/<h2>([^<]+)<\/h2>/g)].map(([, heading]) => heading);

    expect(headings).toEqual([
      '1. Descripción del servicio',
      '2. Reserva y confirmación',
      '3. Tarifas y pagos',
      '4. Cancelaciones y reembolsos',
      '5. Uso del material',
      '6. Conducta del Cliente',
      '7. Limitación de responsabilidad',
      '8. Modificación de los términos',
      '9. Ley aplicable y jurisdicción',
      '10. Contacto',
    ]);
  });
});

describe('/terminos: coherente con la reserva y con el resto del sitio', () => {
  it('ninguna duración que digan los términos contradice el turno de reserva', () => {
    const minutes = [...termsText.matchAll(/(\d+)\s*minutos/g)].map(([, amount]) => Number(amount));

    expect(BOOKING_DURATION_MINUTES).toBe(60);
    expect(minutes.length).toBeGreaterThan(0);
    minutes.forEach((amount) => expect(amount).toBe(BOOKING_DURATION_MINUTES));
    expect(termsText).not.toMatch(/30 minutos|media hora/i);
  });

  it('la sesión gratuita no anuncia una duración: los turnos de la agenda duran una hora', () => {
    const free =
      termsText.match(/Sesión de diagnóstico gratuita \(asesoría gratuita\):.*?(?= Clase Individual)/)?.[0] ?? '';

    expect(free).not.toBe('');
    expect(free).not.toMatch(/\d+\s*(minutos|horas)|media hora/i);
    expect(free).toMatch(/sin costo/);
  });

  it('los canales de reserva que nombra existen: formulario, agenda y WhatsApp', () => {
    expect(termsText).toMatch(/formulario de contacto, agenda de asesorías o WhatsApp/);
    expect(existsSync(resolve(ROOT, 'src/pages/contact.astro'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'src/pages/booking.astro'))).toBe(true);
    expect(TERMS.markup).toMatch(/data-whatsapp-location="terminos"/);
  });

  // Este sitio no publica tarifas: decir que "se publican en el sitio" sería falso.
  it('no dice que las tarifas están publicadas en el sitio: se informan antes de confirmar la reserva', () => {
    expect(termsText).not.toMatch(/se publican en el sitio|publicadas en/i);
    expect(termsText).toMatch(/tarifas vigentes se informan al Cliente antes de confirmar la reserva/);
  });

  it('nombra al Prestador que firma el sitio y no al anterior', () => {
    expect(termsText).toContain('Santiago Bedoya');
    expect(termsText).toContain(`marca ${BUSINESS.name}`);
    expect(termsText).not.toMatch(/Miguel|Zuluaga|mentoría/i);
  });

  it('describe las modalidades reales: en persona en Medellín y municipios cercanos, o en línea', () => {
    expect(termsText).toMatch(/en persona en Medellín y municipios cercanos o en línea mediante videollamada/);
  });

  it('dice qué regula: las clases y la formación, no el resto de los servicios del sitio', () => {
    // Pendiente de decisión del dueño: los proyectos de software, automatización y marketing
    // se contratan con propuesta escrita y no están cubiertos por estos términos.
    expect(termsText).toMatch(/regulan la contratación y uso de las clases y demás servicios de formación/);
  });
});

describe('inicio: bloque informativo de la aplicación (verificación OAuth)', () => {
  const home = pageSource('index');
  const start = home.markup.indexOf('<section id="sobre-la-plataforma"');
  const block = home.markup.slice(start, home.markup.indexOf('</section>', start) + '</section>'.length);
  const text = visibleText(block);

  it('encuentra el bloque', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block.length).toBeGreaterThan(200);
  });

  it('muestra la marca como texto visible en el HTML', () => {
    expect(block).toMatch(/<p[^>]*>Sonmyd<\/p>/);
    expect(text).toMatch(/^Sonmyd /);
  });

  it('describe la plataforma y la integración con Google Calendar para el agendamiento de citas', () => {
    expect(text).toMatch(/Plataforma de tecnología, automatización e inteligencia artificial/);
    expect(text).toMatch(/Medellín, Colombia/);
    expect(text).toMatch(/integraciones con WhatsApp Business y con Google Calendar para el agendamiento de citas/);
  });

  it('dice que accede a Google Calendar por OAuth con la autorización del usuario', () => {
    expect(text).toMatch(
      /accede a Google Calendar a través de OAuth, con la autorización del usuario, para crear y gestionar citas/
    );
  });

  it('avisa del uso de Google Analytics a través de Google Tag Manager', () => {
    expect(text).toMatch(/Google Analytics, a través de Google Tag Manager, para medir el tráfico web/);
  });

  it('enlaza a la política de privacidad y a los términos, con URL del mismo dominio', () => {
    expect(block).toMatch(/<a[^>]*href="\/privacidad"[^>]*>Política de privacidad<\/a>/);
    expect(block).toMatch(/<a[^>]*href="\/terminos"[^>]*>Términos y condiciones<\/a>/);
    expect(block).toMatch(/<nav aria-label="Información legal"/);
  });

  // Google lee la página sin ejecutar JavaScript y sin interpretar CSS de ocultación.
  it('es texto visible: nada lo oculta ni lo construye con JavaScript', () => {
    const withoutSeparator = block.replace(/<span aria-hidden="true">·<\/span>/g, '');

    expect(withoutSeparator).not.toMatch(
      /\bhidden\b|sr-only|invisible|display:\s*none|opacity-0|aria-hidden|<noscript|set:html|<script|collapse/i
    );
  });

  // Un <details> cerrado, un <dialog> o un <template> esconden su contenido aunque el HTML lo incluya.
  it('la página no usa elementos que escondan contenido, y el bloque cuelga directo del layout', () => {
    expect(home.markup).not.toMatch(/<(details|dialog|template|noscript)\b/);
    expect(home.markup.match(/<Layout metadata=\{metadata\}>/g)).toHaveLength(1);
    expect(home.markup.slice(start - 400, start)).not.toMatch(/<(div|article|aside)\b[^>]*(hidden|sr-only)/);
  });

  it('cierra la página: va después del formulario de captación, dentro del layout', () => {
    expect(start).toBeGreaterThan(home.markup.indexOf('<LeadCapture'));
    expect(home.markup.trimEnd().endsWith('</Layout>')).toBe(true);
  });

  it('el inicio y el pie enlazan a las mismas dos URL legales', () => {
    const footer = read('src/navigation.ts');

    expect(footer).toContain("link('Privacidad', '/privacidad')");
    expect(footer).toContain("link('Términos', '/terminos')");
  });
});
