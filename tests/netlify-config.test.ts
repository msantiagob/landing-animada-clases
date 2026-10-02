import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '~/lib/security-headers';
import { read } from './source';

/**
 * netlify.toml. Las cabeceras de seguridad existen en dos lugares a propósito (el toml, para
 * lo que Netlify sirve como archivo, y el middleware, para lo que genera la función; ver
 * src/lib/security-headers.ts) y este test es el que comprueba que digan lo mismo: si se
 * agrega una cabecera en un lado y no en el otro, el blog prerenderizado y la API quedarían
 * con políticas distintas sin que nada lo avise.
 *
 * No hay un parser de TOML entre las dependencias del proyecto, así que se lee con expresiones
 * regulares sobre el archivo SIN comentarios (los comentarios del toml mencionan, por ejemplo,
 * la regla `/*  /index.html  200` justamente para decir que no hay que agregarla).
 */

const config = read('netlify.toml')
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

/** `Clave = "valor"` de cada línea de un bloque. */
const assignments = (block: string): Record<string, string> =>
  Object.fromEntries(
    [...block.matchAll(/^\s*([A-Za-z][\w-]*)\s*=\s*"([^"]*)"\s*$/gm)].map(([, key, value]) => [key, value])
  );

/** El contenido de una tabla: desde `[nombre]` hasta la siguiente tabla o el final. */
const tableBody = (name: string): string => {
  const header = config.indexOf(`[${name}]`);
  if (header === -1) return '';

  const rest = config.slice(header + name.length + 2);
  const next = rest.search(/^\s*\[/m);

  return next === -1 ? rest : rest.slice(0, next);
};

describe('netlify.toml: cabeceras de seguridad', () => {
  it('hay una sola regla de cabeceras y es para todo el sitio', () => {
    expect(config.match(/\[\[headers\]\]/g)).toHaveLength(1);
    expect(config).toMatch(/\[\[headers\]\]\s+for\s*=\s*"\/\*"/);
  });

  it('dice lo mismo que SECURITY_HEADERS: las mismas cabeceras con los mismos valores', () => {
    expect(assignments(tableBody('headers.values'))).toEqual(SECURITY_HEADERS);
  });

  it('no deja ninguna de las cuatro cabeceras fuera', () => {
    const declared = Object.keys(assignments(tableBody('headers.values'))).sort();

    expect(declared).toEqual(Object.keys(SECURITY_HEADERS).sort());
    expect(declared).toHaveLength(4);
  });
});

describe('netlify.toml: lo que el propio archivo prohíbe', () => {
  // Es el parche típico de las SPA y aquí convertiría cada URL inexistente en un 200 con la
  // portada (soft 404), que Search Console penaliza. Los 404 reales los resuelve src/pages/404.astro.
  it('no tiene una regla que mande todo a /index.html', () => {
    expect(config).not.toMatch(/index\.html/);
    expect(config).not.toMatch(/\[\[redirects\]\][^[]*status\s*=\s*200/);
  });
});

describe('netlify.toml: construcción', () => {
  const build = assignments(tableBody('build'));
  const environment = assignments(tableBody('build.environment'));
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; engines: { node: string } };

  it('construye con el script `build` del proyecto y publica `dist`, la carpeta por defecto de Astro', () => {
    expect(build.command).toBe('npm run build');
    expect(pkg.scripts).toHaveProperty('build');
    expect(build.publish).toBe('dist');
    // Si astro.config.ts cambiara `outDir`, Netlify publicaría una carpeta vacía.
    expect(read('astro.config.ts')).not.toMatch(/\boutDir\b/);
  });

  it('usa un Node que cumple el mínimo de package.json (las dependencias @netlify/* piden 22.12 o más)', () => {
    const minimum = pkg.engines.node.match(/(\d+)\.(\d+)/);

    expect(minimum).not.toBeNull();
    expect(Number(environment.NODE_VERSION)).toBeGreaterThanOrEqual(Number(minimum?.[1]));
  });
});
