import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
import { HUBS, LANDINGS, SILOS, type SiloId } from '~/data/landings';
import { footerData, headerData } from '~/navigation';
import { getBlogPermalink } from '~/utils/permalinks';

/**
 * Header y footer salen del registro de landings. Registrar una landing nueva
 * tiene que bastar para que aparezca en los dos menús y en el lugar correcto;
 * y quitarla o renombrarla, para que desaparezca. Esto se comprueba contra el
 * registro, sin repetir la lista de páginas.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

interface MenuItem {
  text: string;
  href?: string;
  links?: MenuItem[];
}

const header = headerData.links as MenuItem[];
const footer = footerData.links as Array<{ title: string; links: MenuItem[] }>;

const SILO_IDS = Object.keys(SILOS) as SiloId[];
const landingsOf = (silo: SiloId) => LANDINGS.filter((landing) => landing.silo === silo);
const pair = ({ text, href }: MenuItem) => [text, href];

/** Todas las rutas de cada menú: desplegables incluidos. */
const hrefsOf = (items: MenuItem[]): string[] =>
  items.flatMap((item) => [...(item.href ? [item.href] : []), ...hrefsOf(item.links ?? [])]);
const countOf = (hrefs: string[], href: string) => hrefs.filter((candidate) => candidate === href).length;

const blogConfig = (yaml.load(read('src/config.yaml')) as { apps: { blog: { list: { pathname: string } } } }).apps.blog;

describe('header', () => {
  it('muestra un desplegable por silo y, al final, el blog', () => {
    expect(header.map((item) => item.text)).toEqual([...SILO_IDS.map((silo) => SILOS[silo].name), 'Blog']);
  });

  it('usa los nombres que se pidieron para el menú', () => {
    expect(header.map((item) => item.text)).toEqual([
      'Cursos',
      'Desarrollo',
      'IA y automatización',
      'Cloud y seguridad',
      'Marketing',
      'Blog',
    ]);
  });

  it('el blog es un enlace directo al índice del blog, sin desplegable', () => {
    const blog = header.at(-1)!;

    expect(blog.links).toBeUndefined();
    expect(blog.href).toBe(getBlogPermalink());
    // El permalink del blog sale de config.yaml: si cambia la ruta, el menú la sigue.
    expect(blogConfig.list.pathname).toBe('blog');
  });

  describe.each(SILO_IDS.map((silo) => [silo, SILOS[silo]] as const))('desplegable %s', (silo, { name, hub }) => {
    const dropdown = header.find((item) => item.text === name)!;

    it('existe', () => {
      expect(dropdown?.links?.length).toBeGreaterThan(1);
    });

    it('empieza por el enlace a su hub', () => {
      expect(dropdown.links![0].href).toBe(`/${hub}`);
    });

    it('lista todas las landings de su silo, en el orden del registro', () => {
      expect(dropdown.links!.slice(1).map(pair)).toEqual(
        landingsOf(silo).map((landing) => [landing.name, `/${landing.slug}`])
      );
    });

    it('no repite ningún enlace', () => {
      const hrefs = dropdown.links!.map((link) => link.href);

      expect(new Set(hrefs).size).toBe(hrefs.length);
    });
  });

  it.each([
    ['Cursos', 'Todos los cursos', '/clases-de-programacion'],
    ['Desarrollo', 'Todos los servicios', '/servicios'],
    ['IA y automatización', 'Todos los servicios', '/servicios'],
    ['Cloud y seguridad', 'Todos los servicios', '/servicios'],
    ['Marketing', 'Marketing digital', '/marketing-digital'],
  ])('el desplegable "%s" abre con "%s" → %s', (menu, text, href) => {
    expect(header.find((item) => item.text === menu)!.links![0]).toEqual({ text, href });
  });

  it('el menú de cursos incluye todas las landings de tipo curso y ninguna de servicio', () => {
    const courses = header.find((item) => item.text === 'Cursos')!.links!.slice(1);

    expect(courses.map((link) => link.href)).toEqual(
      LANDINGS.filter((landing) => landing.kind === 'curso').map((landing) => `/${landing.slug}`)
    );
  });

  it('cada landing del registro aparece exactamente una vez', () => {
    const hrefs = hrefsOf(header);

    LANDINGS.forEach((landing) => expect(countOf(hrefs, `/${landing.slug}`), landing.slug).toBe(1));
  });

  it('cada hub aparece en el menú', () => {
    const hrefs = hrefsOf(header);

    HUBS.forEach((hub) => expect(hrefs, hub.slug).toContain(`/${hub.slug}`));
  });

  it('todos los enlaces son rutas internas limpias o el blog', () => {
    hrefsOf(header).forEach((href) => expect(href).toMatch(/^\/[a-z0-9-]*(\/[a-z0-9-]+)*$/));
  });

  it('no enlaza a nada que no sea del registro ni el blog', () => {
    const known = new Set([
      '/blog',
      getBlogPermalink(),
      ...LANDINGS.map((l) => `/${l.slug}`),
      ...HUBS.map((h) => `/${h.slug}`),
    ]);

    hrefsOf(header).forEach((href) => expect(known.has(href), href).toBe(true));
  });

  it('la acción principal es la asesoría gratuita y lleva a /booking', () => {
    expect(headerData.actions).toHaveLength(1);
    expect(headerData.actions[0]).toMatchObject({ text: 'Asesoría gratuita', href: '/booking' });
  });
});

describe('footer', () => {
  it('tiene una columna por silo y una más de la empresa: seis en total', () => {
    expect(footer.map((column) => column.title)).toEqual([...SILO_IDS.map((silo) => SILOS[silo].name), BUSINESS.name]);
    expect(footer).toHaveLength(6);
  });

  describe.each(SILO_IDS.map((silo) => [silo, SILOS[silo].name] as const))('columna %s', (silo, name) => {
    const column = footer.find((candidate) => candidate.title === name)!;

    it('lista todas las landings de su silo, en el orden del registro', () => {
      expect(column.links.map(pair)).toEqual(landingsOf(silo).map((landing) => [landing.name, `/${landing.slug}`]));
    });
  });

  describe('columna de la empresa', () => {
    const company = footer.find((column) => column.title === BUSINESS.name)!;

    it('tiene los enlaces institucionales, en este orden', () => {
      expect(company.links.map(pair)).toEqual([
        ['Sobre Sonmyd', '/about'],
        ['Autor', '/autor'],
        ['Blog', getBlogPermalink()],
        ['Contacto', '/contact'],
        ['Agenda una asesoría', '/booking'],
        ['Privacidad', '/privacidad'],
        ['Términos', '/terminos'],
      ]);
    });
  });

  it('cada landing del registro aparece exactamente una vez', () => {
    const hrefs = hrefsOf(footer.flatMap((column) => column.links));

    LANDINGS.forEach((landing) => expect(countOf(hrefs, `/${landing.slug}`), landing.slug).toBe(1));
  });

  it('ninguna columna repite un enlace', () => {
    footer.forEach((column) => {
      const hrefs = column.links.map((link) => link.href);

      expect(new Set(hrefs).size, column.title).toBe(hrefs.length);
    });
  });

  describe('descripción con nombre, ciudad y teléfono', () => {
    it('es exactamente la línea acordada', () => {
      expect(footerData.description).toBe('Sonmyd · Medellín, Antioquia, Colombia · WhatsApp +57 310 604 1144');
    });

    it('sale de BUSINESS: si cambia el teléfono o la ciudad, el pie los sigue', () => {
      expect(footerData.description).toContain(BUSINESS.name);
      expect(footerData.description).toContain(BUSINESS.address.locality);
      expect(footerData.description).toContain(BUSINESS.address.region);
      expect(footerData.description).toContain(BUSINESS.telephone);
    });

    // El país se escribe por su nombre; si BUSINESS pasara a otro país, esta línea se quedaría desactualizada.
    it('Colombia es el país de BUSINESS', () => {
      expect(BUSINESS.address.country).toBe('CO');
    });
  });

  it('no enlaza a las páginas demo de la plantilla (/privacy, /terms)', () => {
    const everything = JSON.stringify([headerData, footerData]);

    expect(everything).not.toMatch(/"\/(en\/)?(privacy|terms)"/);
    expect(everything).not.toMatch(/\/privacy\b|\/terms\b/);
  });

  it('los enlaces legales apuntan a las páginas en español', () => {
    const hrefs = hrefsOf(footer.flatMap((column) => column.links));

    expect(hrefs).toContain('/privacidad');
    expect(hrefs).toContain('/terminos');
  });

  it('no repite los enlaces legales en una franja inferior aparte', () => {
    expect(footerData.secondaryLinks).toEqual([]);
  });

  // Un enlace a un perfil vacío daña más la confianza que la ausencia.
  it('no inventa redes sociales', () => {
    expect(footerData.socialLinks).toEqual([]);
  });

  it('cierra con el aviso de derechos del año en curso', () => {
    expect(footerData.footNote).toBe(`© ${new Date().getFullYear()} Sonmyd. Todos los derechos reservados.`);
  });
});

describe('las páginas a las que apuntan los menús existen', () => {
  // Las landings y los hubs ya los cubre tests/seo.silos.test.ts; acá van las sueltas.
  it.each(['/about', '/autor', '/contact', '/booking', '/privacidad', '/terminos'])('%s tiene su página', (href) => {
    expect(existsSync(resolve(ROOT, `src/pages${href}.astro`)), `falta src/pages${href}.astro`).toBe(true);
  });

  it('el blog tiene su índice', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/[...blog]/[...page].astro'))).toBe(true);
  });
});

describe('Header.astro', () => {
  const component = read('src/components/widgets/Header.astro');

  // Seis grupos y el botón de asesoría no entran en una fila por debajo de ~1200 px:
  // con el corte en md el menú se encimaba con el botón en los anchos intermedios.
  it('colapsa al menú móvil por debajo de xl (1280 px), no de md', () => {
    expect(component).not.toMatch(
      /\bmd:(flex|hidden|grid|absolute|static|w-auto|justify-self-center|flex-row|inline)\b/
    );
    expect(component).toMatch(/xl:grid xl:grid-cols-\[auto_1fr_auto\]/);
    expect(component).toMatch(/hidden xl:flex/);
    expect(component).toMatch(/flex items-center xl:hidden/);
  });

  it('la columna central del grid se ajusta al contenido, no a un tercio del ancho', () => {
    expect(component).not.toMatch(/grid-cols-3/);
  });

  // Cursos tiene once enlaces: en una ventana baja el desplegable tiene que poder desplazarse.
  it('los desplegables de escritorio tienen altura máxima y se desplazan', () => {
    expect(component).toMatch(/xl:max-h-\[calc\(100vh-[\d.]+rem\)\]/);
    expect(component).toMatch(/xl:overflow-y-auto/);
  });

  it('los desplegables tienen borde: en modo oscuro el fondo es igual al de la página', () => {
    expect(component).toMatch(/xl:border border-line/);
  });

  it('cierra el menú móvil abierto al cruzar el mismo corte, 1280 px', () => {
    expect(component).toMatch(/matchMedia\('\(min-width: 1280px\)'\)/);
    expect(component).toMatch(/\[data-aw-toggle-menu\]\.expanded/);
  });

  it('el corte del script coincide con el breakpoint xl de Tailwind', () => {
    const tailwind = read('tailwind.config.js');

    // Sin pantallas personalizadas, xl es el valor por defecto: 1280 px.
    expect(tailwind).not.toMatch(/screens\s*:/);
  });
});

describe('Footer.astro', () => {
  const component = read('src/components/widgets/Footer.astro');

  it('acomoda las seis columnas: de a dos en móvil, de a tres en tablet y en una fila desde lg', () => {
    expect(component).toMatch(/grid-cols-2/);
    expect(component).toMatch(/md:grid-cols-3/);
    expect(component).toMatch(/lg:grid-cols-6/);
  });

  it('la marca va arriba a todo el ancho y las columnas no compiten con ella', () => {
    expect(component).not.toMatch(/lg:col-span-4/);
  });

  it('solo pinta la franja inferior cuando tiene algo que mostrar', () => {
    expect(component).toMatch(/hasBottomBar/);
  });

  it('pinta la descripción con el teléfono que recibe, sin escribirlo a mano', () => {
    expect(component).not.toMatch(/\+57/);
    expect(component).toMatch(/description &&/);
  });

  /**
   * El botón flotante de WhatsApp está fijo en la esquina inferior derecha. Al llegar
   * al final de la página tapaba la franja inferior del pie, que es lo último que se
   * ve. Las medidas se leen del propio botón para que, si crece o se mueve, este test
   * avise de que el pie dejó de reservarle sitio.
   */
  describe('convivencia con el botón flotante de WhatsApp', () => {
    const REM = 16;
    const SPACING = 4; // 1 unidad de Tailwind = 0.25rem = 4 px

    const floatSource = read('src/components/common/WhatsAppFloat.astro');
    const floatClasses = floatSource.match(/class="([^"]+)"/)?.[1] ?? '';
    const pick = (classes: string, pattern: RegExp) => Number(classes.match(pattern)?.[1]) * SPACING;

    const floatHeight = pick(floatClasses, /(?<![:\w-])h-(\d+)\b/);
    const floatWidth = pick(floatClasses, /(?<![:\w-])w-(\d+)\b/);
    // bottom/right: max(1rem, env(safe-area-inset-*)). Sin viewport-fit=cover el inset vale 0.
    const floatOffset = Number(floatClasses.match(/bottom-\[max\((\d+)rem,/)?.[1]) * REM;

    const barClass = component.match(/const bottomBarClass =\s*'([^']+)'/)?.[1] ?? '';
    const classOf = (token: RegExp) => Number(barClass.match(token)?.[1]) * SPACING;

    it('lee las medidas del botón: 56 px de lado, a 16 px del borde', () => {
      expect(floatHeight).toBe(56);
      expect(floatWidth).toBe(56);
      expect(floatOffset).toBe(16);
    });

    it('la franja inferior se define en una constante y se usa en el pie', () => {
      expect(barClass).not.toBe('');
      expect(component).toMatch(/<div class=\{bottomBarClass\}>/);
    });

    it('en móvil deja más relleno inferior que lo que ocupa el botón: el último texto queda por encima', () => {
      const padding = classOf(/(?<![:\w-])pb-(\d+)\b/);

      expect(padding).toBeGreaterThanOrEqual(floatHeight + floatOffset);
    });

    it('desde md reserva a la derecha el ancho del botón, contando el relleno lateral del contenedor', () => {
      const reserved = classOf(/\bmd:pr-(\d+)\b/);
      const containerPadding = Number(component.match(/\bsm:px-(\d+)\b/)?.[1]) * SPACING;

      expect(reserved).toBeGreaterThan(0);
      expect(containerPadding + reserved).toBeGreaterThanOrEqual(floatWidth + floatOffset);
    });

    it('desde md vuelve al relleno inferior normal: ya no queda nada debajo del botón', () => {
      expect(barClass).toMatch(/\bmd:pb-6\b/);
      expect(barClass).toMatch(/\bmd:flex-row\b/);
    });

    // `py-6` junto a `pb-24` dependía del orden en que Tailwind emite las utilidades.
    it('no mezcla py-* con pb-*: usa pt-6 y pb-24 para que ningún orden de CSS cambie el resultado', () => {
      expect(barClass).not.toMatch(/(?<![:\w-])py-\d+/);
      expect(barClass).toMatch(/(?<![:\w-])pt-6\b/);
    });

    it('conserva el borde superior y el diseño en columna en móvil', () => {
      expect(barClass).toMatch(/\bborder-t\b/);
      expect(barClass).toMatch(/\bflex-col\b/);
      expect(barClass).toMatch(/\bmd:justify-between\b/);
    });

    it('sigue pintando la franja solo cuando hay algo que mostrar', () => {
      expect(component).toMatch(/hasBottomBar &&/);
    });
  });
});

describe('cableado en los layouts', () => {
  const layout = read('src/layouts/PageLayout.astro');

  it('PageLayout pinta el header y el footer con los datos de navigation.ts', () => {
    expect(layout).toMatch(/<Header\s+\{\.\.\.headerData\}/);
    expect(layout).toMatch(/<Footer\s+\{\.\.\.footerData\}/);
  });
});
