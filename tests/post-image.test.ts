import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import { getSeoImageMeta } from '~/data/seo-images';
import { getPostImageAlt } from '~/utils/post-image';

/**
 * El alt de las portadas salía del título (tarjetas) o del extracto (artículo)
 * aunque el manifest de imágenes propias ya trae una descripción escrita a mano
 * de lo que se ve en la foto. Nada de esto falla un build: un alt malo se publica
 * igual, por eso se comprueba acá.
 */

const ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(ROOT, 'src/data/post');
const SEO_IMAGES_DIR = resolve(ROOT, 'src/assets/images/seo');

type PostImageInput = Parameters<typeof getPostImageAlt>[0];

// Portada propia real: así se ejercita también la lectura del manifest.
const COVER_KEY = 'blog-que-es-n8n';
const cover = getSeoImageMeta(COVER_KEY);
const COVER_PATH = `~/assets/images/seo/${cover?.file}`;

const EXTERNAL_COVER = 'https://images.unsplash.com/photo-1633265486064-086b219458ec?auto=format&fit=crop&w=2070&q=80';

const buildPost = (overrides: Partial<PostImageInput> = {}): PostImageInput => ({
  title: 'Qué es n8n y para qué sirve',
  excerpt: 'Extracto del artículo.',
  image: COVER_PATH,
  ...overrides,
});

describe('getPostImageAlt', () => {
  it('parte de una portada propia que existe en el manifest', () => {
    // Si alguien renombra o borra la clave, los demás tests del archivo dejarían de ser fiables.
    expect(cover, `falta "${COVER_KEY}" en src/data/seo-images`).toBeDefined();
    expect(cover?.alt.length).toBeGreaterThan(0);
  });

  describe('con una portada propia', () => {
    it('devuelve el alt curado del manifest', () => {
      expect(getPostImageAlt(buildPost())).toBe(cover?.alt);
    });

    it('no lo sustituye por el título', () => {
      const post = buildPost();

      expect(getPostImageAlt(post)).not.toBe(post.title);
    });

    it('devuelve el mismo alt curado sea cual sea el respaldo pedido', () => {
      const post = buildPost();

      expect(getPostImageAlt(post, 'title')).toBe(cover?.alt);
      expect(getPostImageAlt(post, 'excerpt')).toBe(cover?.alt);
    });

    it.each([
      ['alias de Astro', `~/assets/images/seo/${cover?.file}`],
      ['ruta absoluta de Vite', `/src/assets/images/seo/${cover?.file}`],
      ['ruta relativa', `../../assets/images/seo/${cover?.file}`],
    ])('la reconoce con la ruta como %s', (_forma, image) => {
      expect(getPostImageAlt(buildPost({ image }))).toBe(cover?.alt);
    });
  });

  describe('con una portada externa', () => {
    it('usa el título como respaldo por defecto (tarjetas y listados)', () => {
      const post = buildPost({ image: EXTERNAL_COVER });

      expect(getPostImageAlt(post)).toBe(post.title);
    });

    it('usa el extracto como respaldo en la página del artículo', () => {
      const post = buildPost({ image: EXTERNAL_COVER });

      expect(getPostImageAlt(post, 'excerpt')).toBe(post.excerpt);
    });

    it('devuelve cadena vacía si se pide el extracto y el artículo no lo tiene', () => {
      const post = buildPost({ image: EXTERNAL_COVER, excerpt: undefined });

      expect(getPostImageAlt(post, 'excerpt')).toBe('');
    });
  });

  describe('casos límite', () => {
    it('no inventa un alt para una portada propia que no está en el manifest', () => {
      const post = buildPost({ image: '~/assets/images/seo/blog-que-no-existe.jpg' });

      expect(getPostImageAlt(post)).toBe(post.title);
      expect(getPostImageAlt(post, 'excerpt')).toBe(post.excerpt);
    });

    it('cae al respaldo si el artículo no tiene portada', () => {
      const post = buildPost({ image: undefined });

      expect(getPostImageAlt(post)).toBe(post.title);
      expect(getPostImageAlt(post, 'excerpt')).toBe(post.excerpt);
    });

    it('cae al respaldo si la portada es una cadena vacía', () => {
      const post = buildPost({ image: '' });

      expect(getPostImageAlt(post)).toBe(post.title);
    });

    it('no lanza si la portada ya fue resuelta a ImageMetadata (sin nombre de archivo)', () => {
      const resolved = { src: '/_astro/blog-que-es-n8n.abc123.jpg', width: 1600, height: 900, format: 'jpg' } as const;
      const post = buildPost({ image: resolved });

      expect(() => getPostImageAlt(post)).not.toThrow();
      expect(getPostImageAlt(post)).toBe(post.title);
      expect(getPostImageAlt(post, 'excerpt')).toBe(post.excerpt);
    });
  });
});

describe('portadas propias de los artículos publicados', () => {
  type PostCover = { file: string; title: string; excerpt: string | undefined; image: string };

  const covers = readdirSync(POSTS_DIR)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const { data } = matter(readFileSync(resolve(POSTS_DIR, file), 'utf8'));

      return { file, title: data.title as string, excerpt: data.excerpt as string | undefined, image: data.image };
    })
    .filter((post): post is PostCover => typeof post.image === 'string' && post.image.includes('assets/images/seo/'));

  const cases = covers.map((post) => [post.file, post] as const);

  it.each(cases)('%s: el archivo de la portada existe', (_file, post) => {
    // findImage devuelve null si la ruta no existe y el artículo se publica sin portada, en silencio.
    expect(existsSync(resolve(SEO_IMAGES_DIR, basename(post.image)))).toBe(true);
  });

  it.each(cases)('%s: la portada tiene alt curado', (_file, post) => {
    const alt = getPostImageAlt({ title: post.title, excerpt: post.excerpt, image: post.image });

    expect(alt, `${post.image} no tiene entrada en src/data/seo-images`).not.toBe(post.title);
    expect(alt.length).toBeGreaterThan(0);
  });
});
