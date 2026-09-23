# Plan 010: Actualizar a Astro 7 y Vitest 5 y dejar `npm audit` a cero

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2f2eac9..HEAD -- package.json package-lock.json astro.config.mjs src/content.config.ts src/lib/booking/schemas.ts`
> Si algún archivo in-scope cambió desde que se escribió este plan, compara los
> extractos de "Current state" con el código vivo antes de continuar; si no
> coinciden, trátalo como STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (validado en un spike completo sobre un clon del repo, ver "Current state")
- **Depends on**: none
- **Category**: migration / security
- **Planned at**: commit `2f2eac9`, 2026-09-22

## Why this matters

`npm audit` sobre el lockfile actual da **16 vulnerabilidades (1 crítica, 7 altas,
7 moderadas, 1 baja)**. La crítica está en el propio `astro@6.4.6` (XSS en
`renderHTMLElement` con nombres de atributo en spread, y en valores de directivas
`transition:*`) y **solo se corrige en `astro@7.3.3`**: la rama 6.x no recibe parches
desde `6.4.8` (2026-06-17). `sharp` (CVEs de libvips/libheif, alta) y `esbuild`
(lectura arbitraria de ficheros del servidor de desarrollo **en Windows**, que es la
máquina de desarrollo del proyecto) también solo se arreglan subiendo a Astro 7. El
resto se corrige con `npm audit fix` sin cambios rompedores. Para los visitantes el
riesgo real es bajo (sitio estático, contenido propio), pero seguir en una rama sin
parches no es sostenible. De paso se elimina una dependencia "fantasma": el código
importa `zod` sin declararlo en `package.json`.

## Current state

Evidencia de que el cambio es seguro: se hizo el upgrade completo en un clon
desechable del repo (commit `2f2eac9`) con exactamente los comandos de este plan y el
resultado fue: `astro check` 0 errores/0 warnings/0 hints, `npm test` 14/14, `npm run
build` 12 páginas, `npm audit` → `found 0 vulnerabilities`, y el HTML renderizado de
los textos legales (Markdown) **idéntico byte a byte** al de Astro 6. El compilador
nuevo de Astro 7 (Rust, más estricto con el HTML) no dio ningún error.

- `package.json` — dependencias actuales:

```json
  "dependencies": {
    "@astrojs/sitemap": "^3.7.2",
    "astro": "^6.3.1"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.9",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
```

  (Resueltas en el lockfile: astro 6.4.6, sitemap 3.7.3, check 0.9.9, typescript 6.0.3, vitest 4.1.8.)

- `src/content.config.ts:3` — importa zod directamente, sin declararlo:

```ts
import { z } from 'zod';
```

- `src/lib/booking/schemas.ts:1-7`:

```ts
/**
 * Zod schemas del módulo de reservas — compatible con Zod v4 (bundleado en Astro 6).
 * Usados tanto en build-time (validar JSON de content collections)
 * como en runtime (validar formulario antes de enviar).
 */

import { z } from 'zod';
```

  `zod` NO está en `package.json`: hoy se resuelve porque `astro` lo trae como
  dependencia transitiva. Astro exporta oficialmente `astro/zod` (existe tanto en
  6.x como en 7.x; comprobado). Cambiar a `astro/zod` elimina la dependencia fantasma.

- `astro.config.mjs:11` — `compressHTML: true` está puesto **explícitamente**. En Astro 7
  el valor por defecto cambia a `'jsx'` (quita espacios entre elementos inline); al estar
  fijado a `true`, el HTML se mantiene igual. **No lo toques.**

- **TypeScript debe quedarse en 6.x.** Existe `typescript@7.0.2` (compilador nativo),
  pero `@astrojs/check@0.9.10` declara `peerDependencies: { "typescript": "^5.0.0 || ^6.0.0" }`:
  con TS 7, `npm run check` (que corre en CI) dejaría de funcionar.

- **CSS: Astro 7 cambia el ámbito de los selectores anidados** (comprobado comparando el CSS completo de
  los dos builds). En Astro 6, `.padre { & h2 {…} }` se compilaba como `& h2[data-astro-cid-…]`; en Astro 7
  sale `& h2` (sin el atributo), así que también alcanza elementos que no genera el componente. Hay 19
  selectores así en el repo. Se comprobó sobre el HTML de las 12 páginas cuáles alcanzan elementos ajenos:
  **solo los de `.legal-content`** (el texto legal en Markdown de los diálogos), que en Astro 6 salía **sin**
  sus estilos por ese mismo motivo y en Astro 7 los recibe. Es un arreglo, no una regresión: ningún otro
  elemento del sitio cambia de estilo.
- **CSS: sintaxis de rango en media queries.** Astro 7 (Vite 8) minifica `@media (max-width:600px)` como
  `@media (width<=600px)`. Es equivalente, pero requiere Safari ≥ 16.4. No sube el mínimo real: el CSS de
  producción ya usa anidamiento nativo (`&`), que requiere Safari ≥ 16.5. No se toca (ver Maintenance notes).
- Cambios rompedores de Astro 7 revisados contra este repo (guía oficial:
  https://docs.astro.build/en/guides/upgrade-to/v7/): Vite 8 (el repo no tiene plugins
  de Vite propios), compilador Rust estricto con HTML (spike: 0 errores), Markdown con el
  procesador nativo Sätteri (spike: salida idéntica), `compressHTML` por defecto `'jsx'`
  (ya fijado a `true`), `src/fetch.ts` reservado (no existe), `@astrojs/db` y APIs internas
  de `astro:transitions` eliminadas (no se usan). Vitest 5: sus cambios (mocks, timers
  falsos, bench, `toThrow("")`) no afectan a la suite, que no usa nada de eso.

- Convenciones: mensajes de commit en español, imperativo, ≤70 caracteres
  (`docs/conventions.md`). Ejemplo real del log: `Cargar mapas de Google con facade de clic en contacto`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors`, `0 warnings`, `0 hints` |
| Tests | `npm test` | `Tests  14 passed (14)` |
| Build | `npm run build` | `12 page(s) built`, `Complete!` |
| Audit | `npm audit` | `found 0 vulnerabilities` (al final del plan) |

**`npm run build` necesita un fichero `.env`** (el frontmatter de `ContactForm.astro`
lanza un error si faltan las claves de Web3Forms). En un worktree nuevo crea uno con
valores ficticios — `.env` está en `.gitignore`, **nunca lo añadas a git**:

```
PUBLIC_GCAL_API_KEY=dummy
PUBLIC_GCAL_CALENDAR_ID=dummy
PUBLIC_WEB3FORMS_KEY=dummy
PUBLIC_WEB3FORMS_KEY_CONTACTO=dummy
PUBLIC_WEB3FORMS_KEY_REGALA=dummy
```

## Scope

**In scope** (los únicos archivos que puedes modificar):
- `package.json`
- `package-lock.json` (lo regenera npm)
- `src/content.config.ts` (solo la línea del import de zod)
- `src/lib/booking/schemas.ts` (solo el import de zod y el comentario de cabecera)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- `typescript` — se queda en `^6.0.3` (ver "Current state").
- `astro.config.mjs` — en particular no quites `compressHTML: true`.
- `.github/workflows/*` — la versión de Node y las actions las cambia el plan 015.
- Cualquier `.astro` o `.ts` más allá de los dos imports.

## Git workflow

- Branch: `advisor/010-astro7`.
- Un commit por paso lógico (dependencias; imports de zod). Mensajes en español, imperativo, ≤70 caracteres.
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Línea base

`npm ci`, crea el `.env` ficticio si no existe, y ejecuta las verificaciones.

**Verify**: `npm run check` → 0 errors · `npm test` → `14 passed` · `npm run build` → `12 page(s) built`.

### Step 2: Subir Astro, integraciones y Vitest (sin tocar TypeScript)

```
npm install astro@^7.3.3 @astrojs/sitemap@^3.7.4 @astrojs/check@^0.9.10 vitest@^5.0.1
```

**Verify**:
- `node -p "const p=require('./package.json');[p.dependencies.astro,p.dependencies['@astrojs/sitemap'],p.devDependencies['@astrojs/check'],p.devDependencies.vitest,p.devDependencies.typescript].join(' ')"` → `^7.3.3 ^3.7.4 ^0.9.10 ^5.0.1 ^6.0.3`
- `npm ls typescript` → todas las líneas en `6.0.3` (ninguna 7.x).
- `npm ls vite` → una sola versión `8.x` compartida por astro y vitest.

### Step 3: Aplicar los arreglos de seguridad no rompedores

```
npm audit fix
```

(**Sin** `--force`.)

**Verify**: `npm audit` → `found 0 vulnerabilities`.

### Step 4: Importar zod desde `astro/zod`

- `src/content.config.ts:3`: `import { z } from 'zod';` → `import { z } from 'astro/zod';`
- `src/lib/booking/schemas.ts:7`: `import { z } from 'zod';` → `import { z } from 'astro/zod';`
- `src/lib/booking/schemas.ts:2`: sustituye `compatible con Zod v4 (bundleado en Astro 6).`
  por `compatible con Zod v4 (importado vía astro/zod).`

**Verify**: `grep -rn "from 'zod'" src/` → sin resultados · `grep -rn "from 'astro/zod'" src/` → 2 resultados.

### Step 5: Verificación completa y equivalencia de salida

**Verify**:
- `npm run check` → `0 errors`, `0 warnings`, `0 hints`
- `npm test` → `Tests  14 passed (14)`
- `npm run build` → `12 page(s) built`
- La validación del cliente sigue en el chunk del widget: `grep -l "El email no es v" dist/_astro/*.js` → 1 fichero (`widget-state.*.js`).
- Los textos legales se siguen renderizando. Si el plan 011 **no** se ha aplicado aún:
  `grep -c 'id="dialog-privacidad"' dist/index.html` → `1`. Si el plan 011 **sí** está
  aplicado: `test -f dist/politica-de-privacidad/index.html && echo OK` → `OK`.

## Test plan

Sin tests nuevos: es un cambio de dependencias. La red de seguridad es la suite
existente (`src/lib/booking/availability.test.ts`, 14 tests de disponibilidad y zona
horaria), `astro check` y el build. Tras el merge, el operador debería abrir
`npm run preview` y comprobar a ojo: portada, un servicio, el formulario de contacto y
el widget de "Reservar". Único cambio visual esperado: el texto de los diálogos legales
(pie → "Política de Privacidad") pasa a tener títulos verdes y listas con sangría (ver
"Current state"); si el plan 011 ya está aplicado, eso se ve en `/politica-de-privacidad/`.

## Done criteria

- [ ] `package.json`: astro `^7.3.3`, @astrojs/sitemap `^3.7.4`, @astrojs/check `^0.9.10`, vitest `^5.0.1`, typescript `^6.0.3`
- [ ] `npm audit` → `found 0 vulnerabilities`
- [ ] `npm run check` → 0 errors / 0 warnings / 0 hints
- [ ] `npm test` → 14 passed
- [ ] `npm run build` → 12 páginas
- [ ] `grep -rn "from 'zod'" src/` → sin resultados
- [ ] `git status` → solo `package.json`, `package-lock.json`, `src/content.config.ts`, `src/lib/booking/schemas.ts` (y `plans/README.md`); `.env` NO aparece como archivo a commitear
- [ ] Fila 010 de `plans/README.md` actualizada

## STOP conditions

Para y reporta (no improvises) si:

- `npm install` resuelve `typescript@7.x` en algún punto del árbol (`npm ls typescript`).
- `npm run check` falla con errores sobre la versión de TypeScript o del language server.
- `npm run build` falla con errores del compilador sobre etiquetas sin cerrar o HTML
  inválido: el spike no dio ninguno, así que sería señal de deriva. Reporta los
  `archivo:línea` exactos en lugar de reescribir marcado.
- `npm audit fix` pide `--force` para dejar el audit a cero.
- Algún test de `availability.test.ts` falla tras el upgrade.

## Maintenance notes

- El chunk diferido del widget de reservas crece de ~96 KB a ~118 KB (zod 4.6 / Vite 8).
  Sigue cargándose solo al abrir "Reservar"; si molesta, valorar `zod/mini` o eliminar la
  validación Zod redundante en cliente (`submit.ts` ya valida a mano en `widget-state.ts`).
- No subir TypeScript a 7 hasta que `@astrojs/check` lo admita en sus `peerDependencies`
  (el plan 015 configura Dependabot para ignorar ese major).
- Mantener `compressHTML: true` explícito; quitarlo cambiaría espacios entre elementos inline.
- Próximo major de Astro: leer primero su guía `docs.astro.build/en/guides/upgrade-to/vN/`.
- Con Astro 7 los selectores anidados de un `<style>` de componente (`& h2`, `& a`…) ya no se limitan a los
  elementos del propio componente: alcanzan también contenido de `<slot/>`, Markdown y componentes hijos.
  Al escribir CSS nuevo, dar clase propia a lo que se quiera estilar en lugar de confiar en selectores de
  etiqueta anidados.
- Navegadores antiguos: el CSS generado exige Safari ≥ 16.5 (anidamiento nativo) desde antes de este plan.
  Si algún día la analítica muestra tráfico relevante de iOS 15 o anterior, la palanca es
  `vite: { build: { cssTarget: ['safari15', 'chrome100', 'firefox100'] } }` en `astro.config.mjs` (Lightning
  CSS aplanará el anidamiento y reescribirá los rangos); comprobarlo antes con un build y el HTML a ojo.
