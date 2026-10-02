import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { HUBS, LANDINGS } from '~/data/landings';
import { landingMetadata } from '~/utils/landings';

/**
 * `landingMetadata` contra el manifiesto REAL de imágenes (sin simularlo).
 *
 * Por qué importa: `adaptOpenGraphImages` devuelve `url: ''` en silencio cuando
 * el archivo no existe, así que una landing podía publicarse sin imagen social
 * y ningún build ni render fallaba.
 *
 * El manifiesto de landings (`src/data/seo-images/landings.ts`) lo entrega otro
 * módulo; mientras no exista, esta suite se omite en lugar de fallar por algo
 * que `landingMetadata` no controla. Una vez presente, TODAS las entradas deben
 * resolver su imagen.
 */

const ROOT = resolve(__dirname, '..');
const manifestExists = existsSync(resolve(ROOT, 'src/data/seo-images/landings.ts'));

const entries = [...LANDINGS, ...HUBS].map((entry) => [entry.slug, entry] as const);

describe.skipIf(!manifestExists)('landingMetadata con el manifiesto real de imágenes', () => {
  it.each(entries)('%s tiene metadata de imagen social', (_slug, entry) => {
    expect(() => landingMetadata(entry)).not.toThrow();
  });

  it.each(entries)('%s apunta a un archivo que existe en src/assets/images/seo/', (_slug, entry) => {
    const [image] = landingMetadata(entry).openGraph?.images ?? [];

    expect(image.url).toMatch(/^~\/assets\/images\/seo\/[a-z0-9-]+\.jpg$/);
    expect(existsSync(resolve(ROOT, image.url.replace('~/', 'src/')))).toBe(true);
  });
});
