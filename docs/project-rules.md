# Project Rules — Voramà Astro

> Lo que se permite, lo que no, y por qué.
> Última revisión: 2026-05-08.

## ✅ SE PERMITE

### Tecnologías
- **Astro 4.x+** con TypeScript estricto.
- **CSS plano** + Astro `<style>` scoped + nesting nativo.
- **Custom properties** (`--vrm-*`) como sistema de tokens.
- **Zod** para validar schemas de Content Collections.
- **astro:assets** (`<Image>`, `<Picture>`) para imágenes optimizadas.
- **JS vanilla** en `<script>` de componentes para interactividad mínima.
- **GitHub Actions** para CI/CD.
- **Markdown** y **JSON** para Content Collections.

### Patterns
- HTML5 semántico (`<main>`, `<nav>`, `<section>`, `<article>`, `<header>`, `<footer>`).
- `<dialog>` nativo para modales.
- `<details>/<summary>` nativo para acordeones.
- IntersectionObserver para sticky/lazy/scroll behavior.
- Animation API y CSS transitions para movimiento.
- Self-host de fuentes (`.woff2` subset latin).
- Form action a `https://wa.me/...` con interceptor JS que arma el mensaje.
- JSON-LD por página, generado desde un componente `SEO`.

### Decisiones de producto
- Mantener URLs actuales (continuidad SEO).
- Preservar nombres de imágenes y alt text del WP estático actual.
- Preservar copys (textos) — son la mejor versión auditada.
- Calendly como widget popup (lazy load on click) hasta que se construya el sistema de reservas propio.

## 🚫 NO SE PERMITE

### Tecnologías prohibidas (en B1–B7)
- **jQuery** — eliminado a propósito en M2 del proyecto anterior. No vuelve.
- **Tailwind / utility-first frameworks** — añade complejidad sin valor en este tamaño de proyecto.
- **React, Vue, Svelte** — sin necesidad real. Si llega (sistema de reservas), se evalúa entonces.
- **SCSS** — Astro CSS plano + nesting nativo cubre todo. SCSS añade build step y sintaxis sin ganancia.
- **Bootstrap, Bulma, etc.** — no aporta nada que CSS scoped no resuelva mejor.

### Anti-patterns
- **Clases `elementor-*`, `astra-*`, `wp-*`** — herencia legacy a evitar al 100%.
- **`!important`** — fuera de excepciones documentadas. Si aparece, refactor.
- **`outline: none`** sin reemplazo accesible visible — viola WCAG.
- **`<div>`-itis** — antes de un `<div>` evaluar siempre si hay tag semántico apropiado.
- **Estilos inline `style="..."`** salvo casos justificados (ej. background-image dinámico de un dato de collection).
- **`document.write`** — incompatible con `defer`, prohibido.
- **Selectores CSS demasiado permisivos** (`[CLASS*="..."]`, `*` con propiedades costosas).

### Estructura
- **NO** copiar HTML de WordPress y limpiarlo. Reconstrucción manual desde markdown limpio.
- **NO** importar nada del directorio `MagnusMCMDev.github.io` que no sean **textos**, **imágenes** o **datos** (reseñas, FAQs).
- **NO** archivos `.css` o `.js` heredados del WP exportado.
- **NO** rutas dinámicas para los 12 servicios — cada uno tiene su `.astro` propio (decisión K explícita del usuario).

### Performance
- **NO** scripts render-blocking en `<head>` salvo CSS crítico inline (que Astro genera).
- **NO** Google Fonts via `fonts.googleapis.com` — todo self-hosted.
- **NO** imágenes sin `width`/`height` (causa CLS).
- **NO** imágenes hero >150 KB en producción.

### Datos sensibles
- **NO** API keys ni tokens en código fuente.
- **NO** datos personales en commits (emails, teléfonos privados — los del negocio sí).
- **NO** información que identifique sistema (versiones de software, paths de servidor) en HTML público.

## 🟡 REQUIERE DISCUSIÓN PREVIA

Estos puntos pueden tener excepciones, pero se discuten y se actualiza este documento:

- Añadir un framework de hidratación (React/Vue/Svelte/Preact) — solo si lo justifica la reserva.
- Añadir SCSS — solo si CSS plano deja de ser suficiente.
- Cambiar `output: 'static'` a `'hybrid'` — al activar reservas server-side.
- Migrar de GitHub Pages a Cloudflare/Netlify/Vercel — al final, evaluado por brotli + custom headers.
- Cambiar la jerarquía de URLs — solo si se decide reestructurar el SEO completo.
- Introducir un CMS externo (Storyblok, Sanity, etc.) — si la edición de contenido se hace pesada para el cliente.

## 🎯 Calidad mínima por componente

Antes de marcar un componente como terminado:

- [ ] Compila sin warnings (`astro check`).
- [ ] HTML semántico verificable.
- [ ] CSS scoped, sin filtraciones a otros componentes.
- [ ] Si tiene JS, no rompe sin él (degradación grácil).
- [ ] Funciona en mobile (DevTools responsive 375x667).
- [ ] Focus visible en interactivos.
- [ ] Imágenes con dimensiones explícitas.
- [ ] Sin TODOs ni código comentado.

## 📋 Calidad mínima por página

Antes de marcar una página como terminada:

- [ ] Title + description únicos.
- [ ] Una sola `<h1>`.
- [ ] Jerarquía de headings sin saltos (h1 → h2 → h3).
- [ ] JSON-LD presente (LocalBusiness por defecto + extras si aplica).
- [ ] Imagen LCP con preload + fetchpriority.
- [ ] Lighthouse local: Performance > 90, Accessibility > 95, SEO 100.
- [ ] Diff visual contra `MagnusMCMDev.github.io/<misma-ruta>/` aceptable (puede mejorar, no debe empeorar).
- [ ] 0 broken links internos.

## 🔧 Antes de cada PR / commit

- `npm run build` pasa.
- `npm run preview` se ve correcto.
- Lighthouse local sobre la página tocada (si es UI).
- No deja `console.log` ni archivos temporales.
- Mensaje de commit imperativo y específico.

## ⚖️ Decisiones que requieren ratio explícito

Si vas a:
- Añadir una dependencia npm.
- Crear un componente que se solapa con uno existente.
- Romper una convención del `conventions.md`.
- Tocar `astro.config.mjs` o `tsconfig.json`.

…escribe **una frase justificándolo** en el commit message o en un comentario al lado del cambio.

## 🚦 Cuando dudes

> **Lee `docs/architecture.md` primero. Si la respuesta no está, pregunta antes de codear.**
> Las decisiones que se toman sin discutir se quedan ocultas y luego cuesta deshacerlas. Es mucho mejor 5 minutos de chat que 2 días de refactor.
