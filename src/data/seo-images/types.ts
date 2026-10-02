/**
 * Metadata for self-hosted, royalty-free images (Unsplash License).
 * Images live in src/assets/images/seo/ so Astro can optimize them.
 */
export interface SeoImageMeta {
  /** File name inside src/assets/images/seo/ */
  file: string;
  /** Spanish alt text: describes what is visible, in the context of the page */
  alt: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string;
  /** Unsplash photo page, kept as provenance of the license */
  sourceUrl: string;
  license: 'Unsplash License';
}
