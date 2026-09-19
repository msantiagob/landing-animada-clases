import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

/**
 * Guardas de contenido: el sitio arrastraba los posts de demostración de la
 * plantilla AstroWind y el token de verificación de Google de onwidget. Ambos
 * se publicaban en sonmyd.com. Estos tests impiden que vuelvan a entrar.
 */

const ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(ROOT, 'src/data/post');

type SiteConfig = {
  site: { googleSiteVerificationId?: string };
  apps: { blog: { isEnabled: boolean } };
};

const config = yaml.load(readFileSync(resolve(ROOT, 'src/config.yaml'), 'utf8')) as SiteConfig;
const navigation = readFileSync(resolve(ROOT, 'src/navigation.ts'), 'utf8');

const listPosts = () => (existsSync(POSTS_DIR) ? readdirSync(POSTS_DIR).filter((file) => /\.mdx?$/.test(file)) : []);

describe('configuración del blog', () => {
  it('no deja el blog activo sin un solo post publicable', () => {
    if (config.apps.blog.isEnabled) {
      expect(listPosts().length).toBeGreaterThan(0);
    } else {
      expect(listPosts()).toEqual([]);
    }
  });

  it('no enlaza al blog ni al RSS mientras el blog está desactivado', () => {
    if (config.apps.blog.isEnabled) return;

    expect(navigation).not.toContain('getBlogPermalink');
    expect(navigation).not.toContain('/rss.xml');
  });

  it('no conserva los posts de demostración de la plantilla AstroWind', () => {
    const demoSlugs = [
      'astrowind-template-in-depth',
      'get-started-website-with-astro-tailwind-css',
      'how-to-customize-astrowind-to-your-brand',
      'markdown-elements-demo-post',
      'useful-resources-to-create-websites',
      'landing',
    ];

    for (const slug of demoSlugs) {
      expect(listPosts()).not.toContain(`${slug}.md`);
      expect(listPosts()).not.toContain(`${slug}.mdx`);
    }
  });
});

describe('verificación de Google Search Console', () => {
  it('no usa el token de demostración de la plantilla', () => {
    expect(config.site.googleSiteVerificationId).not.toBe('orcPxI47GSa-cRvY11tUe6iGg2IO_RPvnA1q95iEM3M');
  });

  it('deja el token vacío o con un valor propio, nunca un placeholder', () => {
    const id = config.site.googleSiteVerificationId ?? '';
    if (id !== '') {
      expect(id).not.toMatch(/xxx|placeholder|tu-token/i);
      expect(id.length).toBeGreaterThan(20);
    }
  });
});

describe('restos de herramientas descartadas', () => {
  it('no deja el panel de Decap CMS servido en public/', () => {
    expect(existsSync(resolve(ROOT, 'public/decapcms'))).toBe(false);
  });
});
