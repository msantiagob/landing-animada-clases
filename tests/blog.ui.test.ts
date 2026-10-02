import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { findVoseo } from './voseo';

/**
 * Guardas de la interfaz del blog (componentes y páginas).
 *
 * El blog heredó de la plantilla AstroWind textos en inglés ("Back to Blog",
 * "min read", "Newer posts", "Category '...'") y un copy con voseo. Ninguno
 * rompe el build, y el inglés en un sitio en español se publica en el <title> de
 * páginas indexables. Los componentes .astro no se pueden renderizar desde
 * Vitest sin levantar Astro, así que, como en el resto de la suite, se inspecciona
 * el código fuente.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

const listAstro = (dir: string): string[] =>
  (readdirSync(resolve(ROOT, dir), { recursive: true }) as string[])
    .filter((file) => file.endsWith('.astro'))
    .map((file) => `${dir}/${file}`);

const UI_FILES = [...listAstro('src/components/blog'), ...listAstro('src/pages/[...blog]')];

const CATEGORY_PAGE = 'src/pages/[...blog]/[category]/[...page].astro';
const TAG_PAGE = 'src/pages/[...blog]/[tag]/[...page].astro';
const INDEX_PAGE = 'src/pages/[...blog]/[...page].astro';
const POST_PAGE = 'src/pages/[...blog]/index.astro';

const config = yaml.load(read('src/config.yaml')) as {
  apps: { blog: { category: { robots: { index: boolean } }; tag: { robots: { index: boolean } } } };
};

describe('archivos de la interfaz del blog', () => {
  it('se encontraron los componentes y las páginas', () => {
    expect(UI_FILES.length).toBeGreaterThanOrEqual(15);
    expect(UI_FILES).toContain(CATEGORY_PAGE);
    expect(UI_FILES).toContain('src/components/blog/SinglePost.astro');
  });
});

describe('textos en español', () => {
  const INGLES: Array<[string, RegExp]> = [
    ['Back to Blog', /Back to Blog/i],
    ['min read', /\bmin read\b/i],
    ['Newer posts', /Newer posts/i],
    ['Older posts', /Older posts/i],
    ['Posts by tag', /Posts by tag/i],
    ["Category '", /Category '/],
    ['Related posts', /Related posts/i],
    ['Tag:', /\bTag:/],
    ['Page N', /\bPage (\d|\$\{)/],
  ];

  it.each(UI_FILES)('%s no conserva textos en inglés de la plantilla', (file) => {
    const source = read(file);

    INGLES.forEach(([nombre, pattern]) => {
      expect(source, `${file} todavía dice "${nombre}"`).not.toMatch(pattern);
    });
  });

  it.each(UI_FILES)('%s no tiene voseo', (file) => {
    expect(findVoseo(read(file))).toEqual([]);
  });

  it.each([
    ['src/components/blog/ToBlogLink.astro', 'Volver al blog'],
    ['src/components/blog/SinglePost.astro', 'min de lectura'],
    ['src/components/blog/Pagination.astro', 'Artículos más recientes'],
    ['src/components/blog/Pagination.astro', 'Artículos anteriores'],
    ['src/components/blog/RelatedPosts.astro', 'Artículos relacionados'],
    ['src/components/blog/RelatedPosts.astro', 'Ver todos los artículos'],
    ['src/components/blog/AuthorBox.astro', 'Escríbenos'],
  ])('%s dice "%s"', (file, text) => {
    expect(read(file)).toContain(text);
  });

  // "Posts" es anglicismo y "Posts Relacionados" mezcla idiomas: en el sitio son "artículos".
  it('el bloque de relacionados llama "artículos" a los posts en lo que se ve', () => {
    const source = read('src/components/blog/RelatedPosts.astro');
    const visibles = [...source.matchAll(/(?:title|linkText)="([^"]+)"/g)].map(([, text]) => text);

    expect(visibles).toHaveLength(2);
    visibles.forEach((text) => expect(text).not.toMatch(/posts?/i));
  });
});

describe('alt de las portadas', () => {
  it.each(['src/components/blog/GridItem.astro', 'src/components/blog/ListItem.astro'])(
    '%s usa getPostImageAlt y no el título como alt',
    (file) => {
      const source = read(file);

      expect(source).toMatch(/import \{ getPostImageAlt \} from '~\/utils\/post-image'/);
      expect(source).toMatch(/const imageAlt = getPostImageAlt\(post\)/);
      expect(source).toMatch(/alt=\{imageAlt\}/);
      expect(source).not.toMatch(/alt=\{post\.title\}/);
    }
  );

  it('SinglePost recibe el alt ya calculado y conserva el extracto como respaldo', () => {
    const source = read('src/components/blog/SinglePost.astro');

    expect(source).toMatch(/imageAlt\?: string/);
    expect(source).toMatch(/alt=\{imageAlt \?\? post\?\.excerpt \?\? ''\}/);
  });

  // En SinglePost la portada llega resuelta por findImage (sin nombre de archivo): el alt
  // tiene que calcularse en la página, con el valor original del frontmatter.
  it('la página del artículo calcula el alt desde post.image sin resolver y se lo pasa a SinglePost', () => {
    const source = read(POST_PAGE);

    expect(source).toMatch(/const imageAlt = getPostImageAlt\(post, 'excerpt'\)/);
    expect(source).toMatch(/<SinglePost [^>]*imageAlt=\{imageAlt\}/);
  });
});

describe('páginas de categoría', () => {
  const source = read(CATEGORY_PAGE);

  it('arman título y descripción propios en español', () => {
    expect(source).toMatch(/getCategorySeo\(category, currentPage\)/);
    expect(source).toMatch(/title: seo\.title/);
    expect(source).toMatch(/description: seo\.description/);
  });

  it('controlan el título completo en lugar de dejar que la plantilla lo alargue', () => {
    expect(source).toMatch(/ignoreTitleTemplate: true/);
  });

  it('muestran el encabezado y la descripción de la categoría', () => {
    expect(source).toMatch(/\{seo\.heading\}/);
    expect(source).toMatch(/getCategoryDescription\(category\)/);
  });

  it('toman la indexación de la configuración y no la fijan a mano', () => {
    expect(source).toMatch(/index: blogCategoryRobots\?\.index/);
    expect(source).toMatch(/follow: blogCategoryRobots\?\.follow/);
  });

  it('config.yaml sigue indexando las categorías', () => {
    expect(config.apps.blog.category.robots.index).toBe(true);
  });
});

describe('páginas de etiqueta', () => {
  const source = read(TAG_PAGE);

  it('arman título y descripción propios en español', () => {
    expect(source).toMatch(/getTagSeo\(tag, currentPage\)/);
    expect(source).toMatch(/title: seo\.title/);
    expect(source).toMatch(/description: seo\.description/);
    expect(source).toMatch(/\{seo\.heading\}/);
  });

  it('siguen sin indexarse: toman la regla de la configuración', () => {
    expect(source).toMatch(/index: blogTagRobots\?\.index/);
    expect(source).not.toMatch(/index:\s*true/);
    expect(config.apps.blog.tag.robots.index).toBe(false);
  });
});

describe('índice del blog', () => {
  const source = read(INDEX_PAGE);

  it('toma título y descripción de getBlogIndexSeo', () => {
    expect(source).toMatch(/\.\.\.getBlogIndexSeo\(currentPage\)/);
    expect(source).toMatch(/ignoreTitleTemplate: true/);
  });

  it('el H1 es el título del blog', () => {
    expect(source).toMatch(/<h1[^>]*>\{BLOG_INDEX_TITLE\}<\/h1>/);
  });

  it('ya no tiene una lista de temas escrita a mano', () => {
    expect(source).not.toMatch(/const TEMAS/);
    expect(source).toMatch(/getBlogTopics\(\)/);
  });

  it('enlaza a los hubs desde la cabecera', () => {
    expect(source).toMatch(/topics\.hubs\.map/);
  });

  it('el directorio de cursos y servicios agrupa las landings por silo', () => {
    expect(source).toMatch(/topics\.groups\.map/);
    expect(source).toMatch(/group\.links\.map/);
  });

  it('el JSON-LD declara los mismos enlaces que se ven en pantalla', () => {
    expect(source).toMatch(/itemListSchema\(flattenBlogTopics\(topics\)\)/);
  });

  it('el directorio solo aparece en la primera página', () => {
    expect(source).toMatch(/currentPage === 1 &&/);
  });
});
