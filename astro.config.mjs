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
      // No publicar la página interna de catálogo de componentes
      filter: (page) => !page.includes('/_dev/'),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
});
