# Plan 011: Publicar las páginas legales como URLs reales, arreglar el enlace roto de privacidad y crear una 404 propia

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bdbb94..HEAD -- src/layouts/BaseLayout.astro src/components/layout/Footer.astro src/components/interactive/ContactForm.astro src/components/interactive/LegalDialog.astro src/lib/booking/widget-render.ts src/pages`
> Si algún archivo in-scope cambió, compara los extractos de "Current state"
> con el código vivo antes de continuar; si no coinciden, trátalo como STOP.
> Cambios esperados según el orden recomendado: el 016 modifica `widget-render.ts` (calendario, horarios y
> atributos `aria-invalid` del formulario) pero **no** la línea del enlace de privacidad que toca este plan.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (recomendado después de 010)
- **Category**: bug / perf / seo
- **Planned at**: commit `8bdbb94`, 2026-09-22

## Why this matters

1. **Enlace roto en el paso de consentimiento de las reservas.** El checkbox RGPD del
   widget de reservas enlaza a `/legal/privacidad/`, que en producción devuelve **404**
   (comprobado: `curl https://vorama.es/legal/privacidad/` → 404). Quien quiere leer la
   política antes de aceptar acaba en el "Page not found" genérico de GitHub.
2. **Los textos legales solo existen como 3 `<dialog>` ocultos incrustados en TODAS las
   páginas** (`BaseLayout.astro:110-112`): ~25 KB de los ~73 KB de HTML de la portada
   (≈35 %; medido en el build: 10,3 + 6,2 + 8,8 KB), repetidos en las 12 páginas. No se
   pueden enlazar, y los buscadores **los leen como contenido de cada página**: una búsqueda
   `site:vorama.es` (2026-09-22) resumía la portada con frases de la política de privacidad.
3. **Los textos legales se ven sin formato.** Los estilos de `LegalDialog.astro` (`& h2`, `& p`, `& a`…)
   se compilan con el atributo de ámbito del componente (`h2[data-astro-cid-…]`), pero el HTML que genera
   `<Content />` desde Markdown **no lleva ese atributo**, así que nunca se aplican (comprobado en el CSS de
   producción). La página nueva los declara con `:global()`, como ya hace `Section.astro`.
4. **La 404 es la genérica de GitHub** ("Page not found · GitHub Pages", comprobado), sin
   forma de volver a la web. Cualquier URL antigua o mal escrita acaba ahí (p. ej. `/servicios/`,
   que el buscador aún tiene indexada y que el plan 014 redirige).

Solución: tres páginas legales reales (`/politica-de-privacidad/`, `/politica-de-cookies/`,
`/aviso-legal/`) que renderizan la colección `legal` que ya existe; todos los enlaces
(pie, formulario de contacto, widget) apuntan a ellas; se quitan los diálogos del layout;
y se crea `src/pages/404.astro` (GitHub Pages sirve `dist/404.html` automáticamente para
cualquier ruta inexistente).

## Current state

- `src/layouts/BaseLayout.astro:13-15` — imports:

```ts
// Diálogos interactivos — disponibles en todas las páginas
import LegalDialog from '~/components/interactive/LegalDialog.astro';
import BookingDialog from '~/components/booking/BookingDialog.astro';
```

- `src/layouts/BaseLayout.astro:109-113` — diálogos globales:

```astro
    <!-- ── Diálogos globales ────────────────────────────────── -->
    <LegalDialog slug="privacidad" />
    <LegalDialog slug="cookies" />
    <LegalDialog slug="aviso-legal" />
    <BookingDialog />
```

- `src/components/interactive/LegalDialog.astro` (90 líneas) — único uso: el layout. Obtiene la
  entrada con `getEntry('legal', slug)`, la pinta con `render(entry)` dentro de
  `<div class="legal-content">` y define los estilos `.legal-content` (líneas 25-89:
  h2/h3/p/ul/ol/li/a/strong/hr) con selectores anidados de etiqueta (`& h2 { … }`). **Esos estilos no
  llegan hoy al Markdown** (ver "Why this matters" §3): el componente nuevo los reescribe con `:global()`.
  `Dialog.astro` NO se toca: lo sigue usando `BookingDialog.astro`, y su `<script>` es el que
  abre cualquier `[data-dialog]`.
- Patrón del repo para estilar contenido que no genera el propio componente — `Section.astro:51-58`:

```css
  .section--dark {
    background-color: var(--vrm-color-primary);
    color: var(--vrm-color-text-inverted);

    & :global(h1),
    & :global(h2),
```

- **Plan probado**: se ejecutó tal cual en un clon del repo (con 010 y 016 aplicados antes). Resultado:
  `astro check` 0/0/0, 21/21 tests, **16 páginas**, `dist/404.html` fuera del sitemap, un solo `<dialog>` en
  la portada y la portada pasa de 73 903 a 48 148 bytes (−25 755).

- Colección `legal` (`src/content.config.ts`): `glob({ pattern: '**/*.md', base: './src/content/legal' })`,
  schema `{ title: string, lastUpdated: 'YYYY-MM-DD' }`. Entradas: `privacidad`, `cookies`, `aviso-legal`.

- `src/components/layout/Footer.astro:4-5` — patrón de rutas del proyecto:

```ts
const base = import.meta.env.BASE_URL;
const b = base.replace(/\/$/, ''); // base sin trailing slash para concatenar rutas
```

- `src/components/layout/Footer.astro:118-129` — bloque legal (además tiene un fallo de
  accesibilidad: `role="listitem"` sobre `<button>` sustituye el rol de botón):

```astro
    <div class="site-footer__legal" role="list">
      <!-- Los botones disparan LegalDialog (B6). Por ahora son buttons accesibles. -->
      <button type="button" class="site-footer__legal-btn" data-dialog="dialog-privacidad" role="listitem">
        Política de Privacidad
      </button>
      <button type="button" class="site-footer__legal-btn" data-dialog="dialog-cookies" role="listitem">
        Política de Cookies
      </button>
      <button type="button" class="site-footer__legal-btn" data-dialog="dialog-aviso-legal" role="listitem">
        Aviso Legal
      </button>
    </div>
```

- `src/components/layout/Footer.astro:301-321` — estilos:

```css
  .site-footer__legal {
    display: flex;
    gap: var(--vrm-space-md);
    flex-wrap: wrap;
  }

  .site-footer__legal-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--vrm-font-size-xs);
    color: var(--vrm-color-text-muted);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color var(--vrm-transition-fast);

    &:hover,
    &:focus-visible {
      color: var(--vrm-color-primary);
    }
```

  (y en móvil, `Footer.astro:363-365`: `.site-footer__legal { justify-content: center; }`).

- `src/components/interactive/ContactForm.astro:209-213` — enlace de privacidad del formulario:

```astro
        He leído y acepto la
        <button type="button" class="contact-form__link" data-dialog="dialog-privacidad">
          política de privacidad
        </button>
```

  Su clase `.contact-form__link` (`ContactForm.astro:478-491`) ya tiene aspecto de enlace;
  los resets de botón que lleva son inocuos en un `<a>`.

- `src/lib/booking/widget-render.ts:282` (≈ línea 301 si el plan 016 ya está aplicado; búscala por el texto
  `href="/legal/privacidad/"`) — dentro del template literal que devuelve `renderForm()`:

```ts
          <span>He leído y acepto la <a href="/legal/privacidad/" target="_blank" rel="noopener" class="bw-link">política de privacidad</a></span>
```

- Plantilla de página de referencia: `src/pages/faqs/index.astro` (BaseLayout + `PageHeader` +
  `Section`). `PageHeader` acepta `kicker?`, `title`, `lead?` y pinta el único `<h1>`.
  `Section` acepta `variant` (`'default' | 'muted' | 'dark' | 'accent'`), `padding` y `ariaLabel`. Cada página vive en su carpeta con
  `index.astro` (p. ej. `src/pages/contacto/index.astro`).

- Comprobado en un clon con Astro 7: `src/pages/404.astro` genera `dist/404.html` y
  `@astrojs/sitemap` **excluye la 404 automáticamente** (no hace falta filtro).

- Convenciones (`docs/conventions.md`): componentes `PascalCase.astro` con `interface Props`,
  `<style>` scoped, clases BEM-light kebab-case, tokens `--vrm-*`, JS vanilla mínimo.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | todos pasan (14; 22 si el plan 016 ya está aplicado) |
| Build | `npm run build` | `Complete!` — 16 páginas (12 + 3 legales + 404) |
| Preview | `npm run preview` | sirve `dist/` en http://localhost:4321/ |

`npm run build` necesita `.env`. En un worktree nuevo crea uno con valores ficticios
(está en `.gitignore`, **nunca lo commitees**): `PUBLIC_GCAL_API_KEY`, `PUBLIC_GCAL_CALENDAR_ID`,
`PUBLIC_WEB3FORMS_KEY`, `PUBLIC_WEB3FORMS_KEY_CONTACTO`, `PUBLIC_WEB3FORMS_KEY_REGALA`, todas `=dummy`.

## Scope

**In scope**:
- `src/components/sections/LegalContent.astro` (crear)
- `src/pages/politica-de-privacidad/index.astro` (crear)
- `src/pages/politica-de-cookies/index.astro` (crear)
- `src/pages/aviso-legal/index.astro` (crear)
- `src/pages/404.astro` (crear)
- `src/layouts/BaseLayout.astro` (quitar el import y las 3 líneas de `LegalDialog`)
- `src/components/layout/Footer.astro` (bloque legal + sus estilos)
- `src/components/interactive/ContactForm.astro` (solo el enlace de privacidad, líneas 209-213)
- `src/lib/booking/widget-render.ts` (solo la línea con `href="/legal/privacidad/"`)
- `src/components/interactive/LegalDialog.astro` (borrar)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- `src/content/legal/*.md` — el contenido lo corrige el plan 012.
- `src/components/interactive/Dialog.astro` y `src/components/booking/*` — el diálogo de reservas sigue igual.
- `src/pages/_dev/*` — página de desarrollo que Astro no construye (prefijo `_`); sus botones de diálogos quedarán sin efecto y da igual.
- `astro.config.mjs` — el sitemap ya excluye la 404 y recogerá las páginas nuevas solo.
- Colores/tokens (el plan 013 ajusta `--vrm-color-text-muted`).
- `<head>` de `BaseLayout.astro` (lo toca el plan 014).

## Git workflow

- Branch: `advisor/011-legal-pages`.
- Commits por unidad: (1) componente + páginas legales + 404; (2) cambiar enlaces y quitar diálogos. Español, imperativo, ≤70 caracteres.
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`. Anota el tamaño de la portada:

**Verify**: `wc -c < dist/index.html` → un número entre 70000 y 80000 (apúntalo como `BASE_BYTES`).
`grep -o "<dialog" dist/index.html | wc -l` → `4` (3 legales + reservas).

> Para **contar** ocurrencias en el HTML o en el sitemap usa siempre `grep -o … | wc -l`:
> `grep -c` cuenta *líneas*, y `dist/sitemap-0.xml` es una sola línea.

### Step 2: Crear `src/components/sections/LegalContent.astro`

```astro
---
import { getEntry, render } from 'astro:content';

interface Props {
  /** Documento de la colección `legal`. */
  slug: 'privacidad' | 'cookies' | 'aviso-legal';
}

const { slug } = Astro.props;

const entry = await getEntry('legal', slug);
if (!entry) throw new Error(`[LegalContent] No se encontró el documento legal: "${slug}"`);

const { Content } = await render(entry);

// lastUpdated es 'YYYY-MM-DD' (validado por el schema de la colección).
const updated = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' })
  .format(new Date(`${entry.data.lastUpdated}T00:00:00Z`));
---

<article class="legal-content">
  <p class="legal-content__updated">
    Última actualización: <time datetime={entry.data.lastUpdated}>{updated}</time>
  </p>
  <Content />
</article>
```

Debajo, añade este `<style>`. Son los mismos valores que `LegalDialog.astro`, pero con los selectores
de etiqueta dentro de `:global()`, porque el HTML de `<Content />` no lleva el atributo de ámbito del
componente. **No copies el bloque de `LegalDialog.astro` tal cual**: tiene justo ese fallo.

```astro
<style>
  /* Tipografía del contenido Markdown legal. Los elementos que genera <Content />
     no llevan el atributo de ámbito del componente: por eso van en :global(). */
  .legal-content {
    max-width: 72ch;
    margin-inline: auto;
    font-size: var(--vrm-font-size-sm);
    color: var(--vrm-color-text);
    line-height: var(--vrm-line-height-relaxed);

    & :global(h2) {
      font-family: var(--vrm-font-display);
      font-size: var(--vrm-font-size-md);
      color: var(--vrm-color-primary);
      margin-top: var(--vrm-space-lg);
      margin-bottom: var(--vrm-space-sm);
    }

    & :global(h3) {
      font-size: var(--vrm-font-size-base);
      font-weight: var(--vrm-font-weight-semibold);
      color: var(--vrm-color-text);
      margin-top: var(--vrm-space-md);
      margin-bottom: var(--vrm-space-xs);
    }

    & :global(p) {
      margin-bottom: var(--vrm-space-sm);
    }

    & :global(ul),
    & :global(ol) {
      padding-left: var(--vrm-space-lg);
      margin-bottom: var(--vrm-space-sm);
    }

    & :global(li) {
      margin-bottom: var(--vrm-space-xs);
    }

    & :global(a) {
      color: var(--vrm-color-primary);
      text-decoration: underline;
    }

    & :global(a:hover) {
      color: var(--vrm-color-primary-light);
    }

    & :global(strong) {
      font-weight: var(--vrm-font-weight-semibold);
    }

    & :global(hr) {
      border: none;
      border-top: 1px solid var(--vrm-color-border);
      margin-block: var(--vrm-space-md);
    }

    & .legal-content__updated {
      font-size: var(--vrm-font-size-sm);
      color: var(--vrm-color-text-muted);
      margin-bottom: var(--vrm-space-lg);
    }
  }
</style>
```

(La regla de la fecha va anidada para ganar en especificidad a `:global(p)`. Hoy el campo `lastUpdated`
del schema no se pinta en ningún sitio; así el visitante ve la fecha del documento y el plan 012 solo
tiene que actualizar el front matter.)

**Verify**: `npm run check` → 0 errors.

### Step 3: Crear las tres páginas legales

Crea `src/pages/politica-de-privacidad/index.astro`:

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import PageHeader from '~/components/sections/PageHeader.astro';
import Section from '~/components/sections/Section.astro';
import LegalContent from '~/components/sections/LegalContent.astro';
---

<BaseLayout
  title="Política de Privacidad — Voramà Terapias"
  description="Política de privacidad de Voramà Terapias: qué datos recogemos en los formularios de contacto, vale regalo y reservas, y cómo ejercer tus derechos."
>
  <PageHeader title="Política de Privacidad" />
  <Section variant="default" ariaLabel="Política de privacidad">
    <LegalContent slug="privacidad" />
  </Section>
</BaseLayout>
```

Igual para:
- `src/pages/politica-de-cookies/index.astro` — title `Política de Cookies — Voramà Terapias`,
  description `Política de cookies de Voramà Terapias: qué almacenamiento técnico usa la web y qué servicios de terceros se cargan solo cuando tú lo pides.`,
  `PageHeader title="Política de Cookies"`, `ariaLabel="Política de cookies"`, `slug="cookies"`.
- `src/pages/aviso-legal/index.astro` — title `Aviso Legal — Voramà Terapias`,
  description `Aviso legal de Voramà Terapias: titular del sitio web, condiciones de uso, propiedad intelectual y legislación aplicable.`,
  `PageHeader title="Aviso Legal"`, `ariaLabel="Aviso legal"`, `slug="aviso-legal"`.

**Verify**: `npm run build` → `15 page(s) built` · `grep -c "Derechos derivados del tratamiento" dist/politica-de-privacidad/index.html` → `2` · `grep -c "PROPIEDAD INTELECTUAL" dist/aviso-legal/index.html` → `2` (en este punto el texto sale **dos** veces: en la página y en el `<dialog>` oculto del layout, que se quita en el Step 6) · `grep -o "<h1" dist/politica-de-cookies/index.html | wc -l` → `1` (los `.md` solo usan `##`/`###`) · `grep -c "Última actualización" dist/aviso-legal/index.html` → `1`.

### Step 4: Crear `src/pages/404.astro`

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import PageHeader from '~/components/sections/PageHeader.astro';
import Section from '~/components/sections/Section.astro';

const b = import.meta.env.BASE_URL.replace(/\/$/, '');

const links = [
  { href: `${b}/`, label: 'Inicio' },
  { href: `${b}/servicios-masaje-californiano/`, label: 'Servicios de masaje' },
  { href: `${b}/regala-masaje/`, label: 'Regalar un masaje' },
  { href: `${b}/contacto/`, label: 'Contacto' },
];
---

<BaseLayout
  title="Página no encontrada — Voramà Terapias"
  description="La página que buscas no existe o ha cambiado de dirección. Vuelve al inicio o descubre nuestros masajes californianos en Barcelona."
>
  <PageHeader title="Página no encontrada" lead="La dirección que buscas no existe o ha cambiado." />
  <Section variant="default" ariaLabel="Enlaces útiles">
    <div class="not-found">
      <ul class="not-found__links">
        {links.map((l) => <li><a href={l.href}>{l.label}</a></li>)}
      </ul>
      <button type="button" class="not-found__cta" data-dialog="booking">Reservar una sesión</button>
    </div>
  </Section>
</BaseLayout>

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--vrm-space-lg);
    text-align: center;
  }

  .not-found__links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--vrm-space-md);

    & a {
      color: var(--vrm-color-primary);
      font-weight: var(--vrm-font-weight-semibold);
    }
  }

  .not-found__cta {
    padding: var(--vrm-space-sm) var(--vrm-space-lg);
    background: var(--vrm-color-primary);
    color: var(--vrm-color-text-inverted);
    border: none;
    border-radius: var(--vrm-radius-md);
    font-weight: var(--vrm-font-weight-semibold);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--vrm-color-primary);
      outline-offset: 3px;
    }
  }
</style>
```

(El botón `data-dialog="booking"` abre el widget de reservas, que el layout incluye en todas las páginas.)

**Verify**: `npm run build` → `16 page(s) built` · `test -f dist/404.html && echo OK` → `OK` · `grep -c "vorama.es/404" dist/sitemap-0.xml` → `0`.

### Step 5: Apuntar todos los enlaces a las páginas nuevas

1. `Footer.astro:118-129` — sustituye el bloque por:

```astro
    <ul class="site-footer__legal">
      <li><a class="site-footer__legal-link" href={`${b}/politica-de-privacidad/`}>Política de Privacidad</a></li>
      <li><a class="site-footer__legal-link" href={`${b}/politica-de-cookies/`}>Política de Cookies</a></li>
      <li><a class="site-footer__legal-link" href={`${b}/aviso-legal/`}>Aviso Legal</a></li>
    </ul>
```

   En los estilos: añade `list-style: none; margin: 0; padding: 0;` a `.site-footer__legal`,
   y renombra `.site-footer__legal-btn` → `.site-footer__legal-link` quitándole
   `background`, `border`, `cursor` y `padding` (conserva `font-size`, `color`,
   `text-decoration`, `text-underline-offset`, `transition` y el bloque `&:hover, &:focus-visible`).
   Mantén la regla móvil `.site-footer__legal { justify-content: center; }`.

2. `ContactForm.astro:210-212` — el `<button … data-dialog="dialog-privacidad">` pasa a:

```astro
        <a class="contact-form__link" href={`${import.meta.env.BASE_URL}politica-de-privacidad/`} target="_blank" rel="noopener">
          política de privacidad
        </a>
```

   (Nueva pestaña para no perder lo que el usuario lleva escrito.)

3. `widget-render.ts:282` — cambia `href="/legal/privacidad/"` por
   `href="${import.meta.env.BASE_URL}politica-de-privacidad/"` (está dentro de un template
   literal, así que `${…}` interpola).

**Verify**: `grep -rn "legal/privacidad\|dialog-privacidad\|dialog-cookies\|dialog-aviso-legal" src/components src/lib src/layouts` → sin resultados · `grep -c 'role="listitem"' src/components/layout/Footer.astro` → `0`.

### Step 6: Quitar los diálogos del layout y borrar `LegalDialog.astro`

- `BaseLayout.astro`: borra la línea `import LegalDialog from '~/components/interactive/LegalDialog.astro';`
  y las 3 líneas `<LegalDialog slug="…" />`. Deja `<BookingDialog />` y su comentario.
- Borra `src/components/interactive/LegalDialog.astro`.

**Verify**:
- `grep -rn "LegalDialog" src/` → sin resultados
- `npm run check` → 0 errors · `npm test` → pasa · `npm run build` → `16 page(s) built`
- `grep -o "<dialog" dist/index.html | wc -l` → `1` (solo el de reservas)
- `wc -c < dist/index.html` → al menos **20000 bytes menos** que `BASE_BYTES`
- Enlaces del pie presentes: `grep -o "politica-de-privacidad/" dist/index.html | wc -l` → `≥1`
- Sitemap: `grep -o "<loc>[^<]*</loc>" dist/sitemap-0.xml | grep -c "politica-de-privacidad\|politica-de-cookies\|aviso-legal"` → `3`
- El texto legal ya solo sale en su página: `grep -c "Derechos derivados del tratamiento" dist/politica-de-privacidad/index.html` → `1` y `grep -c "Derechos derivados del tratamiento" dist/index.html` → `0`
- Con `npm run preview`, en `/politica-de-privacidad/` los títulos de sección salen en verde y las listas con sangría (los estilos llegan al Markdown)

## Test plan

Sin tests unitarios (páginas y marcado `.astro`, sin lógica). Comprobación manual con
`npm run preview` (http://localhost:4321/):

1. Pie de cualquier página → los 3 enlaces abren sus páginas.
2. `/contacto/` → el enlace "política de privacidad" del checkbox abre la página en pestaña nueva.
3. "Reservar" → elige servicio, fecha y hora → en el formulario, "política de privacidad" abre la página nueva en otra pestaña.
4. Una URL inexistente (p. ej. `/no-existe/`) → debería verse la 404 nueva (en producción GitHub Pages sirve `404.html` con estado 404).
5. En la 404, "Reservar una sesión" abre el widget.

## Done criteria

- [ ] `dist/politica-de-privacidad/index.html`, `dist/politica-de-cookies/index.html`, `dist/aviso-legal/index.html` y `dist/404.html` existen
- [ ] `grep -rn "LegalDialog\|legal/privacidad" src/` → sin resultados
- [ ] `grep -c 'role="listitem"' src/components/layout/Footer.astro` → 0
- [ ] `grep -o "<dialog" dist/index.html | wc -l` → 1
- [ ] `dist/index.html` pesa ≥20000 bytes menos que en la línea base
- [ ] `npm run check` 0 errors · `npm test` pasa · `npm run build` 16 páginas
- [ ] `git status` sin cambios fuera del Scope (y sin `.env`)
- [ ] Fila 011 de `plans/README.md` actualizada

## STOP conditions

Para y reporta si:

- `LegalDialog` se usa en algún sitio además de `BaseLayout.astro` (`grep -rn LegalDialog src/` antes de borrarlo).
- `dist/404.html` no se genera, o la 404 aparece en `dist/sitemap-0.xml` (el sitemap está fuera de alcance).
- Tras quitar los diálogos, el botón "Reservar" deja de abrir el widget (significaría que el script de `Dialog.astro` dejó de incluirse; no lo muevas por tu cuenta).
- Algún texto legal no se encuentra en las páginas nuevas (la colección no carga).

## Maintenance notes

- Las URLs legales nuevas deben enlazarse desde cualquier formulario futuro que pida consentimiento.
- Si el plan 012 cambia títulos/secciones de los `.md`, los checks de texto de este plan
  (`Derechos derivados del tratamiento`, `PROPIEDAD INTELECTUAL`) pueden dejar de coincidir: es esperado.
- Si algún día se migra a un hosting con redirecciones (ver "Dirección" en `plans/README.md`),
  la 404 sigue siendo útil, pero conviene añadir 301 para las URLs del WordPress antiguo.
- Revisor: comprobar que el pie mantiene el mismo aspecto (subrayado, tamaño pequeño, centrado en móvil).
