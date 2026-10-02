# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AstroWind is a production-ready website template built with Astro 5.0 and Tailwind CSS. It's designed for startups, small businesses, SaaS websites, portfolios, marketing websites, landing pages, and blogs.

## Development Commands

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start development server at localhost:4321 |
| `npm run build`          | Build production site to ./dist/           |
| `npm run preview`        | Preview build locally before deploying     |
| `npm run check`          | Run all checks (Astro, ESLint, Prettier)   |
| `npm run check:astro`    | Run Astro type checking                    |
| `npm run check:eslint`   | Run ESLint checks                          |
| `npm run check:prettier` | Check Prettier formatting                  |
| `npm run fix`            | Auto-fix ESLint and Prettier issues        |
| `npm run fix:eslint`     | Auto-fix ESLint issues                     |
| `npm run fix:prettier`   | Auto-format with Prettier                  |

## Architecture

### Core Technologies

- **Astro 5.0**: Static site generator with island architecture
- **Tailwind CSS**: Utility-first CSS framework with dark mode support
- **TypeScript**: Type-safe JavaScript
- **MDX**: Enhanced Markdown with JSX support

### Key Directories

- `src/components/`: Reusable Astro components organized by purpose
  - `widgets/`: Page-level components (Header, Hero, Features, etc.)
  - `ui/`: Base UI components (Button, Form, etc.)
  - `blog/`: Blog-specific components
  - `common/`: Shared utility components
- `src/layouts/`: Page layout templates
- `src/pages/`: File-based routing (static pages and dynamic blog routes)
- `src/utils/`: Utility functions and helpers
- `src/content/`: Content collections (not used, posts are in src/data/post/)
- `src/data/post/`: Blog posts in Markdown/MDX format
- `src/assets/`: Static assets (images, styles)
- `public/`: Static files served directly

### Configuration Files

- `src/config.yaml`: Main site configuration (metadata, blog settings, analytics)
- `src/navigation.ts`: Header and footer navigation data
- `astro.config.ts`: Astro configuration with integrations
- `tailwind.config.js`: Tailwind CSS configuration

### Blog System

- Blog posts are stored in `src/data/post/` as .md/.mdx files
- Dynamic routing in `src/pages/[...blog]/` handles blog listing and individual posts
- Category and tag pages are auto-generated
- RSS feed generated at `/rss.xml`

### Styling System

- Uses Tailwind CSS with custom CSS variables for theming
- Dark mode support via CSS classes
- Custom styles in `src/components/CustomStyles.astro`
- Main CSS file: `src/assets/styles/tailwind.css`

### SEO & Analytics

- Built-in SEO optimization with OpenGraph and Twitter Card support
- Google Analytics integration (configured in config.yaml)
- Sitemap generation
- Image optimization with Astro Assets and Unpic

## Development Notes

### Adding New Pages

Create `.astro` files in `src/pages/` directory. File name becomes the route.

### Adding Blog Posts

Add `.md` or `.mdx` files to `src/data/post/` directory with frontmatter.

### Customizing Appearance

- Edit `src/config.yaml` for site-wide settings
- Modify `src/components/CustomStyles.astro` for custom CSS
- Update `src/navigation.ts` for menu changes

### Image Handling

- Use the `src/components/common/Image.astro` component for optimized images
- Place images in `src/assets/images/` or `public/` directory

### Icon System

Uses Astro Icon with Tabler and Flat Color Icons. Configure in `astro.config.ts`.

## Deployment

The project is configured for static site generation (`output: 'static'`). Build artifacts are output to `dist/` directory and can be deployed to any static hosting service.
