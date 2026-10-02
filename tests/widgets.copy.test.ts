import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { BOOKING_DURATION_MINUTES } from '~/utils/booking';
import { findVoseo } from './voseo';

/**
 * Copy que no tiene otro test propio: la barra de anuncio que aparece en todas
 * las páginas, los bloques de artículos del blog y los avisos del panel.
 *
 * Los .astro no se pueden importar desde Vitest, así que se lee el código fuente.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Un .astro es `---\nfrontmatter\n---\nplantilla`. */
const frontmatterOf = (path: string) => read(path).split(/^---$/m)[1] ?? '';

/** Valor por defecto de una prop desestructurada: `text = '...'`. */
const defaultOf = (frontmatter: string, prop: string) => frontmatter.match(new RegExp(`\\b${prop} = '([^']*)'`))?.[1];

describe('Announcement (barra de anuncio)', () => {
  const frontmatter = frontmatterOf('src/components/widgets/Announcement.astro');
  const text = defaultOf(frontmatter, 'text') ?? '';

  it('encuentra el texto por defecto', () => {
    expect(text).not.toBe('');
  });

  it('invita a agendar una llamada sin costo, con el imperativo de "tú"', () => {
    expect(text).toMatch(/^Agenda /);
    expect(text).toMatch(/\bllamada sin costo\b/);
    expect(findVoseo(text)).toEqual([]);
  });

  // La API agenda turnos de una hora. Anunciar "30 minutos" en cada página del
  // sitio contradecía la reserva a la que lleva el enlace.
  it('no promete una duración distinta de la del turno de reserva', () => {
    const minutos = [...text.matchAll(/(\d+)\s*min/gi)].map(([, cantidad]) => Number(cantidad));

    expect(BOOKING_DURATION_MINUTES).toBe(60);
    minutos.forEach((cantidad) => expect(cantidad).toBe(BOOKING_DURATION_MINUTES));
    expect(text).not.toMatch(/media hora/i);
  });

  it('lleva a la página de reserva por defecto', () => {
    expect(defaultOf(frontmatter, 'href')).toBe('/booking');
  });
});

describe('widgets de artículos del blog', () => {
  const WIDGETS = ['BlogHighlightedPosts', 'BlogLatestPosts'];
  const linkTextOf = (name: string) => defaultOf(frontmatterOf(`src/components/widgets/${name}.astro`), 'linkText');

  // "Posts" es anglicismo: en el sitio son "artículos".
  it.each(WIDGETS)('%s ofrece "Ver todos los artículos" por defecto', (name) => {
    expect(linkTextOf(name)).toBe('Ver todos los artículos');
  });

  it('repiten la redacción del bloque de relacionados, para que el enlace diga lo mismo en todo el sitio', () => {
    const related = read('src/components/blog/RelatedPosts.astro').match(/linkText="([^"]+)"/)?.[1];

    expect(related).toBeDefined();
    WIDGETS.forEach((name) => expect(linkTextOf(name)).toBe(related));
  });
});

describe('panel de administración', () => {
  const dashboard = read('src/pages/admin/dashboard.astro');

  /**
   * Los textos fijos que el panel puede mostrar como aviso: los que se pasan literales
   * a `showError()` y el motivo por defecto al cambiar un estado (`let reason = '...'`).
   *
   * Al cambiar un estado, si el servidor explica por qué lo rechazó (p. ej. un 409 porque
   * el horario de una cita cancelada ya lo tomó otra) el panel muestra ESE motivo en vez
   * del genérico. Esos textos viven en la API: tests/api.admin.leads.test.ts comprueba
   * cada uno, palabra por palabra y sin voseo.
   */
  const avisos = [
    ...dashboard.matchAll(/showError\('([^']+)'\)/g),
    ...dashboard.matchAll(/\blet reason = '([^']+)'/g),
  ].map(([, aviso]) => aviso);

  it('encuentra los avisos que muestra el panel', () => {
    expect(avisos.length).toBeGreaterThanOrEqual(2);
  });

  it('si no cargan los datos, pide recargar la página hablándole de "tú"', () => {
    expect(avisos).toContain('No se pudieron cargar los datos. Recarga la página.');
  });

  it('si falla un cambio de estado y el servidor no da el motivo, avisa de que no se pudo actualizar', () => {
    expect(avisos).toContain('No se pudo actualizar el estado.');
  });

  it.each(avisos)('el aviso "%s" no usa voseo', (aviso) => {
    expect(findVoseo(aviso)).toEqual([]);
  });

  // Si el panel descartara el motivo del servidor, ante un 409 quien administra vería un
  // genérico y no sabría por qué la cita no se reactiva.
  it('al fallar un cambio de estado muestra el motivo del servidor, y el genérico solo si no hay ninguno', () => {
    expect(dashboard).toMatch(/reason = result\.error \|\| reason;/);
    expect(dashboard).toMatch(/showError\(reason\)/);
  });

  // Ahora el aviso puede llevar texto que viene del servidor: tiene que pintarse como texto.
  it('pinta el aviso con textContent y no con innerHTML', () => {
    const showError = dashboard.match(/const showError = [\s\S]*?\n\s*\};/)?.[0] ?? '';

    expect(showError).toMatch(/\.textContent = message;/);
    expect(showError).not.toMatch(/innerHTML/);
  });

  // Las fechas se guardan en UTC. Con `toLocaleString` a secas se mostraban en la zona del navegador
  // de quien mira (y en un servidor, en la del servidor): la hora del negocio es la de Colombia.
  // El formato en sí está probado en tests/business-time.test.ts, con el proceso en varias zonas.
  describe('fechas y horas: siempre en hora de Colombia', () => {
    it('formatea el instante de cada contacto con formatBusinessDateTime', () => {
      expect(dashboard).toMatch(/import \{ formatBusinessDateTime \} from '~\/utils\/business-time';/);
      expect(dashboard).toMatch(/const formatDate = \(value: string\): string => formatBusinessDateTime\(value\);/);
      expect(dashboard).toMatch(/escapeHtml\(formatDate\(row\.created_at\)\)/);
    });

    it('no formatea nada con la zona del navegador', () => {
      expect(dashboard).not.toMatch(/toLocale(?:Date|Time)?String\(/);
      expect(dashboard).not.toMatch(/Intl\.DateTimeFormat/);
    });

    it('las citas muestran la fecha y la hora tal como se eligieron (ya son de Colombia), sin pasar por un Date', () => {
      expect(dashboard).toMatch(/escapeHtml\(row\.date\)/);
      expect(dashboard).toMatch(/escapeHtml\(row\.time\)/);
      expect(dashboard).not.toMatch(/new Date\(row\.(?:date|time)/);
    });

    it('rotula las columnas con la zona, para quien mira el panel desde otro país', () => {
      expect(dashboard).toContain('<th class="px-4 py-3">Fecha (hora de Colombia)</th>');
      expect(dashboard).toContain('<th class="px-4 py-3">Hora (Colombia)</th>');
    });
  });
});
