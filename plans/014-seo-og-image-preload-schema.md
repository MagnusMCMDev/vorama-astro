# Plan 014: Arreglar la imagen social rota, el precargado del hero y los datos estructurados de la portada

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2f2eac9..HEAD -- src/layouts/BaseLayout.astro src/pages/index.astro src/config/site.ts astro.config.mjs`
> Cambio esperado según el orden recomendado: el plan 011 quita 4 líneas de `BaseLayout.astro` (import y 3
> `<LegalDialog>`). (Si el 012 se hubiera aplicado antes, también habrá un aviso bajo el vídeo en `index.astro`:
> no afecta a este plan.) Cualquier otro cambio: compara con "Current state" y, si no coincide, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (el cambio de `<head>` y del preload está **probado en clones de Astro 6 y de Astro 7**, ver "Current state")
- **Depends on**: none (recomendado después de 011, que también toca `BaseLayout.astro`)
- **Category**: seo / perf
- **Planned at**: commit `2f2eac9`, 2026-09-22

## Why this matters

1. **La imagen de las vistas previas está rota en todas las páginas.** `BaseLayout.astro:47` apunta a
   `https://vorama.es/og-default.webp`, un archivo que **no existe** (`curl -o /dev/null -w "%{http_code}"
   https://vorama.es/og-default.webp` → **404**; `public/` solo tiene `CNAME`, `favicon.svg`, `logo.svg` y
   `robots.txt`). Cada vez que alguien comparte la web por WhatsApp, Facebook, X o LinkedIn, sale sin
   imagen. Para un negocio que se mueve por recomendación, es de lo más caro que hay en la auditoría y de
   lo más barato de arreglar.
2. **El preload del hero descarga una imagen que no se usa.** `BaseLayout.astro:94-96` precarga
   `lcpImage.src`, que es el **original sin procesar** (`/_astro/home-hero.Covm9o4_.webp`), mientras que el
   `<img>` real usa las variantes responsive (`…_ZADf98.webp` y compañía). Resultado: ~75 KB extra
   descargados en la ruta crítica de la portada, compitiendo con el LCP de verdad. Lighthouse lo lista en
   `cache-insight` como recurso descargado.
3. **La portada declara a Google un horario que no es el suyo.** El JSON-LD dice `Mo-Sa 09:00-20:00`
   (`site.ts:34`), pero las reglas reales de reserva (`src/content/booking/availability-rules.json`) son
   **sábado y domingo 09:00-21:00 y de lunes a viernes 18:00-21:00**. Es decir: el dato dice cerrado los
   domingos (cuando es el día más abierto) y abierto los lunes por la mañana (cuando no).
4. **La portada declara una valoración inventada.** El JSON-LD publica `aggregateRating 5.0 (5 reseñas)`
   (`site.ts:43-48`), mientras que lo que el visitante ve en la sección de reseñas es **4,9 con 80 reseñas**
   (dato de Google Business, `site.ts:39-42`). Google exige que los datos estructurados coincidan con el
   contenido visible, y desde 2019 no admite valoraciones "autoservidas" de `LocalBusiness` para
   fragmentos enriquecidos: no aporta nada y expone a una acción manual por spam de datos estructurados.
5. **Fugas menores**: `<meta name="generator" content="Astro v6.4.6">` publica la versión del framework, lo
   que contradice la regla propia del proyecto (`docs/project-rules.md:67`: "NO información que identifique
   sistema (versiones de software…) en HTML público"); y el JSON-LD se inyecta con
   `set:html={JSON.stringify(schema)}` sin escapar `<`, de modo que cualquier texto futuro con `</script>`
   rompería la página (hoy todos los valores vienen del repo, así que es endurecimiento, no un fallo vivo).
6. **Sitemap con ruido**: `lastmod: new Date()` marca las 12 páginas como modificadas en cada build (señal
   que Google acaba ignorando), y el `filter` que excluye `/_dev/` nunca se cumple porque Astro no
   construye carpetas que empiezan por `_`.
7. **Una URL antigua indexada da 404.** Una búsqueda `site:vorama.es` (2026-09-22) sigue devolviendo
   `https://vorama.es/servicios/` ("Servicios Masaje Californiano, a 4 Manos, en Pareja y Eventos"), que hoy da
   **404**; la página equivalente es `/servicios-masaje-californiano/`. GitHub Pages no permite 301, pero Astro
   genera para sitios estáticos una página de redirección (`meta refresh` a 0 s + `canonical` + `noindex`) que
   Google trata como redirección permanente.

## Current state

Todo el bloque de "Steps" está **probado**: se aplicó tal cual en dos clones del repo (`astro@6.4.6` y
`astro@7.3.3`); en ambos `astro check` → 0 errores, el `imagesrcset` del preload quedó **idéntico** al
`srcset` del `<img>`, y la imagen OG se generó como `/_astro/captura-video.<hash>.jpg` de **1200×630**
(29 KB). El plan completo (Steps 2-7) se volvió a ejecutar sobre 010 + 016 + 011 + 013: 16 páginas, JSON-LD
válido con los dos tramos de horario, sitemap sin `lastmod` con 15 URL y `dist/servicios/index.html` con la
redirección.

- `src/layouts/BaseLayout.astro:16` y `44-47`:

```ts
import type { ImageMetadata } from 'astro';
…
// Imagen OG: si no se pasa, usa og-default.webp relativo al site
const siteOrigin = Astro.site?.origin ?? '';
const ogImageUrl = ogImage ?? `${siteOrigin}/og-default.webp`;
```

- `src/layouts/BaseLayout.astro:30-32` (props) y `62`, `84-96`:

```ts
  /** Imagen LCP de la página. Si se provee, se inyecta <link rel="preload" as="image">. */
  lcpImage?: ImageMetadata | undefined;
```

```astro
    <meta name="generator" content={Astro.generator} />
…
    {jsonLdSchemas.map((schema) => (
      <script is:inline type="application/ld+json" set:html={JSON.stringify(schema)} />
    ))}
…
    {lcpImage && (
      <link rel="preload" as="image" href={lcpImage.src} />
    )}
```

- `src/pages/index.astro:53-58`:

```astro
<BaseLayout
  title="Voramà Terapias — Masaje Californiano en Barcelona"
  description="Centro de masaje californiano en Barcelona. Sesiones individuales, en pareja, a cuatro manos y para eventos. Reserva online."
  jsonLd={jsonLd}
  lcpImage={homeHero}
>
```

  El `<Image>` del hero (líneas 70-78) usa `widths={[480, 768, 1024, 1400]}` y
  `sizes="(max-width: 800px) 100vw, 50vw"`; esos dos valores deben repetirse en el preload.

- `src/pages/index.astro:40-49` (JSON-LD de la portada):

```ts
  openingHours: SITE_CONFIG.openingHours,
  sameAs: [SITE_CONFIG.social.instagram].filter(Boolean),
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: SITE_CONFIG.aggregateRating.ratingValue,
    …
  },
```

- `src/config/site.ts:34-48`:

```ts
  openingHours: 'Mo-Sa 09:00-20:00', // formato schema.org
  social: {
    instagram: 'https://www.instagram.com/vorama.terapias/',
    facebook: 'https://www.facebook.com/vorama.terapias',
  },
  googleBusiness: {
    rating: 4.9,
    count: 80,
  },
  aggregateRating: {
    ratingValue: 5.0,
    reviewCount: 5,
    bestRating: 5,
    worstRating: 1,
  },
} as const;
```

  `openingHours` y `aggregateRating` **solo** se usan en `index.astro` (`grep -rn "openingHours\|aggregateRating" src`).
  `googleBusiness` sí se usa: es lo que pinta `Reviews.astro:49-50` (4,9 · 80 reseñas). `social.facebook`
  hoy no se usa en el JSON-LD.

- Horario real, de `src/content/booking/availability-rules.json` (claves `0`=domingo … `6`=sábado; los seis
  servicios coinciden en el rango, los de cuatro manos y pareja solo fin de semana):
  domingo y sábado `09:00-21:00`; lunes a viernes `18:00-21:00`.

- `astro.config.mjs:17-24`: `sitemap({ filter: (page) => !page.includes('/_dev/'), changefreq: 'monthly', priority: 0.7, lastmod: new Date() })`.
  `src/pages/_dev/` no se construye (Astro ignora lo que empieza por `_`), así que el filtro nunca se aplica.

- Imagen base para la OG: `src/assets/images/pages/captura-video.webp` (1634×890, ya se usa como póster del
  vídeo de la portada). Recorte a 1200×630 con `fit: 'cover'`: pierde poco.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | todos pasan |
| Build | `npm run build` | `Complete!` |
| Preview | `npm run preview` | http://localhost:4321/ |

`npm run build` necesita `.env` (5 claves `PUBLIC_*` con valor `dummy`; está en `.gitignore`, **no lo commitees**).

## Scope

**In scope**:
- `src/layouts/BaseLayout.astro`
- `src/pages/index.astro` (solo el objeto `jsonLd` y las props de `<BaseLayout>`)
- `src/config/site.ts` (solo `openingHours` y `aggregateRating`)
- `astro.config.mjs` (las opciones del sitemap y una clave `redirects` nueva)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- El JSON-LD de `/faqs/` (FAQPage) ni el de las 3 páginas de servicio: están bien.
- `Reviews.astro` y `SITE_CONFIG.googleBusiness`: el 4,9/80 visible se queda como está.
- `public/robots.txt`.
- Las imágenes del repo (no se añade ningún archivo nuevo: la OG se genera en build).
- Los `<Image>` de las páginas.

## Git workflow

- Branch: `advisor/014-seo`.
- Commits: (1) imagen OG generada + metadatos; (2) preload correcto del LCP; (3) datos estructurados de la
  portada; (4) sitemap. Español, imperativo, ≤70 caracteres.
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: `grep -o '<meta property="og:image" content="[^"]*"' dist/index.html` → `…/og-default.webp` ·
`grep -o '<link rel="preload" as="image"[^>]*>' dist/index.html` → `href="/_astro/home-hero.Covm9o4_.webp"` (sin `imagesrcset`).

### Step 2: Imagen Open Graph real (generada en build)

En `BaseLayout.astro`, tras el `import type { ImageMetadata } from 'astro';`, añade:

```ts
import { getImage } from 'astro:assets';
import ogDefault from '~/assets/images/pages/captura-video.webp';
```

y sustituye el cálculo de `ogImageUrl` por:

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
const ogImageUrl = ogImage ?? new URL(ogFallback.src, siteOrigin).href;
```

Actualiza también el comentario de la prop (`/** URL absoluta imagen Open Graph. Por defecto: og-default.webp. */`)
→ `/** URL absoluta de la imagen Open Graph. Por defecto: se genera a partir de captura-video.webp. */`.

Y en el `<head>`, junto a `<meta property="og:image" …>`, añade:

```astro
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Manos dando un masaje californiano sobre la espalda en Voramà Terapias" />
```

y tras `<meta name="twitter:image" …>`:

```astro
    <meta name="twitter:image:alt" content="Manos dando un masaje californiano sobre la espalda en Voramà Terapias" />
```

**Verify**: `npm run build` → OK · `ls dist/_astro/captura-video*.jpg | wc -l` → `1` ·
`grep -o '<meta property="og:image" content="[^"]*"' dist/contacto/index.html` → una URL
`https://vorama.es/_astro/captura-video.<hash>.jpg` · comprobar que mide 1200×630:

```
node -e "const fs=require('fs');const f=fs.readdirSync('dist/_astro').find(n=>/^captura-video.*\.jpg$/.test(n));const b=fs.readFileSync('dist/_astro/'+f);let i=2;while(i<b.length){if(b[i]!==0xFF){i++;continue;}const m=b[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){console.log(f,b.readUInt16BE(i+7)+'x'+b.readUInt16BE(i+5));break;}i+=2+b.readUInt16BE(i+2);}"
```

→ `captura-video.<hash>.jpg 1200x630`.

### Step 3: Precargar la variante que se usa de verdad

En `BaseLayout.astro`:

1. Props — tras `lcpImage?: ImageMetadata | undefined;`:

```ts
  /** Anchos del <Image> LCP; deben coincidir con los de la página. */
  lcpWidths?: number[] | undefined;
  /** `sizes` del <Image> LCP; debe coincidir con el de la página. */
  lcpSizes?: string | undefined;
```

   y añade `lcpWidths,` y `lcpSizes,` a la desestructuración de `Astro.props`.

2. Tras el cálculo de `ogImageUrl`:

```ts
// Preload del LCP: hay que generar las MISMAS variantes que el <Image> de la página,
// o el navegador descarga una imagen de más (era el caso con `lcpImage.src`, el original).
const lcpPreload = lcpImage
  ? await getImage({
      src: lcpImage,
      widths: lcpWidths ?? [480, 768, 1024, 1400],
      sizes: lcpSizes ?? '100vw',
    })
  : null;
```

3. Sustituye el bloque del preload por:

```astro
    {lcpPreload && (
      <link
        rel="preload"
        as="image"
        href={lcpPreload.src}
        imagesrcset={lcpPreload.srcSet.attribute}
        imagesizes={lcpSizes}
        fetchpriority="high"
      />
    )}
```

4. En `index.astro`, en `<BaseLayout … lcpImage={homeHero}>`, añade las dos props:

```astro
  lcpImage={homeHero}
  lcpWidths={[480, 768, 1024, 1400]}
  lcpSizes="(max-width: 800px) 100vw, 50vw"
```

**Verify**: `npm run check` → 0 errors · `npm run build` → OK · el preload y el `<img>` coinciden:

```
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const p=h.match(/<link rel=\"preload\" as=\"image\"[^>]*imagesrcset=\"([^\"]+)\"/)[1];const i=h.match(/<img[^>]*class=\"hero__img\"[^>]*>/)[0].match(/srcset=\"([^\"]+)\"/)[1];console.log(p===i?'MATCH':'DIFF\n'+p+'\n'+i)"
```

→ `MATCH` · `grep -c "home-hero.Covm9o4_.webp\"" dist/index.html` → `0` (ya no se referencia el original).

### Step 4: Quitar el `generator` y escapar el JSON-LD

1. Borra la línea `<meta name="generator" content={Astro.generator} />` (`docs/project-rules.md:67`).
2. Cambia la inyección del JSON-LD por:

```astro
    {jsonLdSchemas.map((schema) => (
      <script is:inline type="application/ld+json" set:html={JSON.stringify(schema).replace(/</g, '\\u003c')} />
    ))}
```

**Verify**: `npm run build` → OK · `grep -c 'name="generator"' dist/index.html` → `0` ·
el JSON-LD sigue siendo válido:

```
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const m=[...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];m.forEach(x=>JSON.parse(x[1]));console.log('ld+json OK:',m.length)"
```

→ `ld+json OK: 1`.

### Step 5: Datos estructurados de la portada honestos

1. En `site.ts`, sustituye la línea `openingHours: 'Mo-Sa 09:00-20:00', // formato schema.org` por:

```ts
  /**
   * Horario de atención publicado en los datos estructurados.
   * Debe coincidir con src/content/booking/availability-rules.json (0=domingo … 6=sábado).
   */
  openingHours: [
    { days: ['Saturday', 'Sunday'], opens: '09:00', closes: '21:00' },
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '18:00', closes: '21:00' },
  ],
```

2. En `site.ts`, borra el bloque `aggregateRating: { … },` entero (deja `googleBusiness` como está).

3. En `index.astro`, dentro del objeto `jsonLd`:
   - sustituye `openingHours: SITE_CONFIG.openingHours,` por:

```ts
  openingHoursSpecification: SITE_CONFIG.openingHours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [...h.days],
    opens: h.opens,
    closes: h.closes,
  })),
```

   - sustituye `sameAs: [SITE_CONFIG.social.instagram].filter(Boolean),` por:

```ts
  sameAs: [SITE_CONFIG.social.instagram, SITE_CONFIG.social.facebook].filter(Boolean),
```

   - **borra** el bloque `aggregateRating: { … },` entero.

**Verify**: `npm run check` → 0 errors · `npm run build` → OK ·
`grep -c "aggregateRating" dist/index.html` → `0` ·
`node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const j=JSON.parse(h.match(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/)[1]);console.log(JSON.stringify(j.openingHoursSpecification));console.log(j.sameAs.length)"`
→ dos especificaciones (sáb+dom 09:00-21:00 y lun-vie 18:00-21:00) y `2`.

### Step 6: Limpiar el sitemap

En `astro.config.mjs`, deja la integración así (fuera el `filter` muerto y el `lastmod` de build):

```js
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
    }),
```

**Verify**: `npm run build` → OK · `grep -c "lastmod" dist/sitemap-0.xml` → `0` ·
`grep -o "<loc>" dist/sitemap-0.xml | wc -l` → el mismo número de páginas que antes del cambio
(12, o 15 si el plan 011 ya está aplicado; la 404 nunca aparece).

### Step 7: Redirigir la URL antigua `/servicios/`

En `astro.config.mjs`, justo después de `trailingSlash: 'always',`, añade:

```js
  // URLs antiguas que Google aún tiene indexadas → página nueva
  // (en build estático Astro genera una página con meta refresh + canonical + noindex).
  redirects: {
    '/servicios': '/servicios-masaje-californiano/',
  },
```

**Verify**: `npm run build` → OK (el número de páginas **no** cambia: las redirecciones no cuentan) ·
`grep -o 'http-equiv="refresh" content="0;url=/servicios-masaje-californiano/"' dist/servicios/index.html | wc -l` → `1` ·
`grep -o '<link rel="canonical" href="https://vorama.es/servicios-masaje-californiano/">' dist/servicios/index.html | wc -l` → `1` ·
`grep -c "vorama.es/servicios/<" dist/sitemap-0.xml` → `0`.

### Step 8: Verificación final

**Verify**: `npm run check` → 0 errors · `npm test` → pasa · `npm run build` → OK ·
con `npm run preview`, abrir la portada y comprobar en el HTML que `og:image` apunta a un `.jpg` existente
(`curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/_astro/<el jpg>` → `200`).

## Test plan

Sin tests unitarios (marcado de `<head>` y configuración). La red de seguridad son los checks de cada paso.
Tras el despliegue, el **operador** debería:

1. Pasar la portada por el validador de resultados enriquecidos de Google y por
   https://validator.schema.org/ (pegar `https://vorama.es/`): 0 errores.
2. Compartir `https://vorama.es/` en WhatsApp (o usar el depurador de Facebook) y ver que sale la imagen.
   Si Facebook o WhatsApp tienen cacheado el enlace, forzar el re-scrape desde el depurador.
3. En Google Search Console: comprobar que el sitemap está enviado (`https://vorama.es/sitemap-index.xml`),
   revisar "Páginas → No se ha encontrado (404)" y, por cada URL antigua con equivalente en la web nueva,
   añadir una entrada a `redirects` en `astro.config.mjs` (mismo formato que `/servicios`). Confirmar
   también el horario que se muestra en el perfil de empresa.

## Done criteria

- [ ] `grep -c 'name="generator"' dist/index.html` → 0
- [ ] `og:image` (y `twitter:image`) apuntan a `https://vorama.es/_astro/captura-video.<hash>.jpg`, que existe en `dist/` y mide 1200×630
- [ ] El `imagesrcset` del preload es idéntico al `srcset` del `<img>` del hero (script del Step 3 → `MATCH`)
- [ ] `grep -c "aggregateRating" dist/index.html` → 0 y el JSON-LD lleva `openingHoursSpecification` con los dos tramos reales
- [ ] `grep -c "lastmod" dist/sitemap-0.xml` → 0
- [ ] `dist/servicios/index.html` redirige a `/servicios-masaje-californiano/` (meta refresh + canonical) y no está en el sitemap
- [ ] `npm run check` 0 errors · `npm test` pasa · `npm run build` OK
- [ ] `git status` sin cambios fuera del Scope (y sin `.env`)
- [ ] Fila 014 de `plans/README.md` actualizada

## STOP conditions

Para y reporta si:

- El script del Step 3 imprime `DIFF`: significa que los `widths`/`sizes` del preload y del `<Image>` no
  coinciden. **No inventes valores**: si no consigues que coincidan, quita el preload entero (el `<img>` ya
  lleva `fetchpriority="high"`) y dilo en el informe.
- `getImage` falla con `fit`/`position`/`format` (cambio de API del servicio de imágenes): repórtalo en vez
  de añadir una imagen estática a `public/`.
- El horario de `availability-rules.json` ya no coincide con el que fija este plan: usa el del JSON y avisa.
- `astro check` marca error de tipos en `SITE_CONFIG.openingHours.map(...)` (el objeto es `as const`, así que
  `days` es `readonly`; por eso el plan usa `[...h.days]`).

## Maintenance notes

- La imagen OG se genera desde `captura-video.webp`: si se cambia esa foto, la vista previa cambia.
  Para una imagen social propia (con logo y claim), basta con sustituir el import por el asset nuevo.
- `openingHours` en `site.ts` y `availability-rules.json` son dos fuentes que hay que mantener a la vez;
  si divergen, el horario publicado a Google será falso. Cambiar el horario de reserva implica tocar los dos.
- Si algún día se añaden reseñas propias en la web (no las de Google), revisar si procede `aggregateRating`:
  debe salir de reseñas visibles en esa misma página.
- Revisor: comprobar que ninguna página pasa `ogImage` con URL relativa (debe ser absoluta).
