import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
import { whatsappUrl } from '~/utils/whatsapp';

/**
 * Guardas de los componentes de la base compartida (WhatsApp, GTM, enlazado
 * interno, SEO local, formularios).
 *
 * Los .astro no se pueden importar desde Vitest, así que se leen como texto.
 * Cada aserción protege algo que se puede romper en silencio: ningún build
 * falla si el botón flotante se pasa por encima de la cabecera, si un
 * formulario deja de enlazarse tras una navegación o si vuelve el voseo.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Un .astro es `---\nfrontmatter\n---\nplantilla`. */
const parts = (source: string) => {
  const [, frontmatter = '', ...markup] = source.split(/^---$/m);
  return { frontmatter, markup: markup.join('---') };
};
const frontmatterOf = (path: string) => parts(read(path)).frontmatter;
const markupOf = (path: string) => parts(read(path)).markup;

const COMPONENTS = {
  button: 'src/components/ui/WhatsAppButton.astro',
  float: 'src/components/common/WhatsAppFloat.astro',
  gtm: 'src/components/common/GoogleTagManager.astro',
  related: 'src/components/widgets/RelatedLinks.astro',
  area: 'src/components/widgets/ServiceArea.astro',
  hero: 'src/components/widgets/Hero.astro',
  leadForm: 'src/components/ui/LeadForm.astro',
  leadCapture: 'src/components/widgets/LeadCapture.astro',
  booking: 'src/components/widgets/AppointmentBooking.astro',
  layout: 'src/layouts/Layout.astro',
  pageLayout: 'src/layouts/PageLayout.astro',
  header: 'src/components/widgets/Header.astro',
};

/** Quita los comentarios: las aserciones de "no usa X" miran el código, no la explicación de por qué se quitó. */
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Formas de voseo rioplatense: el sitio habla de "tú" (español de Colombia). */
const VOSEO =
  /\b(querés|podés|tenés|sabés|necesitás|preferís|hablás|vivís|contanos|escribinos|agendá|mirá|hacé|elegí|probá|intentá|revisá|escribí|salí|vení|decime|fijate|vos|dejá|pedí|llamá|consultá|empezá|contactanos)\b/i;

/** Contraste WCAG 2.x entre dos colores `#rrggbb`. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('WhatsAppButton', () => {
  const source = read(COMPONENTS.button);
  const markup = markupOf(COMPONENTS.button);

  it('abre el chat en una pestaña nueva con rel="noopener"', () => {
    expect(markup).toMatch(/href=\{whatsappUrl\(message\)\}/);
    expect(markup).toMatch(/target="_blank"/);
    expect(markup).toMatch(/rel="noopener"/);
  });

  it('declara dónde está el botón, para medir cuál convierte', () => {
    expect(markup).toMatch(/data-whatsapp-location=\{location\}/);
  });

  it('exige `location` y deja el resto de las props como opcionales', () => {
    expect(source).toMatch(/^\s+location: string;/m);
    expect(source).not.toMatch(/location\?:/);
    expect(source).toMatch(/message\?: string;/);
    expect(source).toMatch(/text\?: string;/);
    expect(source).toMatch(/variant\?: 'primary' \| 'secondary';/);
    expect(source).toMatch(/class\?: string;/);
  });

  it('usa el texto por defecto "Escríbenos por WhatsApp" y la variante primaria', () => {
    expect(source).toMatch(/text = WHATSAPP_DEFAULT_TEXT/);
    expect(source).toMatch(/variant = 'primary'/);
  });

  it('muestra el icono de WhatsApp, decorativo para los lectores de pantalla', () => {
    expect(markup).toMatch(/<Icon name="tabler:brand-whatsapp"[^>]*aria-hidden="true"/);
  });

  it('su nombre accesible siempre menciona WhatsApp (aria-label cuando el texto no lo hace)', () => {
    expect(source).toMatch(/whatsappAccessibleName\(text\)/);
    expect(markup).toMatch(/aria-label=\{accessibleName !== text \? accessibleName : undefined\}/);
  });

  it('reutiliza las clases de los botones del sistema de diseño', () => {
    const css = read('src/assets/styles/tailwind.css');
    const button = read('src/components/ui/Button.astro');

    expect(source).toMatch(/primary: 'btn-primary'/);
    expect(source).toMatch(/secondary: 'btn-secondary'/);
    expect(button).toMatch(/primary: 'btn-primary'/);
    expect(button).toMatch(/secondary: 'btn-secondary'/);
    expect(css).toMatch(/\.btn-primary \{/);
    expect(css).toMatch(/\.btn-secondary \{/);
  });

  it('permite sumar clases del llamador', () => {
    expect(markup).toMatch(/twMerge\(variants\[variant\]/);
    expect(markup).toMatch(/className\)/);
  });
});

describe('WhatsAppFloat', () => {
  const frontmatter = frontmatterOf(COMPONENTS.float);
  const markup = markupOf(COMPONENTS.float);
  const classes = markup.match(/class="([^"]+)"/)?.[1] ?? '';
  const message = frontmatter.match(/const MESSAGE = '([^']+)'/)?.[1] ?? '';

  it('lleva el mensaje genérico del sitio, prellenado y bien codificado', () => {
    expect(message).toBe('Hola, vengo de sonmyd.co y quiero más información.');
    expect(markup).toMatch(/href=\{whatsappUrl\(MESSAGE\)\}/);
    expect(new URL(whatsappUrl(message)).searchParams.get('text')).toBe(message);
  });

  it('se anuncia como "Escríbenos por WhatsApp"', () => {
    expect(markup).toMatch(/aria-label="Escríbenos por WhatsApp"/);
  });

  it('declara su ubicación para el rastreo de clics', () => {
    expect(markup).toMatch(/data-whatsapp-location="float"/);
  });

  it('abre el chat en una pestaña nueva con rel="noopener"', () => {
    expect(markup).toMatch(/target="_blank"/);
    expect(markup).toMatch(/rel="noopener"/);
  });

  it('queda fijo abajo a la derecha, respetando el área segura del dispositivo', () => {
    expect(classes).toMatch(/\bfixed\b/);
    expect(classes).toMatch(/bottom-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
    expect(classes).toMatch(/right-\[max\(1rem,env\(safe-area-inset-right\)\)\]/);
  });

  // La cabecera es sticky con z-40 y en móvil, con el menú abierto, ocupa toda la
  // pantalla y su barra inferior es fija: el botón nunca puede quedar por encima.
  it('queda POR DEBAJO de la cabecera, para no tapar la barra inferior del menú móvil', () => {
    const header = read(COMPONENTS.header);
    const headerZ = Number(header.slice(header.indexOf('<header')).match(/\bz-(\d+)\b/)?.[1]);
    const floatZ = Number(classes.match(/(?<![:\w-])z-(\d+)\b/)?.[1]);

    expect(headerZ).toBeGreaterThan(0);
    expect(floatZ).toBeGreaterThan(0);
    expect(floatZ).toBeLessThan(headerZ);
  });

  it('no se imprime', () => {
    expect(classes).toMatch(/\bprint:hidden\b/);
  });

  it('persiste entre navegaciones del ClientRouter', () => {
    expect(markup).toMatch(/transition:persist="whatsapp-float"/);
  });

  it('respeta prefers-reduced-motion: ninguna animación y toda transición va con motion-safe', () => {
    expect(classes).not.toMatch(/(?<![:\w-])animate-/);
    expect(classes).not.toMatch(/\bhover:scale/);

    const motion = classes.split(/\s+/).filter((token) => /(^|:)(transition|duration|animate|ease)/.test(token));
    expect(motion.length).toBeGreaterThan(0);
    motion.forEach((token) => expect(token).toMatch(/^motion-safe:/));
  });

  it('el icono blanco contrasta al menos 3:1 con el verde (WCAG 1.4.11), en reposo y en hover', () => {
    const base = classes.match(/(?<![:\w-])bg-\[(#[0-9a-fA-F]{6})\]/)?.[1];
    const hover = classes.match(/hover:bg-\[(#[0-9a-fA-F]{6})\]/)?.[1];

    expect(classes).toMatch(/(?<![:\w-])text-white\b/);
    expect(base).toBeDefined();
    expect(hover).toBeDefined();
    expect(contrast('#ffffff', base!)).toBeGreaterThanOrEqual(3);
    expect(contrast('#ffffff', hover!)).toBeGreaterThanOrEqual(3);
  });

  it('el verde oficial #25D366 NO alcanzaría el contraste mínimo: por eso no se usa', () => {
    expect(contrast('#ffffff', '#25D366')).toBeLessThan(3);
    expect(classes).not.toMatch(/#25D366/i);
  });

  it('el área táctil es de al menos 44 px', () => {
    const size = Number(classes.match(/(?<![:\w-])h-(\d+)\b/)?.[1]);

    expect(size * 4).toBeGreaterThanOrEqual(44);
    expect(classes).toMatch(new RegExp(`(?<![:\\w-])w-${size}\\b`));
  });

  it('el foco por teclado es visible', () => {
    expect(classes).toMatch(/focus-visible:ring-2/);
  });
});

describe('GoogleTagManager', () => {
  const frontmatter = frontmatterOf(COMPONENTS.gtm);
  const markup = markupOf(COMPONENTS.gtm);

  it('solo se emite en producción y con un ID bien formado', () => {
    expect(frontmatter).toMatch(/import\.meta\.env\.PROD/);
    expect(frontmatter).toMatch(/isValidGtmId\(BUSINESS\.gtmId\)/);
    expect(markup).toMatch(/enabled &&/);
  });

  it('toma el contenedor de BUSINESS y no lo repite a mano', () => {
    expect(BUSINESS.gtmId).toBe('GTM-KNZPFWXB');
    expect(markup).toMatch(/BUSINESS\.gtmId/);
    expect(read(COMPONENTS.gtm)).not.toMatch(/GTM-[A-Z0-9]{4,}/);
  });

  it('el fragmento de <head> es un script inline, sin Partytown', () => {
    expect(markup).toMatch(/<script is:inline set:html=\{gtmHeadSnippet\(BUSINESS\.gtmId\)\}/);
    expect(markup).not.toMatch(/partytown/i);
    expect(markup).not.toMatch(/type="text\/partytown"/);
  });

  it('el <noscript><iframe> apunta al ns.html oficial y está oculto', () => {
    expect(markup).toMatch(/<noscript>/);
    expect(markup).toMatch(/<iframe[\s\S]*src=\{gtmNoscriptUrl\(BUSINESS\.gtmId\)\}/);
    expect(markup).toMatch(/style="display:none;visibility:hidden"/);
  });

  it('distingue la parte de <head> (por defecto) de la de <body>', () => {
    expect(frontmatter).toMatch(/part\?: 'head' \| 'body'/);
    expect(frontmatter).toMatch(/part = 'head'/);
    expect(markup).toMatch(/part === 'head'/);
    expect(markup).toMatch(/part === 'body'/);
  });
});

describe('Layout', () => {
  const source = read(COMPONENTS.layout);
  const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
  const body = source.slice(source.indexOf('<body'), source.indexOf('</body>'));

  it('carga GTM en el <head>, justo después del charset y el viewport', () => {
    expect(head).toMatch(/<GoogleTagManager \/>/);
    expect(head.indexOf('<CommonMeta />')).toBeGreaterThan(-1);
    expect(head.indexOf('<GoogleTagManager />')).toBeGreaterThan(head.indexOf('<CommonMeta />'));
    // ...y antes de cualquier otro recurso (estilos, metadatos, JSON-LD).
    expect(head.indexOf('<GoogleTagManager />')).toBeLessThan(head.indexOf('<Favicons />'));
    expect(head.indexOf('<GoogleTagManager />')).toBeLessThan(head.indexOf('<Metadata'));
  });

  it('pone el <noscript> de GTM como PRIMER hijo de <body>', () => {
    const afterBodyTag = body.slice(body.indexOf('>') + 1);
    const beforeGtm = afterBodyTag.slice(0, afterBodyTag.indexOf('<GoogleTagManager part="body" />'));

    expect(afterBodyTag).toContain('<GoogleTagManager part="body" />');
    // Entre <body> y el noscript solo puede haber comentarios de plantilla.
    expect(beforeGtm.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').trim()).toBe('');
  });

  it('monta el botón flotante de WhatsApp una vez, después del contenido', () => {
    expect(source.match(/<WhatsAppFloat \/>/g)).toHaveLength(1);
    expect(body.indexOf('<WhatsAppFloat />')).toBeGreaterThan(body.indexOf('<slot />'));
    expect(body.indexOf('<WhatsAppFloat />')).toBeLessThan(body.indexOf('<BasicScripts />'));
  });

  it('registra el listener delegado de clics a WhatsApp, una sola vez por documento', () => {
    expect(body).toMatch(/import \{ initWhatsAppTracking \} from '~\/utils\/tracking';/);
    expect(body).toMatch(/initWhatsAppTracking\(\);/);
  });

  it('conserva el ClientRouter y el JSON-LD de marca', () => {
    expect(head).toMatch(/<ClientRouter fallback="swap" \/>/);
    expect(head).toMatch(/<StructuredData schema=\{\[organizationSchema\(\), websiteSchema\(\)\]\} \/>/);
  });

  // Cualquier otro layout o página que lo montara también duplicaría el botón.
  it('es el único lugar donde se monta el botón flotante y GTM', () => {
    const files = (readdirSync(resolve(ROOT, 'src'), { recursive: true }) as string[])
      .filter((file) => file.endsWith('.astro'))
      .map((file) => `src/${file}`);

    const mounting = (tag: string) => files.filter((file) => read(file).includes(`<${tag}`));

    expect(mounting('WhatsAppFloat')).toEqual([COMPONENTS.layout]);
    expect(mounting('GoogleTagManager')).toEqual([COMPONENTS.layout]);
  });

  it('PageLayout y MarkdownLayout heredan de Layout: toda página pública los recibe', () => {
    expect(read(COMPONENTS.pageLayout)).toMatch(/import Layout from '~\/layouts\/Layout\.astro'/);
    expect(read('src/layouts/MarkdownLayout.astro')).toMatch(/layouts\/PageLayout\.astro/);
  });

  it('la página 404 también hereda de Layout (recibe GTM y el botón de WhatsApp)', () => {
    // Directo o a través de PageLayout, que a su vez envuelve a Layout.
    expect(read('src/pages/404.astro')).toMatch(/import \w+ from '~\/layouts\/(Page)?Layout\.astro'/);
  });

  // El panel tiene su propio <html>: sin GTM (no se mide al equipo) ni botón de contacto.
  it.each(['src/pages/admin/login.astro', 'src/pages/admin/dashboard.astro'])(
    '%s no usa Layout ni monta el botón o GTM',
    (page) => {
      const admin = read(page);

      expect(admin).not.toMatch(/layouts\/(Page)?Layout/);
      expect(admin).not.toMatch(/WhatsAppFloat|GoogleTagManager/);
      expect(admin).toMatch(/<html lang="es"/);
    }
  );
});

describe('Hero', () => {
  const source = read(COMPONENTS.hero);
  const imageTag = source.slice(source.indexOf('<Image'), source.indexOf('/>', source.indexOf('<Image')));

  // Es el elemento LCP de cada landing.
  it('carga la imagen sin diferir y con prioridad alta', () => {
    expect(imageTag).toMatch(/loading="eager"/);
    expect(imageTag).toMatch(/fetchpriority="high"/);
  });

  it('declara ambos atributos ANTES de {...image}, para que una página pueda sobrescribirlos', () => {
    const spread = imageTag.indexOf('{...image}');

    expect(spread).toBeGreaterThan(-1);
    expect(imageTag.indexOf('loading="eager"')).toBeLessThan(spread);
    expect(imageTag.indexOf('fetchpriority="high"')).toBeLessThan(spread);
  });

  it('conserva el tamaño reservado (sin salto de layout) y las props existentes', () => {
    expect(imageTag).toMatch(/width=\{1024\}/);
    expect(imageTag).toMatch(/height=\{576\}/);

    ['title', 'subtitle', 'tagline', 'content', 'actions', 'image', 'trust', 'id', 'bg'].forEach((prop) =>
      expect(frontmatterOf(COMPONENTS.hero)).toMatch(new RegExp(`\\b${prop}\\b`))
    );
  });
});

describe('RelatedLinks', () => {
  const source = read(COMPONENTS.related);
  const markup = markupOf(COMPONENTS.related);

  it('recibe la landing como prop tipada', () => {
    expect(source).toMatch(/import type \{ Landing \} from '~\/data\/landings';/);
    expect(source).toMatch(/landing: Landing;/);
  });

  it('es una sección con nombre accesible, cuyo H2 es "También te puede interesar"', () => {
    expect(markup).toMatch(/<section aria-labelledby=\{headingId\}>/);
    expect(markup).toMatch(/<h2\s+id=\{headingId\}/);
    expect(markup).toContain('También te puede interesar');
    expect(source).toMatch(/const headingId = '[a-z-]+'/);
  });

  it('toma contraparte, hermanas y hub del modelo testeado, no de lógica propia', () => {
    expect(source).toMatch(/relatedLinksFor\(landing\)/);
    expect(markup).toMatch(/pair\.heading/);
    expect(markup).toMatch(/hubLink\.label/);
  });

  it('el ancla de cada enlace es el nombre de la landing y debajo va su resumen', () => {
    expect(markup).toMatch(/\{pair\.landing\.name\}/);
    expect(markup).toMatch(/\{pair\.landing\.summary\}/);
    expect(markup).toMatch(/\{entry\.name\}/);
    expect(markup).toMatch(/\{entry\.summary\}/);
  });

  it('todos los enlaces salen de landingPath: ninguna ruta escrita a mano', () => {
    const hrefs = [...markup.matchAll(/href=\{([^}]+)\}/g)].map((match) => match[1]);

    expect(hrefs).toHaveLength(3);
    hrefs.forEach((href) => expect(href).toMatch(/^landingPath\(/));
    expect(markup).not.toMatch(/href="\//);
  });

  it('la tarjeta entera es clicable con un enlace extendido y el foco se ve en la tarjeta', () => {
    expect(markup.match(/after:absolute after:inset-0/g)?.length).toBeGreaterThanOrEqual(2);
    expect(markup).toMatch(/focus-within:ring-2/);
  });

  it('usa los widgets del sistema (WidgetWrapper) y respeta la jerarquía de títulos', () => {
    expect(source).toMatch(/import WidgetWrapper from '~\/components\/ui\/WidgetWrapper\.astro'/);
    expect(markup).not.toMatch(/<h1|<h4/);
  });

  it('no deja vacía la grilla de hermanas', () => {
    expect(markup).toMatch(/related\.length > 0/);
  });
});

describe('ServiceArea', () => {
  const source = read(COMPONENTS.area);
  const markup = markupOf(COMPONENTS.area);

  it('recibe el tipo de página (curso o servicio) y un mensaje opcional', () => {
    expect(source).toMatch(/import type \{ LandingKind \} from '~\/data\/landings';/);
    expect(source).toMatch(/kind: LandingKind;/);
    expect(source).toMatch(/message\?: string;/);
  });

  it('el texto sale de serviceAreaCopy (verificado), y el H2 es su título', () => {
    expect(source).toMatch(/serviceAreaCopy\(kind\)/);
    expect(markup).toMatch(/<h2[^>]*>\{copy\.title\}<\/h2>/);
  });

  it('incluye un botón de WhatsApp con ubicación "service-area"', () => {
    expect(source).toMatch(/import WhatsAppButton from '~\/components\/ui\/WhatsAppButton\.astro'/);
    expect(markup).toMatch(/<WhatsAppButton[^>]*location="service-area"/);
  });

  it('usa el mensaje de la página y, si falta, el genérico de su tipo', () => {
    expect(markup).toMatch(/message=\{message \?\? copy\.whatsappMessage\}/);
  });

  it('no escribe a mano nada que afirme una oficina, sede o dirección', () => {
    expect(markup).not.toMatch(/oficina|sede\b|dirección|visítanos|calle|carrera/i);
  });
});

describe('LeadForm (ClientRouter)', () => {
  const source = read(COMPONENTS.leadForm);
  const script = source.slice(source.lastIndexOf('<script>'));

  // Con el ClientRouter un script de módulo corre una vez por documento: sin esto,
  // el formulario de la página nueva se enviaba como un GET nativo y el lead se perdía.
  it('se enlaza en astro:page-load además de en la carga inicial', () => {
    expect(script).toMatch(/document\.addEventListener\('astro:page-load', initLeadForms\)/);
    expect(script).toMatch(/\n\s+initLeadForms\(\);/);
  });

  it('es idempotente: marca cada formulario con data-bound antes de enlazarlo', () => {
    expect(script).toMatch(/if \(!markBound\(wrapper\)\) return;/);
    expect(script.indexOf('markBound(wrapper)')).toBeLessThan(script.indexOf("form.addEventListener('submit'"));
  });

  it('enlaza cada instancia por separado (hero y pie de la misma página)', () => {
    expect(script).toMatch(/document\.querySelectorAll<HTMLElement>\('\[data-lead-form\]'\)\.forEach\(setupLeadForm\)/);
  });

  it('mide el lead SOLO cuando el servidor confirma el envío', () => {
    const ok = script.indexOf('if (result.ok)');

    expect(ok).toBeGreaterThan(-1);
    expect(script.match(/trackLead\(/g)).toHaveLength(1);
    expect(script.indexOf('trackLead(')).toBeGreaterThan(ok);
    expect(script).toMatch(/trackLead\(\{ interest: payload\.interest, formId \}\)/);
  });

  it('identifica el formulario para el dataLayer', () => {
    expect(source).toMatch(/data-form-id=\{id\}/);
    expect(script).toMatch(/wrapper\.dataset\.formId/);
  });

  it('el envío pasa por postJson: ni un fetch suelto ni excepciones sin capturar', () => {
    expect(script).toMatch(/postJson\('\/api\/contact', payload, LEAD_FORM_MESSAGES\)/);
    expect(stripComments(script)).not.toMatch(/\bfetch\(/);
  });

  it('sigue protegido contra bots (honeypot) y contra el doble envío', () => {
    expect(source).toMatch(/name="website"/);
    expect(script).toMatch(/if \(sending\) return;/);
  });

  it('el scroll al éxito respeta prefers-reduced-motion', () => {
    expect(script).toMatch(/prefers-reduced-motion: reduce/);
  });
});

/**
 * El desplegable tiene una opción por landing. La lógica de agrupar vive en
 * `groupInterestsBySilo` (tests/interests.test.ts); acá se comprueba que el
 * componente la use, pinte los <optgroup> y no pierda la opción preseleccionada.
 */
describe('LeadForm: desplegable de intereses agrupado por silo', () => {
  const source = read(COMPONENTS.leadForm);
  const frontmatter = frontmatterOf(COMPONENTS.leadForm);
  const markup = markupOf(COMPONENTS.leadForm);
  const select = markup.slice(markup.indexOf('<select'), markup.indexOf('</select>'));

  it('encuentra el desplegable de intereses', () => {
    expect(select).not.toBe('');
  });

  it('agrupa con groupInterestsBySilo() y no con la lista plana ni con opciones escritas a mano', () => {
    expect(source).toMatch(/import \{ groupInterestsBySilo \} from '~\/lib\/interests';/);
    expect(frontmatter).toMatch(/groupInterestsBySilo\(\)/);
    expect(source).not.toMatch(/\bINTERESTS\b/);
    // Solo el marcador vacío es literal: todas las demás opciones salen del registro.
    expect(select.match(/<option value="/g)).toHaveLength(1);
  });

  it('pinta un <optgroup> por silo, rotulado con el nombre del silo', () => {
    expect(select).toMatch(/interestGroups\.map\(\(group\) => \(\s*<optgroup label=\{group\.label\}>/);
    expect(select).toMatch(/group\.options\.map\(\(option\) => \(/);
    expect(select.match(/<optgroup /g)).toHaveLength(1);
    expect(select.match(/<\/optgroup>/g)).toHaveLength(1);
  });

  it('el marcador "Elige una opción" va primero y "Otro" suelto al final, fuera de los grupos', () => {
    const placeholder = select.indexOf('<option value="">Elige una opción</option>');
    const firstGroup = select.indexOf('<optgroup');
    const lastGroupEnd = select.lastIndexOf('</optgroup>');
    const other = select.indexOf('otherInterest.value');

    expect(placeholder).toBeGreaterThan(-1);
    expect(placeholder).toBeLessThan(firstGroup);
    expect(other).toBeGreaterThan(lastGroupEnd);
  });

  it('conserva el interés preseleccionado de la landing, y también cuando es "Otro"', () => {
    expect(frontmatter).toMatch(/interest = ''/);
    expect(select).toMatch(/<option value=\{option\.value\} selected=\{option\.value === interest\}>/);
    expect(select).toMatch(/<option value=\{otherInterest\.value\} selected=\{otherInterest\.value === interest\}>/);
  });

  it('el campo se sigue llamando "interest": el script y la API leen ese nombre', () => {
    expect(select).toMatch(/name="interest"/);
    expect(select).toMatch(/id=\{field\('interest'\)\}/);
    expect(source).toMatch(/valueOf\('interest'\)/);
  });
});

describe('formularios: sin promesas de plazo que el sitio no ha medido', () => {
  // contact.astro documenta que no se promete ningún plazo de respuesta. El pie del
  // formulario y el aviso de éxito decían "menos de 24 horas hábiles" en todas las páginas.
  it.each([
    ['LeadForm', COMPONENTS.leadForm],
    ['LeadCapture', COMPONENTS.leadCapture],
  ])('%s no anuncia un plazo de respuesta', (_name, file) => {
    const text = stripComments(markupOf(file) + frontmatterOf(file));

    expect(text).not.toMatch(/\d+\s*horas/i);
    expect(text).not.toMatch(/en menos de|dentro de las próximas/i);
  });

  it('LeadCapture promete por defecto lo mismo que el inicio y el contacto: sin plazo y sin "no compartimos"', () => {
    const bullets = frontmatterOf(COMPONENTS.leadCapture).match(/bullets = \[([\s\S]*?)\],/)?.[1] ?? '';

    expect(bullets).toContain('Tus datos no se venden ni se ceden a terceros');
    expect(bullets).not.toMatch(/No compartimos tus datos/);
  });
});

describe('AppointmentBooking (ClientRouter)', () => {
  const source = read(COMPONENTS.booking);
  const script = source.slice(source.lastIndexOf('<script>'));
  const markup = markupOf(COMPONENTS.booking).replace(script, '');

  it('se enlaza en astro:page-load además de en la carga inicial', () => {
    expect(script).toMatch(/document\.addEventListener\('astro:page-load', initBooking\)/);
    expect(script).toMatch(/\n\s+initBooking\(\);/);
  });

  it('ya no depende de DOMContentLoaded, que no se vuelve a disparar al navegar', () => {
    expect(stripComments(script)).not.toMatch(/DOMContentLoaded/);
  });

  it('es idempotente: marca el formulario con data-bound', () => {
    expect(script).toMatch(/if \(!appointmentForm \|\| !markBound\(appointmentForm\)\) return;/);
  });

  it('el estado vive dentro de initBooking, no en el módulo (cada navegación arranca de cero)', () => {
    const init = script.indexOf('const initBooking');

    expect(init).toBeGreaterThan(-1);
    ['let selectedDate', 'let selectedTime', 'let isSubmitting', 'const currentDate'].forEach((declaration) => {
      expect(script.indexOf(declaration)).toBeGreaterThan(init);
    });
  });

  it('mide la reserva como lead solo cuando la API confirma', () => {
    const ok = script.indexOf('if (result.ok)');

    expect(ok).toBeGreaterThan(-1);
    expect(script.match(/trackLead\(/g)).toHaveLength(1);
    expect(script.indexOf('trackLead(')).toBeGreaterThan(ok);
    expect(script).toMatch(/trackLead\(\{ interest: 'booking', formId: 'booking' \}\)/);
  });

  it('el envío pasa por postJson y decide por el cuerpo de la respuesta', () => {
    expect(script).toMatch(/postJson\('\/api\/appointments', payload, BOOKING_MESSAGES\)/);
    expect(stripComments(script)).not.toMatch(/response\.ok/);
  });

  it('las opciones de servicio salen del registro (SILOS + Otro), sin lista escrita a mano', () => {
    expect(source).toMatch(/import \{ SERVICE_TYPE_OPTIONS \} from '~\/utils\/booking';/);
    expect(markup).toMatch(/SERVICE_TYPE_OPTIONS\.map\(/);
    expect(markup.match(/<option value="/g)).toHaveLength(1); // solo el placeholder vacío
    expect(markup).not.toMatch(/Apps Multiplataforma|Capacitaciones Técnicas|Consultoría Digital/);
  });

  it('no usa window.event ni toISOString para la fecha', () => {
    expect(stripComments(script)).not.toMatch(/window\.event/);
    expect(stripComments(script)).not.toMatch(/toISOString/);
  });

  it('mantiene el honeypot', () => {
    expect(markup).toMatch(/name="website"/);
  });

  // Los botones del mes solo tienen un chevron (SVG): sin nombre accesible un
  // lector de pantalla anuncia "botón" a secas y no se sabe adónde lleva.
  it.each([
    ['prevMonth', 'Mes anterior'],
    ['nextMonth', 'Mes siguiente'],
  ])('el botón %s del calendario se llama "%s" y su icono es decorativo', (id, name) => {
    const button = markup.match(new RegExp(`<button[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? '';

    expect(button, `no se encontró el botón #${id}`).not.toBe('');
    expect(button).toContain(`aria-label="${name}"`);
    expect(button).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(button).toMatch(/\btype="button"/);
  });
});

/**
 * La agenda ofrece turnos en hora de Colombia, y el servidor los valida en esa misma hora
 * (tests/business-time.test.ts, tests/api.appointments.test.ts). El calendario tiene que
 * decidir qué día es "hoy" con la misma regla, no con el reloj del navegador, y avisar de la
 * zona a quien reserva desde otro país.
 */
describe('AppointmentBooking: hora de Colombia', () => {
  const source = read(COMPONENTS.booking);
  const script = stripComments(source.slice(source.lastIndexOf('<script>')));
  const markup = markupOf(COMPONENTS.booking).replace(source.slice(source.lastIndexOf('<script>')), '');

  it('decide qué días ya pasaron con el "hoy" de Colombia, no con el del navegador', () => {
    expect(script).toMatch(/import \{ BUSINESS_TIME_LABEL, businessDateOf \} from '~\/utils\/business-time';/);
    expect(script).toMatch(/const today = businessDateOf\(\);/);
    expect(script).toMatch(/if \(!isSelectableDay\(dayDate, today\)\) \{/);
    // La regla en sí (qué días se pueden elegir) está probada en tests/booking.test.ts.
    expect(script).not.toMatch(/dayDate\s*<\s*today|isPast/);
    // `new Date()` sin argumentos es el reloj del navegador.
    expect(script).not.toMatch(/new Date\(\)/);
  });

  it('arranca en el mes en que está Colombia', () => {
    expect(script).toMatch(/const \[todayYear, todayMonth\] = businessDateOf\(\)\.split\('-'\)\.map\(Number\);/);
    expect(script).toMatch(/const currentDate = new Date\(todayYear, todayMonth - 1, 1\);/);
  });

  it('avisa de que los horarios son de Colombia, bajo el título de los turnos', () => {
    expect(source).toMatch(/import \{ BUSINESS_TIME_LABEL \} from '~\/utils\/business-time';/);
    expect(markup).toContain('Horarios disponibles</h4>');
    expect(markup).toContain('Todos en {BUSINESS_TIME_LABEL} (UTC-5).');
    expect(markup.indexOf('Horarios disponibles')).toBeLessThan(markup.indexOf('Todos en {BUSINESS_TIME_LABEL}'));
  });

  it('la hora que se muestra al elegir un turno lleva el nombre de la zona', () => {
    expect(script).toMatch(/selectedTimeText\.textContent = `\$\{selectedTime\} \(\$\{BUSINESS_TIME_LABEL\}\)`;/);
  });

  it('manda al servidor solo fecha y hora elegidas, sin convertirlas a UTC', () => {
    expect(script).toMatch(/buildAppointmentPayload\(/);
    expect(script).not.toMatch(/getTimezoneOffset|toUTCString|Date\.UTC/);
  });
});

describe('copy del sitio: español de Colombia con "tú", sin voseo', () => {
  const owned = [
    ...Object.values(COMPONENTS),
    'src/pages/api/appointments.ts',
    'src/utils/tracking.ts',
    'src/utils/landings.ts',
    'src/utils/whatsapp.ts',
    'src/utils/forms.ts',
    'src/utils/booking.ts',
    'src/utils/service-area.ts',
  ].filter((file) => file !== COMPONENTS.header);

  it.each(owned)('%s no usa voseo', (file) => {
    expect(read(file)).not.toMatch(VOSEO);
  });

  it('el botón y el flotante no inventan promesas ni cifras', () => {
    [COMPONENTS.button, COMPONENTS.float, COMPONENTS.area, COMPONENTS.related].forEach((file) => {
      expect(markupOf(file)).not.toMatch(/garant|gratis|\d+\s*(horas|minutos|años)|mejor del|líder/i);
    });
  });

  it('LeadCapture ya no afirma una duración de llamada que contradice los turnos de una hora', () => {
    expect(read(COMPONENTS.leadCapture)).not.toMatch(/30 minutos/);
  });

  it('LeadForm y LeadCapture hablan de "tú"', () => {
    expect(read(COMPONENTS.leadForm)).toContain('¿Sobre qué quieres hablar?');
    expect(read(COMPONENTS.leadForm)).toContain('Elige una opción');
    expect(read(COMPONENTS.leadForm)).toContain('Cuéntanos brevemente qué necesitas');
    expect(read(COMPONENTS.leadCapture)).toContain('Cuéntanos qué necesitas');
    expect(read(COMPONENTS.leadCapture)).toContain('¿Prefieres hablar directamente?');
  });
});

describe('higiene de los componentes', () => {
  const astroFiles = Object.values(COMPONENTS).filter((file) => file.endsWith('.astro'));

  // El escáner de dependencias de Vite busca etiquetas de script con una expresión
  // regular y NO distingue un comentario: una mención literal dentro de uno de
  // ellos lo desorienta y rompe el arranque del servidor de desarrollo.
  it.each(astroFiles)('%s no menciona etiquetas de script dentro de comentarios', (file) => {
    const commentLines = read(file)
      .split('\n')
      .filter((line) => /^\s*(\*|\/\/|\/\*)/.test(line));

    commentLines.forEach((line) => expect(line).not.toMatch(/<\/?script/i));
  });

  it.each(astroFiles)('%s existe y no está vacío', (file) => {
    expect(existsSync(resolve(ROOT, file))).toBe(true);
    expect(read(file).trim().length).toBeGreaterThan(0);
  });
});
