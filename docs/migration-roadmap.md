# Migration Roadmap — Voramà Astro (Fase B)

> Plan cronológico de la migración de WordPress estático a Astro.
> Última revisión: 2026-05-08.

## Contexto

- **Origen:** sitio WP estático limpio en `C:\WebSites\MagnusMCMDev.github.io\` (también en producción en `https://magnusmcmdev.github.io/`).
- **Destino:** repo nuevo `vorama-astro` (`C:\WebSites\vorama-astro\`).
- **Estrategia:** los dos sitios viven en paralelo. Switch a producción cuando el nuevo esté listo, vía cambio de DNS / configuración de dominio. El sitio antiguo no se destruye.

## Estructura general

9 fases (B1–B9). Cada fase es un commit (o pocos) con validación visible al final. **Una fase no empieza hasta que la anterior esté validada.**

Cada fase indica:
- **Objetivo** — qué se consigue.
- **Tareas** — pasos concretos.
- **Entregable** — qué se puede ver/verificar al terminar.
- **Riesgo** — qué puede salir mal.

---

## B1 — Setup proyecto Astro

**Objetivo:** un `npm run dev` arranca y muestra "Hola mundo" en `localhost:4321/vorama-astro/`.

**Tareas:**
1. `npm create astro@latest .` (en `C:\WebSites\vorama-astro\`) — preset minimal, TypeScript strict.
2. Configurar `astro.config.mjs`:
   - `output: 'static'`.
   - `site: 'https://magnusmcmdev.github.io'` (provisional).
   - `base: '/vorama-astro/'` (para staging GH Pages project).
   - `trailingSlash: 'always'`.
   - `compressHTML: true`.
   - `prefetch: { defaultStrategy: 'hover' }`.
3. Configurar `tsconfig.json`:
   - `extends: 'astro/tsconfigs/strict'`.
   - Path alias: `~/* -> src/*`.
4. Instalar `astro:assets` está incluido. Sin más integraciones por ahora.
5. Crear `.gitignore` (node_modules, dist, .astro, .DS_Store).
6. Crear `package.json` scripts: `dev`, `build`, `preview`, `check`.
7. README mínimo.
8. Commit inicial.

**Entregable:** `npm run dev` y ver homepage Astro default. `npm run build` produce `dist/` válido.

**Riesgo:** bajo.

---

## B2 — Estilos base y BaseLayout

**Objetivo:** todas las páginas heredan reset, fonts, tokens y SEO base.

**Tareas:**
1. Crear `src/styles/`:
   - `reset.css` (modern CSS reset, ~40 LoC).
   - `theme.css` (custom properties `--vrm-*`).
   - `fonts.css` (4 `@font-face` Inter + Brygada).
   - `globals.css` (importa los 3 + body defaults).
2. Copiar los 2 `.woff2` de `MagnusMCMDev.github.io/assets/fonts/` a `src/assets/fonts/`.
3. Crear `src/config/site.ts` con `SITE_CONFIG` (nombre, url, telephone, address, aggregateRating, redes, defaults).
4. Crear `src/utils/seo.ts`:
   - `buildLocalBusinessJsonLd()` — schema base.
   - `getCanonicalUrl(path)` — resolver canónica.
5. Crear `src/components/layout/SEO.astro` — recibe props, emite todo el `<head>` SEO.
6. Crear `src/layouts/BaseLayout.astro`:
   - `<html lang="es">` + `<head>` con `<SEO />` + preload fonts + globals.css.
   - `<body>` con slot para Header/Footer (vacíos en B2, se rellenan en B4).
7. Crear `src/pages/index.astro` mínima usando BaseLayout.
8. Verificar: `view-source` ve el `<head>` completo + JSON-LD LocalBusiness por defecto.

**Entregable:** página con head correcto, fuentes locales cargadas, theme tokens disponibles globalmente.

**Riesgo:** bajo. El SEO component es central — invertir tiempo aquí ahorra después.

---

## B3 — Content Collections + Zod schemas

**Objetivo:** los datos del sitio (servicios, FAQs, reseñas, legal) están tipados, validados y accesibles desde cualquier componente.

**Tareas:**
1. Crear `src/content/config.ts` con `defineCollection` para 4 collections.
2. Schemas Zod (ver detalle en `architecture.md` §6).
3. Crear archivos de contenido:
   - `src/content/services/`: 5 archivos `.md` con frontmatter completo + cuerpo descriptivo. Copys extraídos del WP estático actual.
   - `src/content/faqs/faqs.json`: las 8 preguntas/respuestas (ya extraídas en M5).
   - `src/content/reviews/reviews.json`: las 8 reseñas Google (ya en JSON-LD del WP actual).
   - `src/content/legal/`: 3 archivos `.md` (`privacidad.md`, `cookies.md`, `aviso-legal.md`) con el contenido legal actual.
4. Mover imágenes de servicios a `src/assets/images/services/` con nombres originales.
5. `npm run check` debe pasar sin warnings.

**Entregable:** `await getCollection('services')` devuelve 5 items tipados. Build pasa.

**Riesgo:** medio. Si el schema Zod queda demasiado estricto, falla el build. Iterar.

---

## B4 — Componentes de layout

**Objetivo:** Header, Footer y WhatsAppFloating funcionando, integrados en BaseLayout.

**Tareas:**
1. **`Header.astro`** — desktop + mobile responsive. Menú con 12 enlaces. Sticky con IntersectionObserver. Drawer mobile con `<details>` o JS mínimo + `aria-expanded`. Logo SVG.
2. **`Footer.astro`** — 4 columnas, ubicación, redes sociales, copyright, enlaces a LegalDialogs (que se montan en BaseLayout).
3. **`WhatsAppFloating.astro`** — botón flotante bottom-right con animación `prefers-reduced-motion` aware. `<a href="https://wa.me/...">`.
4. Integrar los 3 en `BaseLayout.astro`.
5. Verificar: navegación funcional entre las 12 rutas (aunque las páginas estén vacías).

**Entregable:** layout completo navegable, sin contenido.

**Riesgo:** medio. El sticky header + drawer mobile son los puntos delicados. Probar en mobile real.

---

## B5 — Componentes de sección

**Objetivo:** vocabulario completo de bloques reutilizables. Cada uno con catálogo visual demostrable.

**Tareas:**
1. **`Section.astro`** — wrapper con padding/background variantes.
2. **`HeroBanner.astro`** — variantes `cover` y `split`.
3. **`PriceCard.astro`** — para tabla de servicios.
4. **`CardCTA.astro`** — card con imagen de fondo + botón.
5. **`IconBox.astro`** — icono SVG + título + descripción.
6. **`AccordionFAQ.astro`** — `<details>/<summary>`, prop `items` (de `getCollection('faqs')`).
7. **`Reviews.astro`** — 5 visibles + toggle "ver más", lee `getCollection('reviews')`.
8. **`ImageCarousel.astro`** — scroll-snap CSS puro, sin JS si es posible.
9. Crear página de prueba `src/pages/_dev/components.astro` con todos en una pantalla. **No publicar** (excluir en `astro.config` o eliminarla en B9).

**Entregable:** catálogo visual de 8 componentes funcionando.

**Riesgo:** medio. ImageCarousel scroll-snap puede dar problemas en Safari mobile — alternativa JS mínima ya documentada.

---

## B6 — Componentes interactivos

**Objetivo:** todas las interacciones del sitio listas: dialogs, forms, Calendly.

**Tareas:**
1. **`Dialog.astro`** — base genérico con `<dialog>` nativo. Slot para contenido.
2. **`LegalDialog.astro`** — usa Dialog. Recibe prop `slug` y carga el `.md` correspondiente de `getCollection('legal')`. 3 instancias en BaseLayout.
3. **`CalendlyDialog.astro`** — usa Dialog. Carga `widget.js` lazily al abrir el dialog (`onclick={loadCalendlyOnce()}`). Mantiene el comportamiento actual del WP estático.
4. **`ContactForm.astro`** — `<form action="https://wa.me/34623941891" method="GET" target="_blank">`. JS interceptor que lee campos y construye mensaje URL-encoded.

**Entregable:** clic en "Reserva" abre Calendly; clic en footer abre dialog legal; form contacto envía a WhatsApp con mensaje pre-rellenado.

**Riesgo:** medio. Calendly third-party — verificar que el lazy load no rompa el flow.

---

## B7 — Páginas (las 12, una a una)

**Objetivo:** las 12 rutas reales del sitio reconstruidas, con diff visual aceptable contra el WP estático actual.

**Orden recomendado** (de menos a más complejas):
1. `/contacto/` (formulario + 2 mapas + 5 icon-boxes).
2. `/sobre-mi/` (texto + imagen).
3. `/regala-masaje/` (formulario + 3 cards CTA + reseñas).
4. `/sobre-masaje-californiano/` (texto largo + 4-5 secciones).
5. `/aprende-masaje-californiano/` (texto educativo).
6. `/faqs/` (acordeón).
7. `/servicios-masaje-californiano/` (índice de servicios + tabs).
8. `/servicios-masaje-eventos-negocios/` (texto + carrusel + iconboxes).
9. `/masaje-californiano-relajante/`.
10. `/masaje-californiano-cuatro-manos/`.
11. `/masaje-californiano-para-dos/`.
12. `/` (home — la más compleja: hero + iconboxes + video + 4 cards CTA + CTA banner + reviews).

Por cada página:
- Crear `src/pages/<ruta>.astro`.
- Importar componentes necesarios.
- Pasar props desde collections o directamente.
- Validar en `localhost` contra `https://magnusmcmdev.github.io/<misma-ruta>/` (preview en dos pestañas).
- Capturar screenshot diff si ayuda.
- Lighthouse local target ≥ 90 Performance.

**Entregable:** las 12 páginas navegables con look-and-feel equivalente o mejor.

**Riesgo:** alto en volumen. Cada página puede tener detalles únicos. Aprovechar la rutina (componente → página → validación).

---

## B8 — Optimización + validación final

**Objetivo:** Lighthouse 95+/100/100 y CWV "Good" en todas las páginas.

**Tareas:**
1. **Imágenes:**
   - Todas con `<Image>` o `<Picture>` AVIF + WebP.
   - Hero LCP de cada landing con `loading="eager"` + `fetchpriority="high"` + `<link rel="preload">`.
2. **CSS:**
   - Verificar que `inlineStylesheets: 'auto'` (default) inline el critical CSS.
3. **Fonts:**
   - 2 `<link rel="preload" as="font" crossorigin>` en BaseLayout.
4. **JS:**
   - Cada `<script>` cuanto más pequeño mejor. Verificar bundle size.
5. **SEO:**
   - `astro-sitemap` integration → genera `sitemap-index.xml` automático.
   - `robots.txt` en `public/` apuntando a sitemap.
   - JSON-LD validado con Google Rich Results Test.
6. **Validación:**
   - `npm run build` pasa.
   - Lighthouse CI sobre las 12 páginas.
   - Broken-links checker (script + `astro-broken-links` o equivalente).
   - HTML W3C validator sobre las 12.

**Entregable:** reportes Lighthouse/CWV documentados. 0 broken links. JSON-LD válido.

**Riesgo:** medio. Si no se llega al target, iterar antes de B9.

---

## B9 — Deploy

**Objetivo:** sitio en producción, accesible públicamente, sin destruir el sitio actual.

**Tareas:**
1. Crear `.github/workflows/deploy.yml` con:
   - Trigger: push a `main`.
   - Setup Node + cache npm.
   - `npm ci && npm run build`.
   - Deploy a GitHub Pages (action `actions/deploy-pages@v4`).
2. En GitHub repo settings → Pages → "Deploy from Actions".
3. Push a `main`.
4. Verificar URL staging: `https://magnusmcmdev.github.io/vorama-astro/`.
5. Lighthouse CI sobre la URL real.
6. **Decisión final** del usuario: cuándo apuntar el dominio definitivo (o cambiar configuración para que sea el sitio principal).

**Entregable:** `https://magnusmcmdev.github.io/vorama-astro/` accesible y funcional.

**Riesgo:** medio. Path `/vorama-astro/` requiere que las URLs internas (canonical, sitemap) usen ese prefijo. Probar en producción y ajustar.

**Producción definitiva (post-B9):**
- Configurar dominio custom en GitHub Pages settings.
- Cambiar `base: '/'` y `site` en `astro.config.mjs`.
- Apuntar DNS.
- Verificar canonical y sitemap.
- El sitio antiguo sigue vivo hasta que se decida apagarlo.

---

## Validación visual continua

Durante toda la fase B, mantener abierta una pestaña de:
- `http://localhost:4321/vorama-astro/` (Astro local)
- `https://magnusmcmdev.github.io/<ruta>/` (WP estático actual)

Comparar lado a lado. **Diferencias visuales aceptables**: mejoras tipográficas, bordes más limpios, espaciado coherente. **Diferencias inaceptables**: pérdida de información, secciones faltantes, copys cambiadas.

## Indicadores de éxito de Fase B

- [ ] 12 páginas en `vorama-astro` con paridad visual y de contenido.
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO 100.
- [ ] LCP < 2.5s en todas las landings.
- [ ] CLS = 0.
- [ ] 0 broken links internos.
- [ ] JSON-LD LocalBusiness + Service (4) + FAQPage (1) válidos.
- [ ] Sitemap.xml + robots.txt generados.
- [ ] Bundle JS por página < 50 KB minificado (sin frameworks).
- [ ] HTML por página < 80 KB minificado (vs ~190 KB del WP estático).
- [ ] Build reproducible en GitHub Actions.

## Después de Fase B

**Fase C** (futuro, cuando el negocio lo pida):
- Sistema de reservas propio (cambia `output: 'hybrid'`, adapter, y endpoints `/api/`).
- CMS para edición de contenido (Storyblok, Sanity, Decap CMS) si el cliente lo necesita.
- i18n (catalán) si se decide.
- Hosting con brotli (Cloudflare Pages) si Lighthouse production lo justifica.
