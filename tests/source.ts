import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BUSINESS } from '~/data/business';

/**
 * Lectura del código fuente de las páginas para los tests de copy y SEO.
 *
 * Los .astro no se pueden importar desde Vitest, así que se leen como texto. Esto
 * no es un analizador de Astro: separa el frontmatter de la plantilla y saca el
 * texto que ve una persona, lo justo para comprobar qué dice y qué enlaza cada página.
 */

export const ROOT = resolve(__dirname, '..');

export const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

/** Un .astro es `---\nfrontmatter\n---\nplantilla`. */
export const parts = (source: string): { frontmatter: string; markup: string } => {
  const [, frontmatter = '', ...markup] = source.split(/^---$/m);
  return { frontmatter, markup: markup.join('---') };
};

/** Un archivo .astro ya separado: `{ source, frontmatter, markup }`. */
export const astroSource = (path: string) => {
  const source = read(path);
  return { source, ...parts(source) };
};

/** Una página de `src/pages` ya separada. */
export const pageSource = (name: string) => astroSource(`src/pages/${name}.astro`);

/** Nombre del país tal como lo escriben las páginas (`BUSINESS.address.country` es el código ISO). */
const COUNTRY_NAME = 'Colombia';

/**
 * Lo que se lee en pantalla: sin scripts, comentarios ni etiquetas, con las
 * expresiones que salen de BUSINESS resueltas y los espacios normalizados.
 */
export const visibleText = (markup: string): string =>
  markup
    .replace(/\{BUSINESS\.telephone\}/g, BUSINESS.telephone)
    .replace(/\{BUSINESS\.name\}/g, BUSINESS.name)
    .replace(/\{BUSINESS\.address\.locality\}/g, BUSINESS.address.locality)
    .replace(/\{BUSINESS\.address\.region\}/g, BUSINESS.address.region)
    .replace(/\{COUNTRY_NAME\}/g, COUNTRY_NAME)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:)])/g, '$1')
    .replace(/\( /g, '(')
    .trim();

/** Fragmento de la plantilla desde la primera aparición de `open` hasta la siguiente de `close` (incluida). */
export const block = (markup: string, open: string, close: string): string => {
  const start = markup.indexOf(open);
  if (start === -1) return '';

  const end = markup.indexOf(close, start);
  return end === -1 ? '' : markup.slice(start, end + close.length);
};

export interface PageMetadata {
  title: string;
  description: string;
  /** `'PATH'` cuando la página usa su constante, o la ruta literal (`'/'`). */
  canonical: string;
  ignoreTitleTemplate: boolean;
}

/** Los campos del objeto `metadata` que la página le pasa al layout. */
export const metadataOf = (frontmatter: string): PageMetadata => ({
  title: frontmatter.match(/\btitle: '([^']+)'/)?.[1] ?? '',
  description: frontmatter.match(/\bdescription:\s*'([^']+)'/)?.[1] ?? '',
  canonical:
    frontmatter
      .match(/\bcanonical: (?:([A-Z_]+)|'([^']+)')/)
      ?.slice(1)
      .find(Boolean) ?? '',
  ignoreTitleTemplate: /ignoreTitleTemplate: true/.test(frontmatter),
});

/** Longitud en caracteres (no en unidades UTF-16), que es como la mide Google. */
export const length = (text: string): number => [...text].length;

/** El código sin comentarios: lo que de verdad se publica o se ejecuta. */
export const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * Props que llevan texto para las personas: `title="..."`, `description: '...'`,
 * `text: '...'`... Los widgets reciben su copy así (`<Features items={[...]} />` es
 * UNA sola etiqueta), por lo que `visibleText` no lo ve.
 */
const COPY_PROP =
  /\b(?:title|subtitle|tagline|description|text|label|button|question|answer|message|alt)\s*[:=]\s*\{?\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;

export const copyProps = (code: string): string[] =>
  [...code.matchAll(COPY_PROP)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');

/**
 * TODO el texto que una persona puede leer en una página: lo que pintan las
 * etiquetas más el copy que viaja en las props de los widgets, sin comentarios.
 */
export const copyOf = ({ frontmatter, markup }: { frontmatter: string; markup: string }): string =>
  [visibleText(withoutComments(markup)), ...copyProps(withoutComments(frontmatter + markup))].join(' ');
