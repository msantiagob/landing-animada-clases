import type { Post } from '~/types';
import { getSeoImageMetaByPath } from '~/data/seo-images';

/** What backs the alt text when the cover has no curated description. */
export type PostImageAltFallback = 'title' | 'excerpt';

type PostImageSource = Pick<Post, 'title' | 'excerpt' | 'image'>;

/**
 * Alt text for a post cover.
 *
 * Covers stored in `src/assets/images/seo/` have a hand-written Spanish alt in the
 * manifest (`src/data/seo-images`) that describes what the photo actually shows.
 * Any other cover (external URL, no manifest entry) keeps the previous behavior:
 * the title in cards and lists, the excerpt in the single post.
 *
 * Pass the raw frontmatter value (`~/assets/images/seo/blog-x.jpg`). Once
 * `findImage` resolves it into an ImageMetadata object the file name is gone, so
 * any non-string value falls back instead of throwing.
 */
export function getPostImageAlt(post: PostImageSource, fallback: PostImageAltFallback = 'title'): string {
  const curated = typeof post.image === 'string' ? getSeoImageMetaByPath(post.image)?.alt : undefined;
  if (curated) return curated;

  return (fallback === 'excerpt' ? post.excerpt : post.title) ?? '';
}
