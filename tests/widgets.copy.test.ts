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
  const avisos = [...dashboard.matchAll(/showError\('([^']+)'\)/g)].map(([, aviso]) => aviso);

  it('encuentra los avisos que muestra el panel', () => {
    expect(avisos.length).toBeGreaterThanOrEqual(2);
  });

  it('si no cargan los datos, pide recargar la página hablándole de "tú"', () => {
    expect(avisos).toContain('No se pudieron cargar los datos. Recarga la página.');
  });

  it.each(avisos)('el aviso "%s" no usa voseo', (aviso) => {
    expect(findVoseo(aviso)).toEqual([]);
  });
});
