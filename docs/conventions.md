# Convenciones — Voramà Astro

> Naming, estructura y reglas de código.
> Última revisión: 2026-05-08.

## 1. Idioma

- **Código** (variables, funciones, tipos): inglés.
- **Contenido** (textos, frontmatter, comentarios de copy): español.
- **Comentarios técnicos en código**: español OK si aclara contexto del negocio; inglés para conceptos técnicos universales.
- **Mensajes de commit**: español, modo imperativo (ej. "Añadir HeroBanner componente").

## 2. Naming de archivos

| Tipo | Convención | Ejemplo |
|---|---|---|
| Componente Astro | `PascalCase.astro` | `HeroBanner.astro`, `LegalDialog.astro` |
| Layout | `PascalCase.astro` | `BaseLayout.astro` |
| Página | `kebab-case.astro` (= URL) | `masaje-californiano-relajante.astro` |
| Markdown contenido | `kebab-case.md` | `relajante.md`, `privacidad.md` |
| TypeScript util | `camelCase.ts` | `seo.ts`, `formatDate.ts` |
| Tipo / interface | `PascalCase.ts` o inline | `types/Service.ts` |
| Config | `camelCase.ts` o `kebab-case.json` | `site.ts`, `astro.config.mjs` |
| CSS file | `kebab-case.css` | `theme.css`, `globals.css` |
| Imagen | `kebab-case.{webp,jpg,svg}` | `relajante-hero.webp` |
| Fuente | `lowercase-weight.woff2` | `inter-latin.woff2` |

## 3. Naming TypeScript / JS

```ts
// Variables y funciones: camelCase
const siteConfig = { ... }
function getServiceBySlug(slug: string) { ... }

// Tipos / interfaces / clases: PascalCase
interface Service { ... }
type ServiceCard = { ... }

// Constantes globales (config): SCREAMING_SNAKE
const SITE_URL = 'https://vorama.es'
const MAX_REVIEWS = 5

// Booleans: prefijo is/has/should
const isMobile = ...
const hasReviews = ...
```

## 4. Naming CSS

### Custom properties (variables)
Prefijo `--vrm-` para evitar choques con third-party:

```css
--vrm-color-primary
--vrm-color-text
--vrm-color-bg
--vrm-color-accent
--vrm-space-{xs,sm,md,lg,xl}
--vrm-font-{body,display}
--vrm-radius-{sm,md,lg}
--vrm-bp-{mobile,tablet,desktop}
--vrm-shadow-{sm,md,lg}
--vrm-transition-{fast,base,slow}
```

### Class names
- Kebab-case.
- Una clase principal por componente, derivadas con sufijos (BEM-light).
- No anidamiento BEM completo (`.x__y__z` es exceso).

```css
/* Bien */
.hero-banner { }
.hero-banner__title { }
.hero-banner--dark { }

/* Evitar */
.heroBanner { }            /* camelCase */
.HeroBanner { }            /* PascalCase */
.hero_banner { }           /* snake_case */
.hero-banner__inner__row { } /* BEM profundo */
```

### Estructura del `<style>` en componente

```astro
<style>
  /* Cuando un selector lleva una clase específica del componente, usa nesting */
  .hero-banner {
    padding: var(--vrm-space-lg);

    & .hero-banner__title {
      font-family: var(--vrm-font-display);
    }

    @media (max-width: 600px) {
      padding: var(--vrm-space-md);
    }
  }
</style>
```

## 5. Naming de URLs

**Mantener exactamente las URLs actuales** (continuidad SEO). Lista cerrada:

```
/
/aprende-masaje-californiano/
/contacto/
/faqs/
/masaje-californiano-cuatro-manos/
/masaje-californiano-para-dos/
/masaje-californiano-relajante/
/regala-masaje/
/servicios-masaje-californiano/
/servicios-masaje-eventos-negocios/
/sobre-masaje-californiano/
/sobre-mi/
```

Trailing slash siempre. Astro `trailingSlash: 'always'` en config.

## 6. Estructura de un componente Astro

Plantilla canónica:

```astro
---
// 1. Imports (Astro components arriba, tipos abajo)
import Section from '~/components/sections/Section.astro';
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

// 2. Props
interface Props {
  title: string;
  image: ImageMetadata;
  imageAlt: string;
  variant?: 'cover' | 'split';
}

const { title, image, imageAlt, variant = 'cover' } = Astro.props;
---

<!-- 3. Markup -->
<section class:list={['hero-banner', `hero-banner--${variant}`]}>
  <h1 class="hero-banner__title">{title}</h1>
  <Image src={image} alt={imageAlt} loading="eager" fetchpriority="high" />
</section>

<!-- 4. Estilos scoped -->
<style>
  .hero-banner {
    /* ... */
  }
</style>

<!-- 5. Script (si aplica) -->
<script>
  // JS mínimo, vanilla
</script>
```

**Reglas:**
- Frontmatter `---` siempre, aunque no haya lógica (deja claro que es Astro).
- Props tipadas con `interface Props`.
- Defaults de props en la desestructuración.
- `<style>` siempre scoped (Astro lo hace por defecto).
- `<script>` solo si hay interactividad. Vanilla JS, sin imports innecesarios.

## 7. Imports

**Alias** `~/` apunta a `src/` (configurado en `tsconfig.json` y `astro.config.mjs`).

```ts
// Bien
import Hero from '~/components/sections/HeroBanner.astro';
import { siteConfig } from '~/config/site';

// Evitar
import Hero from '../../components/sections/HeroBanner.astro';
```

**Orden:**
1. Imports de `astro:*` (Image, getCollection, etc.).
2. Imports de componentes Astro (`~/components/...`).
3. Imports de utils / config (`~/utils/...`, `~/config/...`).
4. Imports de assets (imágenes, fuentes).
5. Imports de tipos (`import type`).

## 8. Frontmatter de Markdown

Schema validado por Zod (`src/content/config.ts`). Ejemplo `services/relajante.md`:

```markdown
---
slug: relajante
title: Masaje Californiano Relajante
shortDescription: Sesión individual de relajación profunda con técnicas envolventes y aceites esenciales.
duration: 75 min
price: 65€
heroImage: ~/assets/images/services/relajante-hero.webp
heroAlt: Terapeuta aplicando movimiento envolvente sobre la espalda durante un masaje californiano.
benefits:
  - Reducción de estrés y tensión muscular
  - Mejora de la circulación
  - Sensación de bienestar profundo
order: 1
schemaServiceType: Masaje Californiano
cta:
  label: Reservar sesión
  href: '#reserva'
---

Texto largo descriptivo en Markdown estándar...
```

**Reglas frontmatter:**
- Siempre todas las claves del schema (Zod fallará en build si falta una requerida).
- Valores en español.
- Imágenes referenciadas con alias `~/assets/...` (Astro las procesa).
- Listas (`benefits`) como arrays YAML.

## 9. SEO props

Cada página debe pasar al menos:

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
---
<BaseLayout
  title="Masaje Californiano Relajante"
  description="Sesión individual de 75 min de relajación profunda en Barcelona. Reserva online."
  jsonLd={[serviceSchema]}
>
  <!-- contenido -->
</BaseLayout>
```

`canonical` y `ogImage` se autocompletan si no se pasan (canonical = URL actual, ogImage = `/og-default.webp`).

## 10. Comentarios

- Solo cuando aclaran intención no obvia.
- Evitar comentarios que reformulan código.
- TODOs marcados con `TODO:` para grep posterior; FIXMEs con `FIXME:` reservados a problemas reales (no para "esto se puede mejorar").

```astro
<!-- Bien: explica decisión -->
<!-- Hero usa loading="eager" + fetchpriority por ser LCP -->
<Image src={hero} loading="eager" fetchpriority="high" />

<!-- Mal: redundante -->
<!-- Imagen hero -->
<Image src={hero} />
```

## 11. Commits

**Formato:** sujeto en imperativo, español, ≤ 70 chars. Cuerpo opcional con detalles.

```
Añadir HeroBanner con variantes cover y split

- Props: title, image, imageAlt, variant
- Variant cover: imagen full-bleed, texto sobre overlay
- Variant split: 50/50 imagen + texto

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

Una unidad de cambio por commit. Si tocas dos componentes no relacionados, son dos commits.

## 12. Convenciones específicas para IA assistants

Para que el contexto sea pequeño y manejable:

- **Archivos cortos**: ≤ 200 líneas un componente típico. Si supera, replantear si es 1 o 2 componentes.
- **Componentes desacoplados**: cada uno entendible en aislamiento. Imports explícitos.
- **Mínima duplicación**: si dos componentes hacen casi lo mismo, props o variantes; no dos archivos.
- **Convenciones estrictas**: cuando hay dos formas de hacer algo, hay UNA en este proyecto. Documentada aquí.
- **Naming descriptivo > corto**: `getServiceBySlug` mejor que `getService`. `heroAlt` mejor que `alt`.
- **No abstracción prematura**: 1 caso = sin abstracción; 2 casos = OK plantear; 3 casos = abstracción justificada.

## 13. Excepciones

Si en algún momento esta convención bloquea trabajo legítimo, **se discute y se actualiza este documento**. No se hace excepción tácita en el código sin actualizar el doc.
