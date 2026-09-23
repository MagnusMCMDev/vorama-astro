# Plan 020: Imagen para compartir (Open Graph) sin franjas negras

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f1bbb0a..HEAD -- src/layouts/BaseLayout.astro src/assets/images/pages`
> Debe salir **vacío**. Si no, compara las líneas de "Current state" con el archivo; si no coinciden, STOP.

## Status

- **Priority**: P2 (petición del titular, 2026-09-23)
- **Effort**: S
- **Risk**: LOW (una imagen nueva y una línea de import; no toca la página)
- **Depends on**: 014 (en producción: genera la imagen OG en build con `getImage`)
- **Category**: seo / social
- **Planned at**: commit `f1bbb0a`, 2026-09-23

## Why this matters

Al compartir `https://vorama.es/` en Facebook o WhatsApp, la vista previa muestra la foto con **franjas negras a
izquierda y derecha** (comprobado en el depurador de Facebook y midiendo la imagen publicada: los primeros y los
últimos 100 px tienen brillo 0).

La causa es la foto de origen: `src/assets/images/pages/captura-video.webp` (1634×890) es una captura del vídeo
de la portada y **ya trae franjas negras**. La zona con imagen va de la columna 195 a la 1441 (las columnas 194 y
1442 son de transición; medido con `sharp`). `BaseLayout.astro` la recorta a 1200×630 con `fit: 'cover'`, pero
ese recorte solo quita arriba y abajo, así que las franjas se quedan.

El titular ha elegido (2026-09-23) **la misma foto sin las franjas** (opción A de la comparativa). Solución: una
imagen nueva, `og-default.webp`, recortada a la zona con imagen, y que `BaseLayout.astro` la use como origen. El
vídeo de la portada sigue usando `captura-video.webp` como póster: **no se toca**.

## Current state

- `src/layouts/BaseLayout.astro`:
  - Línea 17: `import ogDefault from '~/assets/images/pages/captura-video.webp';`
  - Línea 26: `  /** URL absoluta de la imagen Open Graph. Por defecto: se genera a partir de captura-video.webp. */`
  - Líneas 54-63 (no cambian):

```ts
// Imagen OG por defecto: se genera en build a 1200×630 (formato JPEG, el más compatible
// con WhatsApp/Facebook/X). Las páginas pueden pasar `ogImage` con una URL absoluta propia.
const ogFallback = await getImage({
  src: ogDefault,
  width: 1200,
  height: 630,
  fit: 'cover',
  position: 'center',
  format: 'jpg',
});
```

- `src/pages/index.astro:10`: `import videoPoster from '~/assets/images/pages/captura-video.webp';` (póster del
  vídeo: **no se toca**).
- `sharp` está instalado como dependencia de Astro (`node_modules/sharp`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | `31 passed` |
| Build | `npm run build` | `Complete!` (16 páginas) |

`.env` ficticio (5 claves `PUBLIC_*` = `dummy`); **nunca se commitea**.

## Scope

**In scope**: `src/assets/images/pages/og-default.webp` (crear) y `src/layouts/BaseLayout.astro` (solo las líneas
17 y 26).

**Out of scope**: `captura-video.webp` (no se modifica ni se borra: la usa el vídeo de la portada);
`src/pages/index.astro`; el resto de `BaseLayout.astro` (textos `og:image:alt`, tamaños, `getImage`); `plans/`.

## Git workflow

- Branch: `advisor/020-og-image`. Un commit: `Quitar las franjas negras de la imagen para compartir`.
- Sin push ni PR.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: `grep -o 'og:image" content="[^"]*"' dist/index.html` → contiene `captura-video`.

### Step 2: Crear la imagen sin franjas

Desde la raíz del repo:

```bash
node -e "require('sharp')('src/assets/images/pages/captura-video.webp').extract({ left: 196, top: 0, width: 1244, height: 890 }).webp({ quality: 95 }).toFile('src/assets/images/pages/og-default.webp').then(i => console.log(i.width + 'x' + i.height))"
```

**Verify**: la orden imprime `1244x890`. Y las columnas de los bordes ya no son negras:

```bash
node -e "const s=require('sharp');s('src/assets/images/pages/og-default.webp').raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{const c=x=>{let t=0,n=0;for(let y=0;y<info.height;y+=2){const i=(y*info.width+x)*info.channels;t+=(data[i]+data[i+1]+data[i+2])/3;n++}return Math.round(t/n)};console.log('izq',c(0),'der',c(info.width-1))})"
```

→ `izq` y `der` **mayores que 40** (medido en la preparación: ~129 y ~77).

### Step 3: Usarla como origen de la imagen OG

En `src/layouts/BaseLayout.astro`:

1. Línea 17 →

```ts
import ogDefault from '~/assets/images/pages/og-default.webp';
```

2. Línea 26 →

```ts
  /** URL absoluta de la imagen Open Graph. Por defecto: se genera a partir de og-default.webp (captura del vídeo sin franjas). */
```

**Verify**: `grep -c "captura-video" src/layouts/BaseLayout.astro` → `0` · `grep -c "og-default.webp" src/layouts/BaseLayout.astro` → `2` ·
`grep -c "captura-video.webp" src/pages/index.astro` → `1` (el póster no cambia).

### Step 4: Comprobar la imagen generada

`npm run check` → 0 errors · `npm test` → `31 passed` · `npm run build` → 16 páginas. Después:

- `grep -o 'og:image" content="[^"]*"' dist/index.html` → contiene `og-default` y termina en `.jpg`.
- Mide la imagen generada (sustituye la ruta por la del paso anterior, sin el dominio, dentro de `dist/`):

```bash
node -e "const s=require('sharp');const f=process.argv[1];s(f).metadata().then(m=>console.log(m.width+'x'+m.height,m.format));s(f).raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{const c=x=>{let t=0,n=0;for(let y=0;y<info.height;y+=2){const i=(y*info.width+x)*info.channels;t+=(data[i]+data[i+1]+data[i+2])/3;n++}return Math.round(t/n)};console.log('izq',c(2),'der',c(info.width-3))})" dist/_astro/og-default.XXXX.jpg
```

→ `1200x630 jpeg` e `izq`/`der` **mayores que 40**.

## Test plan

Sin tests nuevos (es una imagen). La comprobación es la medida de píxeles del Step 4 y, tras publicar, el
depurador de Facebook (acción del titular: "Volver a extraer").

## Done criteria

- [ ] `src/assets/images/pages/og-default.webp` existe, 1244×890, bordes no negros
- [ ] `BaseLayout.astro` importa `og-default.webp`; `index.astro` sigue usando `captura-video.webp`
- [ ] La imagen OG del build es 1200×630 JPEG sin franjas (bordes > 40)
- [ ] check 0 errors · 31 tests · 16 páginas; un commit; `.env` sin commitear

## STOP conditions

- La orden del Step 2 no imprime `1244x890`, o los bordes salen por debajo de 40.
- El build no genera un `og-default.*.jpg` en `dist/_astro/`.

## Maintenance notes

- Si se cambia el vídeo de la portada, `og-default.webp` no cambia sola: es una copia recortada. Para otra imagen
  para compartir, basta con sustituir `og-default.webp` por una foto **horizontal y sin franjas** (idealmente
  ≥ 1200×630) y actualizar `og:image:alt` en `BaseLayout.astro` si cambia lo que se ve.
- Tras publicar, Facebook y WhatsApp guardan la vista previa antigua en caché: en Facebook, "Volver a extraer" en el
  depurador; WhatsApp la renueva sola con el tiempo.
