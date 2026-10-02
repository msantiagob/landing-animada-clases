import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';

/**
 * La pantalla de acceso al panel. Los .astro no se pueden importar desde Vitest,
 * así que se lee el código fuente.
 *
 * Dos restos que ningún build detecta: el correo de ejemplo apuntaba al dominio
 * que no recibe correo (sonmyd.com no tiene registros MX) y el año del pie
 * estaba escrito a mano.
 */

const ROOT = resolve(__dirname, '..');
const source = readFileSync(resolve(ROOT, 'src/pages/admin/login.astro'), 'utf8');

const [, frontmatter = '', ...rest] = source.split(/^---$/m);
const markup = rest.join('---');

/** El dominio del negocio sin esquema: `sonmyd.co`. */
const DOMAIN = new URL(BUSINESS.url).hostname;

describe('admin/login.astro: correo de ejemplo', () => {
  const placeholder = markup.match(/<input[^>]*type="email"[^>]*placeholder="([^"]+)"/s)?.[1];

  it('encuentra el campo de correo', () => {
    expect(placeholder).toBeDefined();
  });

  it('es una dirección del dominio del negocio: admin@sonmyd.co', () => {
    expect(DOMAIN).toBe('sonmyd.co');
    expect(placeholder).toBe(`admin@${DOMAIN}`);
  });

  it('ninguna dirección de la página usa el dominio anterior', () => {
    expect(source).not.toMatch(/@sonmyd\.com\b/);
  });
});

describe('admin/login.astro: año del pie', () => {
  it('se calcula al renderizar con new Date().getFullYear()', () => {
    expect(frontmatter).toMatch(/const year = new Date\(\)\.getFullYear\(\);/);
  });

  it('el pie imprime ese valor y no un año escrito a mano', () => {
    expect(markup).toMatch(/©\s*\{year\}\s*Sonmyd/);
    expect(markup).not.toMatch(/©\s*\d{4}/);
    expect(source).not.toMatch(/©\s*20\d\d/);
  });

  // Prerenderizada, la página se construiría una sola vez y el año quedaría congelado.
  it('la página no se prerenderiza: el año se calcula en cada petición', () => {
    expect(frontmatter).toMatch(/export const prerender = false;/);
  });

  it('el pie sigue diciendo que es el panel de administración', () => {
    expect(markup).toMatch(/Panel de administración seguro/);
  });
});

describe('admin/login.astro: sigue siendo una página privada', () => {
  it('no se indexa', () => {
    expect(markup).toMatch(/<meta name="robots" content="noindex, nofollow" \/>/);
  });

  it('redirige al panel a quien ya tiene sesión', () => {
    expect(frontmatter).toMatch(/requireAuthFromCookies\(Astro\.request\)/);
    expect(frontmatter).toMatch(/Astro\.redirect\('\/admin\/dashboard'\)/);
  });
});
