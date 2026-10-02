import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import { getSeoImageMeta, getSeoImageMetaByPath, seoImageMeta } from '~/data/seo-images';

/**
 * Imágenes propias del sitio (portadas de landings, hubs, home y artículos).
 *
 * Se descargaron de Unsplash y viven en el repositorio para que Astro las
 * optimice. Todo lo que se comprueba acá falla en silencio: un archivo que no
 * existe revienta el render de la página que lo usa, un alt malo se publica
 * igual y una foto repetida en dos páginas diluye el valor de cada una.
 */

const ROOT = resolve(__dirname, '..');
const IMAGES_DIR = resolve(ROOT, 'src/assets/images/seo');
const POSTS_DIR = resolve(ROOT, 'src/data/post');

const SOURCE_PREFIX = 'https://unsplash.com/photos/';
const POST_IMAGE_PREFIX = '~/assets/images/seo/';

const entries = Object.entries(seoImageMeta);
const length = (text: string) => [...text].length;
const photoId = (sourceUrl: string) => sourceUrl.slice(SOURCE_PREFIX.length);

describe('manifiesto de imágenes', () => {
  it('tiene entradas', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('la clave de cada entrada es kebab-case', () => {
    entries.forEach(([key]) => expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('cada archivo se usa en una sola entrada', () => {
    // getSeoImageMetaByPath busca por nombre de archivo: dos claves con el mismo
    // archivo harían ambigua la portada de un artículo.
    const files = entries.map(([, meta]) => meta.file);

    expect(files.filter((file, index) => files.indexOf(file) !== index)).toEqual([]);
  });

  it('getSeoImageMeta devuelve la entrada de la clave y undefined si no existe', () => {
    const [key, meta] = entries[0];

    expect(getSeoImageMeta(key)).toBe(meta);
    expect(getSeoImageMeta('esta-clave-no-existe')).toBeUndefined();
  });
});

describe.each(entries)('imagen %s', (_key, meta) => {
  const path = resolve(IMAGES_DIR, meta.file);

  // getSeoImage usa import.meta.glob('*.jpg'): otro formato no se encuentra y la
  // página que lo pide lanza un error en tiempo de ejecución.
  it('es un .jpg con nombre en minúsculas', () => {
    expect(meta.file).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.jpg$/);
  });

  it('el archivo existe en src/assets/images/seo', () => {
    expect(existsSync(path), `falta ${meta.file}`).toBe(true);
  });

  it('mide 1600x900 en el manifiesto', () => {
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);
  });

  // Un ancho y un alto declarados que no coinciden con el archivo estiran la
  // imagen o provocan un salto de diseño al cargar.
  it.skipIf(!existsSync(path))('las medidas declaradas coinciden con las del archivo', async () => {
    const { default: sharp } = await import('sharp');
    const info = await sharp(path).metadata();

    expect({ format: info.format, width: info.width, height: info.height }).toEqual({
      format: 'jpeg',
      width: meta.width,
      height: meta.height,
    });
  });

  it('el alt mide entre 60 y 125 caracteres', () => {
    expect(length(meta.alt)).toBeGreaterThanOrEqual(60);
    expect(length(meta.alt)).toBeLessThanOrEqual(125);
  });

  // Los lectores de pantalla ya anuncian que es una imagen.
  it('el alt no empieza con "imagen", "foto" ni "fotografía"', () => {
    expect(meta.alt).not.toMatch(/^\s*(imagen|foto|fotografía|photo|image|picture)(?![\p{L}])/iu);
  });

  it('el alt no queda vacío de contenido: tiene al menos cinco palabras', () => {
    expect(meta.alt.trim().split(/\s+/).length).toBeGreaterThanOrEqual(5);
  });

  it('la fuente es una página de foto de Unsplash', () => {
    expect(meta.sourceUrl.startsWith(SOURCE_PREFIX)).toBe(true);
    expect(photoId(meta.sourceUrl)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('la licencia es Unsplash License', () => {
    expect(meta.license).toBe('Unsplash License');
  });

  it('atribuye al autor con su perfil de Unsplash', () => {
    expect(meta.author.trim()).not.toBe('');
    expect(meta.authorUrl).toMatch(/^https:\/\/unsplash\.com\/@[A-Za-z0-9._-]+$/);
  });
});

describe('unicidad entre imágenes', () => {
  it('no hay dos imágenes con el mismo alt', () => {
    const alts = entries.map(([, meta]) => meta.alt.trim().toLowerCase());
    const repeated = alts.filter((alt, index) => alts.indexOf(alt) !== index);

    expect(repeated).toEqual([]);
  });

  // La misma foto en dos páginas distintas resta valor a ambas y se nota.
  it('no se usa la misma foto de Unsplash en dos entradas', () => {
    const ids = entries.map(([, meta]) => photoId(meta.sourceUrl));
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(repeated).toEqual([]);
  });
});

describe('archivos de src/assets/images/seo', () => {
  const files = readdirSync(IMAGES_DIR).filter((file) => !file.startsWith('.'));
  const declared = new Set(entries.map(([, meta]) => meta.file));

  it('hay imágenes en la carpeta', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Una imagen sin entrada no tiene alt ni atribución, y pesa en el repositorio sin usarse.
  it.each(files)('%s tiene su entrada en el manifiesto', (file) => {
    expect(declared.has(file), `${file} no figura en src/data/seo-images`).toBe(true);
  });
});

describe('portadas de los artículos', () => {
  const posts = readdirSync(POSTS_DIR)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const { data } = matter(readFileSync(resolve(POSTS_DIR, file), 'utf8'));

      return { file, image: typeof data.image === 'string' ? data.image : undefined };
    });

  const own = posts.filter((post) => post.image?.startsWith(POST_IMAGE_PREFIX));

  it('lee la portada de los artículos', () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it.each(own.map((post) => [post.file, post.image] as const))(
    '%s: la portada %s tiene entrada en el manifiesto',
    (_file, image) => {
      const meta = getSeoImageMetaByPath(image);

      expect(meta, `${image} no está en src/data/seo-images`).toBeDefined();
      expect(existsSync(resolve(IMAGES_DIR, meta!.file)), `falta ${meta?.file}`).toBe(true);
    }
  );

  it('getSeoImageMetaByPath resuelve la ruta con el alias de Astro', () => {
    const [, meta] = entries[0];

    expect(getSeoImageMetaByPath(`${POST_IMAGE_PREFIX}${meta.file}`)).toBe(meta);
  });

  it.each([
    ['indefinida', undefined],
    ['vacía', ''],
    ['de un archivo que no está en el manifiesto', `${POST_IMAGE_PREFIX}no-existe.jpg`],
    ['externa', 'https://images.unsplash.com/photo-1633265486064-086b219458ec?auto=format'],
  ])('getSeoImageMetaByPath devuelve undefined para una ruta %s', (_caso, path) => {
    expect(getSeoImageMetaByPath(path)).toBeUndefined();
  });
});
