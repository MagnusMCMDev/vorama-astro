# Plan 021: Completar los datos del negocio para Google (`image` y `priceRange`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ac2da3..HEAD -- src/pages/index.astro src/layouts/BaseLayout.astro src/content/booking/services.json`
> Debe salir **vacío**. Si no, compara las líneas de "Current state" con los archivos; si no coinciden, STOP.

## Status

- **Priority**: P3 (petición del titular, 2026-09-23)
- **Effort**: S
- **Risk**: LOW (solo añade dos campos al JSON-LD de la portada)
- **Depends on**: 020 (en producción: `og-default.webp` es el origen de la imagen OG)
- **Category**: seo
- **Planned at**: commit `6ac2da3`, 2026-09-23

## Why this matters

La prueba de resultados enriquecidos de Google da la portada por **válida** (`HealthAndBeautyBusiness`), pero con
dos avisos: **falta el campo `image` (opcional)** y **falta el campo `priceRange` (opcional)**. Google los
recomienda para los negocios locales y la web ya tiene los datos:

- `image`: la misma imagen que se usa al compartir (Open Graph), que el plan 020 dejó sin franjas.
- `priceRange`: el rango de precios del sistema de reservas, **calculado en cada build** desde
  `src/content/booking/services.json` para que no se quede desfasado si cambian los precios. Hoy: `60-130 €`.

## Current state

- `src/pages/index.astro`:
  - Línea 2: `import { Image } from 'astro:assets';`
  - Línea 15 (último import de imágenes): `import bgEventos from '~/assets/images/pages/playa-spa.webp';`
  - Línea 20: `// JSON-LD LocalBusiness para SEO de portada`, y en las líneas 21-27:

```ts
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HealthAndBeautyBusiness',
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.url,
  telephone: SITE_CONFIG.telephone,
```

- `src/layouts/BaseLayout.astro` genera la imagen OG así (**no se toca**; el plan repite exactamente estas opciones
  para que Astro reutilice el mismo archivo):

```ts
const ogFallback = await getImage({
  src: ogDefault,
  width: 1200,
  height: 630,
  fit: 'cover',
  position: 'center',
  format: 'jpg',
});
```

- `src/content/booking/services.json`: array de `{ id, name, durationMin, priceEur }`; precios 60, 80, 100, 130,
  100, 130. Ya se importa como JSON en `src/lib/booking/widget-render.ts`
  (`import servicesData from '../../content/booking/services.json';`). Alias `~/*` → `src/*` (`tsconfig.json`).
- `BaseLayout.astro` pinta cada JSON-LD con `JSON.stringify` en un `<script type="application/ld+json">`.
- `astro.config.mjs`: `site: 'https://vorama.es'`, así que `Astro.site` está definido.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | `31 passed` |
| Build | `npm run build` | `Complete!` (16 páginas) |

`.env` ficticio (5 claves `PUBLIC_*` = `dummy`); **nunca se commitea**.

## Scope

**In scope**: `src/pages/index.astro` (imports, cálculo previo y dos campos del objeto `jsonLd`).

**Out of scope**: `BaseLayout.astro`, `services.json`, `src/config/site.ts`, el resto de páginas y de campos del
JSON-LD; `plans/`.

## Git workflow

- Branch: `advisor/021-jsonld`. Un commit: `Añadir imagen y rango de precios a los datos del negocio`.
- Sin push ni PR.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: el JSON-LD de la portada aún no tiene esos campos:

```bash
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const b=[...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs)].map(x=>JSON.parse(x[1])).find(x=>x['@type']==='HealthAndBeautyBusiness');console.log('image' in b, 'priceRange' in b)"
```

→ `false false`.

### Step 2: Editar `src/pages/index.astro`

1. Línea 2 →

```ts
import { Image, getImage } from 'astro:assets';
```

2. Justo después de la línea `import bgEventos from '~/assets/images/pages/playa-spa.webp';`, añade:

```ts
import ogDefault from '~/assets/images/pages/og-default.webp';
import bookingServices from '~/content/booking/services.json';
```

3. Justo **antes** de la línea `// JSON-LD LocalBusiness para SEO de portada`, añade:

```ts
// Campos opcionales que Google recomienda para el negocio local:
// - image: la misma imagen que Open Graph (mismas opciones que BaseLayout, así Astro reutiliza el archivo).
// - priceRange: calculado de los precios del sistema de reservas, para que no se quede desfasado.
const businessImage = await getImage({
  src: ogDefault,
  width: 1200,
  height: 630,
  fit: 'cover',
  position: 'center',
  format: 'jpg',
});
const bookingPrices = bookingServices.map((s) => s.priceEur);
const priceRange = `${Math.min(...bookingPrices)}-${Math.max(...bookingPrices)} €`;

```

4. En el objeto `jsonLd`, añade `image` justo después de `url: SITE_CONFIG.url,` y `priceRange` justo después de
   `telephone: SITE_CONFIG.telephone,`, de modo que esas líneas queden así:

```ts
  url: SITE_CONFIG.url,
  image: new URL(businessImage.src, Astro.site).href,
  telephone: SITE_CONFIG.telephone,
  priceRange,
```

**Verify**: `npm run check` → 0 errors · `grep -c "getImage\|og-default.webp\|services.json\|priceRange" src/pages/index.astro` → `≥6`.

### Step 3: Verificación

`npm test` → `31 passed` · `npm run build` → 16 páginas. Después:

```bash
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const b=[...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs)].map(x=>JSON.parse(x[1])).find(x=>x['@type']==='HealthAndBeautyBusiness');const og=(h.match(/og:image\" content=\"([^\"]*)\"/)||[])[1];console.log('image:',b.image);console.log('igual que og:image:',b.image===og);console.log('priceRange:',b.priceRange)"
```

→ `image: https://vorama.es/_astro/og-default.<hash>.jpg`, `igual que og:image: true`, `priceRange: 60-130 €`.

Y que no se ha generado una segunda copia de la imagen: `ls dist/_astro | grep -c "^og-default"` → `1`.

## Test plan

Sin tests unitarios (es una página `.astro`): la comprobación es el JSON-LD del build (Step 3). Tras publicar, el
titular puede repetir la prueba de resultados enriquecidos de Google: deben desaparecer los dos avisos.

## Done criteria

- [ ] JSON-LD de la portada con `image` (= `og:image`) y `priceRange` = `60-130 €`
- [ ] Una sola imagen `og-default.*.jpg` en `dist/_astro/`
- [ ] check 0 errors · 31 tests · 16 páginas; un commit con solo `src/pages/index.astro`; `.env` sin commitear

## STOP conditions

- `npm run check` da errores de tipos en `bookingServices` o en `Astro.site`.
- El build genera dos archivos `og-default.*.jpg` (las opciones de `getImage` no coinciden con las de `BaseLayout`).

## Maintenance notes

- `priceRange` sale de `services.json`: si se añade un servicio con precio muy distinto (p. ej. eventos con
  presupuesto cerrado), el rango cambia solo; revisar que siga siendo representativo.
- Si cambian las opciones de la imagen OG en `BaseLayout.astro`, cambiar también las de aquí (o sacar las dos a una
  función común) para no generar dos imágenes.
