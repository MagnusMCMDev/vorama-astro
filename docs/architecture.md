# Arquitectura — Voramà Astro

> Documento maestro de la arquitectura técnica del proyecto.
> Última revisión: 2026-05-08.

## 1. Visión general

**Proyecto:** reconstrucción del sitio web de Voramà Terapias (centro de masaje californiano en Barcelona) sobre Astro 4.x con TypeScript, partiendo desde cero la estructura de código pero reutilizando textos, URLs e imágenes ya curadas.

**Origen:** sitio WordPress + Elementor exportado a estático. Disponible saneado y optimizado en `C:\WebSites\MagnusMCMDev.github.io\`. Ese es el sitio de **referencia** para textos, alt-text, jerarquía de URLs y assets.

**Destino:** repo separado `vorama-astro` (`C:\WebSites\vorama-astro\`). Convive en paralelo con el sitio anterior. El switch a producción se hará vía DNS cuando esté listo, sin destruir la versión anterior.

**Filosofía:**
- HTML semántico, sin div-itis Elementor.
- CSS scoped por componente + tokens globales. Sin frameworks de utilidad.
- JS mínimo. Sin frameworks de hidratación todavía.
- Componentes pequeños y desacoplados, optimizados para lectura por IA coding assistants.
- "Menos es más": no abstraer hasta que se necesite.

## 2. Stack técnico

| Capa | Elección | Notas |
|---|---|---|
| Framework | Astro ≥ 4.x | TypeScript estricto |
| Estilos | CSS plano + Astro `<style>` scoped | Nesting nativo. Sin SCSS de inicio. |
| Tipos | TypeScript estricto + Zod | Schemas de Content Collections |
| Imágenes | `astro:assets` (`<Image>` / `<Picture>`) | AVIF + WebP fallback, build-time |
| Fuentes | Self-hosted woff2 | Inter + Brygada 1918, subset latin |
| Datos | Content Collections | services, faqs, reviews, legal |
| Hosting | GitHub Pages (deploy via Action) | Build artifact funcional en cualquier estático |
| Output | `output: 'static'` | Preparado para cambiar a `'hybrid'` con un solo cambio de adapter |
| CI/CD | GitHub Actions | `.github/workflows/deploy.yml` |

## 3. Estructura de carpetas

```
vorama-astro/
├── public/                          # Assets servidos tal cual (no procesados)
│   ├── favicon.ico
│   ├── favicon-32.png
│   ├── apple-touch-icon.png
│   ├── site.webmanifest
│   ├── robots.txt
│   └── og-default.webp              # OG fallback global
│
├── src/
│   ├── assets/                      # Procesados por astro:assets
│   │   ├── images/
│   │   │   ├── home/
│   │   │   ├── services/
│   │   │   ├── about/
│   │   │   └── decorations/
│   │   └── fonts/
│   │       ├── inter-latin.woff2
│   │       └── brygada1918-latin.woff2
│   │
│   ├── components/
│   │   ├── layout/                  # Header, Footer, WhatsAppFloating, SEO
│   │   ├── sections/                # HeroBanner, Section, PriceCard, etc.
│   │   └── interactive/             # Dialog, CalendlyDialog, ContactForm, LegalDialog
│   │
│   ├── content/
│   │   ├── config.ts                # defineCollection + Zod schemas
│   │   ├── services/                # 5 archivos .md (un servicio cada uno)
│   │   ├── faqs/                    # faqs.json (array de Q&A)
│   │   ├── reviews/                 # reviews.json (array de reseñas)
│   │   └── legal/                   # privacidad.md, cookies.md, aviso-legal.md
│   │
│   ├── config/
│   │   └── site.ts                  # SITE_CONFIG: nombre, url, address, telephone, redes, ratings
│   │
│   ├── layouts/
│   │   └── BaseLayout.astro         # Único layout. Recibe SEO props + slot
│   │
│   ├── pages/
│   │   ├── index.astro              # /
│   │   ├── contacto.astro
│   │   ├── faqs.astro
│   │   ├── regala-masaje.astro
│   │   ├── sobre-mi.astro
│   │   ├── sobre-masaje-californiano.astro
│   │   ├── aprende-masaje-californiano.astro
│   │   ├── servicios-masaje-californiano.astro
│   │   ├── servicios-masaje-eventos-negocios.astro
│   │   ├── masaje-californiano-relajante.astro
│   │   ├── masaje-californiano-cuatro-manos.astro
│   │   └── masaje-californiano-para-dos.astro
│   │
│   ├── styles/
│   │   ├── reset.css                # CSS reset moderno
│   │   ├── theme.css                # Custom properties (tokens)
│   │   ├── fonts.css                # @font-face Inter + Brygada
│   │   └── globals.css              # body defaults, link styles. Importa los 3 anteriores
│   │
│   └── utils/
│       └── seo.ts                   # buildJsonLd, getCanonicalUrl
│
├── docs/                            # Documentación interna (este archivo + 4 más)
├── astro.config.mjs
├── tsconfig.json
├── package.json
├── .gitignore
└── .github/
    └── workflows/
        └── deploy.yml
```

## 4. Layouts

**Un solo layout: `BaseLayout.astro`.**

Recibe via props:
- `title: string` (sin sufijo, lo añade el layout: ` — Voramà Terapias`)
- `description: string`
- `canonical?: string` (default: URL actual)
- `ogImage?: ImageMetadata` (default: og-default.webp)
- `noindex?: boolean`
- `jsonLd?: object[]` (schemas extra: Service, FAQPage, etc.)

Estructura:
```
<html lang="es">
  <head>
    <SEO ...props />
    <link rel="preload" as="font" ...>
    <link rel="stylesheet" href="globals.css">
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
    <WhatsAppFloating />
    <!-- LegalDialog x3 montados aquí, ocultos hasta abrirse -->
  </body>
</html>
```

**Decisión:** sin `ServiceLayout` separado. Si en B5 detectamos duplicación entre las 3 páginas de masaje individual, extraemos entonces.

## 5. SEO

**Componente:** `src/components/layout/SEO.astro`.

**Centraliza** todo el `<head>` SEO en un solo lugar:
- title (con sufijo automático)
- description
- canonical
- meta robots
- OpenGraph completo
- Twitter Card (summary_large_image)
- favicon + manifest
- referrer policy
- theme-color

**JSON-LD:** un helper `buildLocalBusinessJsonLd()` en `utils/seo.ts` lee de `SITE_CONFIG` y genera el schema base. Cada página lo emite por defecto + los schemas extra que pase en `jsonLd`.

`SITE_CONFIG` = single source of truth (nombre, url, telephone, address, aggregateRating, redes). Si cambia algo, se cambia en un solo sitio.

## 6. Content Collections

**3 colecciones de datos + 1 de markdown legal:**

### `services` (Markdown con frontmatter)
5 archivos en `src/content/services/`:
- `relajante.md`
- `cuatro-manos.md`
- `para-dos.md`
- `eventos.md`
- `regala-vale.md`

Schema (Zod):
```ts
{
  slug: string,                 // 'relajante', 'cuatro-manos'...
  title: string,                // "Masaje Californiano Relajante"
  shortDescription: string,     // < 160 chars (meta description)
  duration: string,             // "75 min"
  price: string,                // "65€"
  heroImage: image(),           // procesada por astro:assets
  heroAlt: string,
  benefits: string[],
  order: number,                // sort en listings
  schemaServiceType: string,    // para JSON-LD Service
  cta: { label: string, href: string },
}
```

El cuerpo del .md contiene texto largo descriptivo que se renderiza en la página de servicio.

### `faqs` (JSON único)
`src/content/faqs/faqs.json` — array de 8 items:
```ts
{ question: string, answer: string, order: number }
```

Alimenta `/faqs/` y el JSON-LD `FAQPage`.

### `reviews` (JSON único)
`src/content/reviews/reviews.json` — array de 8 reseñas Google:
```ts
{
  author: string,
  date: string,        // ISO YYYY-MM-DD
  rating: number,      // 1-5
  text: string,
  source: 'google',
  avatar?: string,     // URL gstatic (opcional)
}
```

Alimenta el bloque `Reviews` y el JSON-LD `LocalBusiness.review`.

### `legal` (Markdown plano)
3 archivos: `privacidad.md`, `cookies.md`, `aviso-legal.md`. Schema mínimo (`title`, `lastUpdated`). Renderizados dentro de `LegalDialog`.

## 7. CSS strategy

**Tokens globales** en `src/styles/theme.css`:
```css
:root {
  --vrm-color-primary: #CBA590;
  --vrm-color-text: #1a1a1a;
  --vrm-color-bg: #ffffff;
  --vrm-space-xs: 0.5rem;
  --vrm-space-sm: 1rem;
  --vrm-space-md: 2rem;
  --vrm-space-lg: 4rem;
  --vrm-font-body: 'Inter', sans-serif;
  --vrm-font-display: 'Brygada 1918', serif;
  --vrm-radius-sm: 4px;
  --vrm-radius-md: 12px;
  --vrm-bp-mobile: 600px;
  --vrm-bp-tablet: 920px;
  --vrm-bp-desktop: 1200px;
}
```

**`globals.css`** importa `reset.css` + `theme.css` + `fonts.css` y añade body defaults + link reset + utilidades mínimas (`.sr-only`, `.container`).

**Cada componente Astro** lleva su `<style>` scoped. Sin BEM, sin clases globales. CSS nesting nativo permitido.

**Sin SCSS** de inicio. Si en B5+ aparece necesidad real (mixins, funciones), evaluamos migrar.

## 8. JavaScript / Islands

**Sin React/Vue todavía.** En B1–B7 todo es Astro estático + `<script>` plano cuando hace falta.

| Funcionalidad | Approach |
|---|---|
| Sticky header | `IntersectionObserver` (~20 LoC en `<script>` de `Header.astro`) |
| Menú mobile | `<details>` o `<script>` mínimo con `aria-expanded` |
| Dialogs | `<dialog>` nativo + `dialog.showModal()` |
| Calendly | Carga `widget.js` on-demand al abrir el dialog (lazy script injection) |
| Carrusel | `scroll-snap` puro CSS (0 JS si funciona) |
| Form → WhatsApp | `<script>` que intercepta submit y arma `wa.me` URL |
| FAQ accordion | `<details>/<summary>` (0 JS) |

**Astro Islands NO se activa** en esta fase. Se reserva para el futuro sistema de reservas (que probablemente sea una isla React/Vue cuando llegue). La estructura del proyecto está preparada para añadirlas sin reorganizar (carpeta `interactive/` lista, `package.json` puede añadir integraciones sin refactor).

## 9. Imágenes

- Todas las imágenes de contenido viven en `src/assets/images/` (organizadas por uso).
- Importadas desde el componente que las usa: `import heroImg from '~/assets/images/services/relajante-hero.webp'`.
- Renderizadas con `<Image>` o `<Picture>` de `astro:assets` para AVIF + WebP fallback.
- `width`/`height` siempre presentes (Astro los infiere automáticamente del import).
- `alt` viene del frontmatter de la collection o del componente que la usa.

**`public/`** queda reservado para: favicon, manifest, robots, sitemap (lo genera Astro), og-default.

**Nombres originales** preservados (continuidad SEO/alt). Si renombramos, perdemos posibles backlinks que apuntan a esa imagen.

## 10. Fuentes

- 2 archivos `.woff2` self-hosted en `src/assets/fonts/`:
  - `inter-latin.woff2` (variable, ~47 KB)
  - `brygada1918-latin.woff2` (variable, ~23 KB)
- 4 `@font-face` en `src/styles/fonts.css` (Inter 400/600 + Brygada 500/600, todas `font-display:swap`).
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` en BaseLayout para los 2 woff2.
- Subset `latin` cubre español + catalán completo. Cero requests externos.

## 11. Hosting y deploy

**Repo:** `vorama-astro` (independiente del actual `MagnusMCMDev.github.io`).

**GitHub Action** (`.github/workflows/deploy.yml`):
- Trigger: push a `main`.
- Build: `npm ci && npm run build`.
- Deploy: a GitHub Pages del propio repo `vorama-astro`.

**URL inicial (staging):** `https://magnusmcmdev.github.io/vorama-astro/` (project page, requiere `base: '/vorama-astro/'` en `astro.config.mjs`).

**Path a producción** (cuando el usuario esté listo):
1. Configurar dominio custom en GitHub Pages settings (CNAME).
2. Cambiar `base: '/'` y `site: 'https://el-dominio-final.es'` en astro.config.
3. Apuntar DNS al GitHub Pages CNAME.
4. El sitio antiguo (`magnusmcmdev.github.io`) sigue funcionando hasta que el usuario decida desconectarlo.

**Alternativas de hosting** (no instalar ahora, evaluar al final):
- Cloudflare Pages — conectar repo, dominio custom, build cache. **Recomendado** si se quiere brotli (que GH Pages no tiene).
- Netlify — similar a Cloudflare. Soporta forms si se necesita.
- Vercel — similar. Mejor con SSR/edge si se migra a hybrid.

El build de Astro `output: 'static'` es portable: el `dist/` funciona en cualquier estático.

## 12. Migration ready: Static → Hybrid

Para el futuro sistema de reservas, el cambio es mínimo:

```diff
// astro.config.mjs
- output: 'static',
+ output: 'hybrid',
+ adapter: cloudflare(),  // o node, vercel, netlify según hosting elegido
```

Las nuevas rutas con server logic van en `src/pages/api/` con `export const prerender = false`. Los componentes y páginas existentes no cambian.

## 13. Performance objetivos

Target Lighthouse (Mobile, Slow 4G):
- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

Core Web Vitals:
- LCP < 2.5s (imagen hero con `<Image>` + preload + fetchpriority)
- INP < 200ms (JS mínimo, sin frameworks bloqueantes)
- CLS < 0.1 (todas las imágenes con dimensiones, fonts con `font-display: swap`)

## 14. Accesibilidad

- HTML semántico siempre (`<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<section>`).
- Una `<h1>` por página, jerarquía de headings sin saltos.
- Focus visible en todos los interactivos (no `outline: none`).
- `<dialog>` con foco gestionado nativamente.
- Skip-link `<a href="#content">` al inicio del body.
- `prefers-reduced-motion` respetado en transiciones.
- Color contrast mínimo AA en todo el texto.

## 15. Documentos relacionados

- [conventions.md](./conventions.md) — naming y reglas de código.
- [project-rules.md](./project-rules.md) — qué se permite y qué no.
- [migration-roadmap.md](./migration-roadmap.md) — fases B1–B9.
- [component-inventory.md](./component-inventory.md) — los 16 componentes a crear.
