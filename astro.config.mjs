// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // URL provisional — cambiar al dominio definitivo antes de producción
  site: 'https://magnusmcmdev.github.io',
  base: '/vorama-astro/',
  trailingSlash: 'always',
  compressHTML: true,
  prefetch: {
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
