// @ts-check
import {
  defineConfig,
  fontProviders,
} from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // ⚠️ Cambia esto por tu dominio real antes de publicar
  site: "https://sonmyd.co",
  scopedStyleStrategy: 'where',
  integrations: [sitemap()],
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Roboto Slab",
        cssVariable: "--font-roboto-slab",
        weights: ["100 900"],
      },
      {
        provider: fontProviders.google(),
        name: "Inter",
        cssVariable: "--font-inter",
        weights: ["100 900"],
      },
    ],
  },
});
