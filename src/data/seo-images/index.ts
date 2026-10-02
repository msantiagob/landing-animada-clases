import type { SeoImageMeta } from './types';

export type { SeoImageMeta } from './types';

// Each manifest exports a single Record<string, SeoImageMeta> (landingImages, blogImages).
const manifests = import.meta.glob<Record<string, Record<string, SeoImageMeta>>>(['./landings.ts', './blog.ts'], {
  eager: true,
});

export const seoImageMeta: Record<string, SeoImageMeta> = Object.assign(
  {},
  ...Object.values(manifests).flatMap((module) => Object.values(module))
);

export function getSeoImageMeta(key: string): SeoImageMeta | undefined {
  return seoImageMeta[key];
}

/** Resolves the metadata from a post `image` path such as `~/assets/images/seo/blog-que-es-n8n.jpg` */
export function getSeoImageMetaByPath(path: string | undefined): SeoImageMeta | undefined {
  if (!path) return undefined;
  const file = path.split('/').pop();
  return Object.values(seoImageMeta).find((meta) => meta.file === file);
}
