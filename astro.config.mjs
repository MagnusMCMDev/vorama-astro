// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://vorama.es',
  base: '/',
  trailingSlash: 'always',
  // URLs antiguas que Google aún tiene indexadas → página nueva
  // (en build estático Astro genera una página con meta refresh + canonical + noindex).
  redirects: {
    '/servicios': '/servicios-masaje-californiano/',
  },
  compressHTML: true,
  prefetch: {
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
    }),
  ],
});
