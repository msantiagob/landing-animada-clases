import type { ImageMetadata } from 'astro';
import { getSeoImageMeta } from '~/data/seo-images';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/seo/*.jpg', { eager: true });

/**
 * Returns the optimizable image and its SEO alt text.
 * Fails loudly: a missing image is a bug the tests must catch, not a blank hero.
 */
export function getSeoImage(key: string): { src: ImageMetadata; alt: string } {
  const meta = getSeoImageMeta(key);
  if (!meta) throw new Error(`Missing SEO image metadata for "${key}"`);

  const file = files[`/src/assets/images/seo/${meta.file}`];
  if (!file) throw new Error(`Missing SEO image file "${meta.file}" for "${key}"`);

  return { src: file.default, alt: meta.alt };
}
