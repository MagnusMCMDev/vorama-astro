# Plan 007: Cargar los mapas de Google con un facade de clic (privacidad + rendimiento)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/pages/contacto/index.astro`
> Compara con "Current state" si hubo cambios.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / privacy
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

La página `/contacto/` incrusta **dos iframes de Google Maps** que, aunque usan
`loading="lazy"`, abren conexión con Google (cookies de tracking, tiles, JS) en
cuanto entran en viewport — sin que la persona lo pida. El sitio tiene diálogos
de privacidad y cookies (postura RGPD consciente), así que cargar Google antes
del consentimiento es incoherente. El proyecto ya resuelve exactamente esto para
el vídeo de YouTube con un **facade** (póster + botón que inyecta el iframe al
hacer clic, ver `src/pages/index.astro:627`). Este plan aplica el mismo patrón a
los mapas mediante un componente reutilizable: cero conexión a Google hasta que
la persona pulsa "Ver mapa", y menos peso en la carga inicial.

## Current state

`src/pages/contacto/index.astro:55-86` — dos `<article class="location">`, cada
uno con un iframe directo:

```astro
<iframe
  class="location__map"
  src="https://www.google.com/maps?q=Carrer+de+Sant+Antoni+Maria+Claret+51,+Barcelona&output=embed"
  loading="lazy"
  title="Mapa Voramà — Sant Antoni Maria Claret 51"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

y

```astro
<iframe
  class="location__map"
  src="https://www.google.com/maps?q=C/+de+Felip+II,+23,+Barcelona&output=embed"
  loading="lazy"
  title="Mapa Més Millor — Felip II 23"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

- CSS de `.location__map` (en el `<style>` de la misma página, ~L136-142): `width:100%; height:320px; border:0; border-radius: var(--vrm-radius-lg); box-shadow: var(--vrm-shadow-sm);`.
- Patrón facade de referencia (vídeo), `src/pages/index.astro:632-657`: un botón con `data-video-id` cuyo handler crea el `<iframe>` con `document.createElement`, lo envuelve y hace `btn.replaceWith(wrapper)`.
- Convenciones del repo (`docs/conventions.md`): componentes `PascalCase.astro` con `interface Props`, `<style>` scoped, clases kebab-case con prefijo de componente, JS vanilla mínimo en `<script>`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors |
| Build     | `npm run build`    | exit 0 |
| Preview   | `npm run preview`  | sirve `dist/` para comprobación manual |

## Scope

**In scope**:
- `src/components/sections/MapEmbed.astro` (crear)
- `src/pages/contacto/index.astro` (sustituir los 2 iframes; mover el CSS del mapa al componente)
- `plans/README.md`

**Out of scope**:
- El facade de vídeo de `index.astro` — no se toca (sigue su propia copia del patrón; no merece abstraerse por 2 usos distintos, regla "3 casos = abstracción" de conventions §12).
- Otras páginas — solo `contacto` tiene mapas.

## Git workflow

- Branch: `advisor/007-maps-facade`.
- Commit en español, imperativo, ≤70 chars. Ej: `Cargar mapas de Google con facade de clic en contacto`.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Crear el componente MapEmbed.astro

Crea `src/components/sections/MapEmbed.astro`:

```astro
---
interface Props {
  /** Consulta para el embed de Google Maps (texto de la dirección). */
  query: string;
  /** Título accesible del mapa (también texto del botón previo). */
  title: string;
}

const { query, title } = Astro.props;
const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
---

<div class="map-embed" data-map-src={embedSrc} data-map-title={title}>
  <button type="button" class="map-embed__btn" data-map-load>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
    <span class="map-embed__label">Ver mapa</span>
    <span class="map-embed__hint">{title}</span>
  </button>
</div>

<style>
  .map-embed {
    position: relative;
    width: 100%;
    height: 320px;
    border-radius: var(--vrm-radius-lg);
    box-shadow: var(--vrm-shadow-sm);
    overflow: hidden;
    background: var(--vrm-color-bg-subtle);
  }
  .map-embed__btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--vrm-space-xs);
    width: 100%;
    height: 100%;
    border: 1px dashed var(--vrm-color-border);
    border-radius: inherit;
    background: none;
    color: var(--vrm-color-primary);
    cursor: pointer;
    text-align: center;
    padding: var(--vrm-space-md);
    transition: background-color var(--vrm-transition-fast);

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--vrm-color-primary) 8%, transparent);
    }
    &:focus-visible {
      outline: 2px solid var(--vrm-color-primary);
      outline-offset: 2px;
    }
  }
  .map-embed__label { font-weight: var(--vrm-font-weight-semibold); }
  .map-embed__hint {
    font-size: var(--vrm-font-size-sm);
    color: var(--vrm-color-text-muted);
  }
</style>

<script>
  document.querySelectorAll<HTMLElement>('.map-embed').forEach((wrap) => {
    const btn = wrap.querySelector<HTMLButtonElement>('[data-map-load]');
    btn?.addEventListener('click', () => {
      const src = wrap.dataset.mapSrc;
      const title = wrap.dataset.mapTitle ?? 'Mapa';
      if (!src) return;
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = title;
      iframe.loading = 'lazy';
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      wrap.replaceChildren(iframe);
    });
  });
</script>
```

**Verify**: `npx astro check` → 0 errors.

### Step 2: Usar el componente en contacto

En `src/pages/contacto/index.astro`:

1. Añade el import en el frontmatter (junto a los otros `~/components/...`):
   `import MapEmbed from '~/components/sections/MapEmbed.astro';`
2. Sustituye el primer `<iframe class="location__map" …>` por:
   `<MapEmbed query="Carrer de Sant Antoni Maria Claret 51, Barcelona" title="Voramà — Sant Antoni Maria Claret 51" />`
3. Sustituye el segundo iframe por:
   `<MapEmbed query="C/ de Felip II, 23, Barcelona" title="Més Millor — Felip II 23" />`
4. Borra la regla CSS `.location__map { … }` del `<style>` de la página (el tamaño/borde ahora lo aporta `.map-embed` en el componente). Deja el resto de `.location*` intacto.

**Verify**: `grep -c "google.com/maps" src/pages/contacto/index.astro` → 0 (ya no hay iframes directos en la página). `grep -c "MapEmbed" src/pages/contacto/index.astro` → 3 (1 import + 2 usos).

### Step 3: Build y comprobación

**Verify**: `npx astro check && npm run build` → exit 0.
`grep -c "<iframe" dist/contacto/index.html` → 0 (los mapas son facades; ningún `<iframe>` carga Google en la carga de página). Nota: `output=embed` SÍ aparece en los atributos `data-map-src` (inerte hasta el clic) — eso es correcto y esperado, no es un iframe pre-renderizado.

## Test plan

Sin tests unitarios (UI en `.astro`). Comprobación manual en `npm run preview`:

1. Abrir `/contacto/` con DevTools → Network: al cargar y hacer scroll a las
   ubicaciones, NO debe haber peticiones a `google.com/maps` ni a dominios de Google.
2. Pulsar "Ver mapa" en cada ubicación → se inyecta el iframe y el mapa carga.
3. Teclado: el botón es enfocable y se activa con Enter/Espacio.
4. Comprobar en móvil (≤500px) que la altura de 320px y el botón se ven bien.

## Done criteria

ALL must hold:

- [ ] `src/components/sections/MapEmbed.astro` existe
- [ ] `grep -c "google.com/maps" src/pages/contacto/index.astro` → 0
- [ ] `grep -c "MapEmbed" src/pages/contacto/index.astro` → 3
- [ ] `grep -c "<iframe" dist/contacto/index.html` → 0 tras build (0 iframes estáticos; `output=embed` solo en `data-map-src`, que es correcto)
- [ ] `npx astro check` exit 0
- [ ] `npm run build` exit 0
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 007 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- Los iframes de "Current state" no coinciden con el código vivo (deriva).
- Tras el build, `dist/contacto/index.html` SIGUE conteniendo `output=embed` como
  `src` de un iframe: el facade no se aplicó bien (¿quedó un iframe directo?).
- `astro check` se queja del genérico `querySelectorAll<HTMLElement>` o de
  `dataset` — ajusta tipos mínimamente, pero si persiste tras un intento, reporta.

## Maintenance notes

- Si en el futuro un tercer sitio necesita un mapa, este componente ya sirve
  (pásale `query` + `title`).
- Mantiene la misma postura que el facade de vídeo: ninguna conexión a terceros
  hasta interacción. Si se añade un banner de consentimiento real, este facade
  encaja (el clic actúa como consentimiento explícito por-mapa).
- Un revisor debe confirmar que el `query` se pasa por `encodeURIComponent` (ya
  está en el componente) para no romper la URL con espacios/comas.
