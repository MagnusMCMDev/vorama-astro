# Plan 009 (spike): Resolver el dominio definitivo y preparar el cutover

> **Executor instructions**: Este es un plan de **spike/diseño**, no de
> implementación a ciegas. Tiene una decisión bloqueante (qué dominio) que NO
> puedes tomar tú. Ejecuta la Fase A (resolución) y DETENTE para que el operador
> decida; solo entonces ejecuta la Fase B. Run every verification command. When
> done (o al detenerte en A), update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- astro.config.mjs src/config/site.ts public/robots.txt`
> Compara con "Current state" si hubo cambios.

## Status

- **Priority**: P2 (bloqueante de lanzamiento, pero no automatizable end-to-end)
- **Effort**: M
- **Risk**: MED (URLs/SEO; un error rompe canonicals, sitemap o la API key)
- **Depends on**: none (recomendado hacerlo al final, tras estabilizar el resto)
- **Category**: migration
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

El sitio está configurado para una URL **provisional** de GitHub Pages
(`https://magnusmcmdev.github.io` + `base: '/vorama-astro/'`) y el propio código
lo admite con un `TODO`. Pero hay **tres dominios distintos** mencionados en el
repo, lo que indica que el definitivo no está decidido ni unificado:

- `magnusmcmdev.github.io/vorama-astro` — actual (config, robots, sitemap).
- `voramaterapias.com` — aparece en el pie del email de reservas (`submit.ts:50`: "Enviado desde voramaterapias.com").
- `vorama.es` — aparece como ejemplo en `docs/conventions.md`.

Hasta resolver esto y hacer el cutover, el sitio no puede lanzarse en su dominio
real: los canonicals, el sitemap, las URLs Open Graph y —crítico— la
**restricción por HTTP referrer de la API key de Google Calendar** apuntan al
dominio provisional. Si se publica en el dominio real sin actualizar el referrer,
el widget de reservas dejará de cargar disponibilidad (403). Este plan resuelve
la ambigüedad y deja un checklist de cutover verificable.

## Current state

- `astro.config.mjs:8-11`:

```js
output: 'static',
site: 'https://magnusmcmdev.github.io',
base: '/vorama-astro/',
trailingSlash: 'always',
```

- `src/config/site.ts:10-12`:

```ts
// URL del sitio — provisional hasta el dominio definitivo
// TODO: cambiar a dominio definitivo antes de lanzar producción
export const SITE_URL = 'https://magnusmcmdev.github.io';
```

- `public/robots.txt:5` → `Sitemap: https://magnusmcmdev.github.io/vorama-astro/sitemap-index.xml`
- `src/lib/booking/submit.ts:50` → cierre del email: `'— Enviado desde voramaterapias.com'`.
- `.env.example:13-15` documenta que la API key de Google está restringida por
  HTTP referrer a `https://magnusmcmdev.github.io/*` (y "el dominio final").
- `BASE_URL` (`import.meta.env.BASE_URL`) se usa para construir rutas (p.ej.
  favicon en `BaseLayout.astro:99`). Si se pasa a dominio propio en la raíz, el
  `base` cambia de `/vorama-astro/` a `/`.
- No existe `public/CNAME` (necesario para dominio propio en GitHub Pages).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Inventario URLs | `grep -rn "magnusmcmdev\|voramaterapias\|vorama.es\|vorama-astro" src/ public/ astro.config.mjs` | lista de todos los puntos a tocar |
| Typecheck | `npx astro check`  | 0 errors |
| Build     | `npm run build`    | exit 0 |
| Comprobar canonicals | `grep -rn "rel=\"canonical\"" dist/` | apuntan al dominio nuevo |

## Scope

**In scope (Fase B, solo tras decisión):**
- `astro.config.mjs` (`site`, `base`)
- `src/config/site.ts` (`SITE_URL`)
- `public/robots.txt` (URL del sitemap)
- `public/CNAME` (crear, si es dominio propio)
- `src/lib/booking/submit.ts` (pie del email, si el dominio cambia)
- `plans/README.md`

**Out of scope:**
- Cambiar el contenido/diseño de las páginas.
- La configuración en **Google Cloud Console** (referrer de la API key) y en
  **GitHub → Settings → Pages** (custom domain + DNS) — son acciones del
  operador fuera del repo; este plan las lista pero no las ejecuta.

> **DECISIÓN REGISTRADA (2026-06-13):** el operador eligió **`vorama.es`** en la
> **raíz** (`base: '/'`). Fase A resuelta. Para la Fase B usa
> `<DOMINIO>` = `https://vorama.es` y `<BASE>` = `/`. El email de reservas
> (`submit.ts`, hoy "voramaterapias.com") debe pasar a `vorama.es` (Step B5).
> **No ejecutar la Fase B hasta el día del cutover coordinado** (requiere DNS +
> dominio personalizado en GitHub Pages + referrer de la API key Google a
> `vorama.es`); pushear `base: '/'` antes rompe la web servida en github.io.

## Fase A — Resolver el dominio (BLOQUEANTE)

### Step A1: Inventariar todas las apariciones de dominio

Ejecuta:
`grep -rn "magnusmcmdev\|voramaterapias\|vorama\.es\|vorama-astro" src/ public/ astro.config.mjs docs/`

Anota cada punto. Esto es el universo de cambios de la Fase B.

### Step A2: DETENERTE y pedir la decisión al operador

Presenta al operador esta pregunta y **espera respuesta** (no elijas tú):

> El repo menciona tres dominios: `magnusmcmdev.github.io/vorama-astro` (actual),
> `voramaterapias.com` (en el email de reservas) y `vorama.es` (en docs).
> ¿Cuál es el dominio definitivo de producción? ¿Será en la **raíz** del dominio
> (`base: '/'`) o en un subpath?

Marca este plan como **BLOCKED — esperando decisión de dominio** en
`plans/README.md` y reporta. NO continúes a la Fase B sin la respuesta.

## Fase B — Cutover (solo con el dominio confirmado: `<DOMINIO>`)

> Sustituye `<DOMINIO>` por el valor decidido (p.ej. `https://voramaterapias.com`)
> y `<BASE>` por `/` (dominio propio en raíz) o el subpath que corresponda.

### Step B1: astro.config.mjs

`site: '<DOMINIO>'` y `base: '<BASE>'`. Si `<BASE>` es `/`, déjalo como `base: '/'`.

**Verify**: `npx astro check` → 0 errors.

### Step B2: site.ts

`export const SITE_URL = '<DOMINIO>';` y borra el comentario `TODO`/"provisional".

### Step B3: robots.txt

`Sitemap: <DOMINIO><BASE>sitemap-index.xml` (cuida de no duplicar la barra).

### Step B4: CNAME (solo si es dominio propio)

Crea `public/CNAME` con una sola línea: el host sin protocolo
(p.ej. `voramaterapias.com`). GitHub Pages lo usa para el custom domain.

### Step B5: pie del email de reservas

Si el dominio definitivo NO es `voramaterapias.com`, actualiza
`src/lib/booking/submit.ts:50` para que el texto "Enviado desde …" use el
dominio correcto.

### Step B6: build y verificación de URLs

**Verify**:
- `npm run build` → exit 0.
- `grep -rn "rel=\"canonical\"" dist/index.html` → la URL canónica empieza por `<DOMINIO>`.
- `grep -rn "magnusmcmdev" dist/` → 0 (no quedan URLs provisionales en el build).
- Si `<BASE>` cambió a `/`: comprobar que assets/favicon resuelven (`grep -n "favicon" dist/index.html` → ruta sin `/vorama-astro/`).

### Step B7: checklist de acciones del operador (NO las ejecuta el executor)

Deja estas tareas explícitas en el reporte para que el operador las haga:

1. **GitHub → Settings → Pages**: configurar el custom domain `<DOMINIO>` y el DNS
   (A/AAAA o CNAME del proveedor de dominio).
2. **Google Cloud Console → Credentials → la API key de Calendar**: actualizar la
   restricción de HTTP referrer para incluir `<DOMINIO>/*` (mantener el viejo
   referrer hasta confirmar que el nuevo funciona, luego retirarlo).
3. **Web3Forms**: si el panel filtra por dominio de origen, añadir `<DOMINIO>`.
4. Verificar en producción que el widget carga disponibilidad (no 403) y que un
   envío de prueba llega por email.

## Test plan

No hay tests automatizados de dominio. La verificación es:
- Los `grep` de Step B6 sobre `dist/`.
- La verificación manual post-deploy del checklist B7 (widget sin 403, email OK).

## Done criteria

**Fase A** (si te detienes ahí): inventario entregado + pregunta planteada +
fila 009 marcada BLOCKED. Eso es un resultado válido y completo para este plan.

**Fase B** (con dominio decidido), ALL must hold:
- [ ] `astro.config.mjs` y `site.ts` usan `<DOMINIO>`/`<BASE>` decididos
- [ ] `grep -rn "magnusmcmdev" dist/` → 0 tras build
- [ ] canonicals en `dist/` apuntan a `<DOMINIO>`
- [ ] `public/CNAME` existe (si dominio propio)
- [ ] `npx astro check` y `npm run build` exit 0
- [ ] checklist B7 entregado al operador en el reporte
- [ ] Fila 009 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- (Fase A) No hay respuesta del operador sobre el dominio → quédate en BLOCKED.
- El cambio de `base` a `/` rompe rutas internas que asumían `/vorama-astro/`
  (busca usos de `import.meta.env.BASE_URL` y rutas absolutas `/vorama-astro/...`
  en `src/`). Si encuentras rutas hardcodeadas con el subpath, repórtalo: hay que
  migrarlas a `BASE_URL` antes del cutover.
- Tras el build quedan URLs `magnusmcmdev` en `dist/` que no salen de los
  archivos in-scope (puede haber un literal escondido) → repórtalo.

## Maintenance notes

- El acoplamiento `astro.config.site` ↔ `site.ts SITE_URL` es manual: deben
  coincidir siempre. Considera (follow-up) importar uno desde el otro o derivar
  `SITE_URL` de `import.meta.env.SITE`.
- La restricción de referrer de la API key es el punto más fácil de olvidar y el
  que rompe reservas en silencio (403 → el widget muestra error genérico).
  Cualquier cambio de dominio futuro debe repetir el paso 2 del checklist B7.
- Si se mantiene GitHub Pages como hosting con dominio propio, el deploy actual
  (`.github/workflows/deploy.yml`) sigue valiendo; solo cambian `site`/`base` y
  el CNAME.
