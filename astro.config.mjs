// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://vorama.es',
  base: '/',
  trailingSlash: 'always',
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
