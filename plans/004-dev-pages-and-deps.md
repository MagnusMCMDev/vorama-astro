# Plan 004: Eliminar la página dev indexable y poner al día las dependencias

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/pages package.json package-lock.json`
> Si algo in-scope cambió, compara con "Current state" antes de continuar.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt / dependencies
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

Hay tres páginas de prueba del widget en el repo. Dos viven bajo `src/pages/_dev/`
y están correctamente ocultas: `robots.txt` hace `Disallow: /_dev/` y el sitemap
las excluye (`filter: (page) => !page.includes('/_dev/')` en `astro.config.mjs`).
Pero **`src/pages/dev-booking.astro` está en la raíz de pages**, así que se
publica en `/vorama-astro/dev-booking/`, **entra en el sitemap y es indexable por
Google** — una página "🧪 Test" de cara al público. Es un duplicado casi exacto de
`src/pages/_dev/booking.astro`. Hay que borrarla. Además, `npm audit` reporta una
vulnerabilidad **HIGH** (devalue, DoS por deserialización) con fix no-breaking, y
hay dos paquetes con minor/patch pendientes. Limpieza barata, riesgo bajo.

## Current state

- `src/pages/dev-booking.astro` — página de test en la raíz. Su cabecera lo admite:

```
 * URL: /vorama-astro/dev-booking/
 * NO incluir en sitemap. Eliminar o proteger en C4.
```

  Es funcionalmente idéntica a `src/pages/_dev/booking.astro` (mismos botones de
  los 6 servicios en modo directo + 3 en modo hub).

- `src/pages/_dev/booking.astro` y `src/pages/_dev/components.astro` — bajo `_dev/`,
  ya ocultas por robots + sitemap filter. **Se conservan** (útiles, sin exposición).

- `robots.txt` → `Disallow: /_dev/`. `astro.config.mjs:21-22` → sitemap excluye `/_dev/`.
  Ninguna de las dos reglas cubre `/dev-booking/` (sin guion bajo).

- `package.json` — deps: `astro ^6.3.1`, `@astrojs/sitemap ^3.7.2`; devDeps: `@astrojs/check ^0.9.9`, `typescript ^6.0.3`.

- `npm audit` (estado conocido al planificar):
  - `devalue 5.6.3-5.8.0` — **HIGH**, DoS vía sparse array deserialization. Fix vía `npm audit fix` (no-breaking).
  - `yaml 2.0.0-2.8.2` (transitivo, dentro de `@astrojs/check` → language-server) — moderate, stack overflow. El fix requiere `npm audit fix --force` que **degrada `@astrojs/check` a 0.9.2 (breaking)**. NO aplicar.

- `npm outdated` (estado conocido): `astro 6.3.1 → 6.4.6`, `@astrojs/sitemap 3.7.2 → 3.7.3`. Ambos dentro del rango `^`, sin cambios de mayor.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Audit     | `npm audit`        | tras el fix: la línea de `devalue` desaparece |
| Update    | `npm update astro @astrojs/sitemap` | actualiza lockfile |
| Typecheck | `npx astro check`  | 0 errors |
| Build     | `npm run build`    | exit 0; `dist/dev-booking/` NO existe |

## Scope

**In scope**:
- Borrar `src/pages/dev-booking.astro`
- `package.json`, `package-lock.json` (resultado de update/audit fix)
- `plans/README.md`

**Out of scope**:
- `src/pages/_dev/**` — se conservan; NO borrar ni mover.
- `robots.txt`, `astro.config.mjs` — sus reglas `/_dev/` siguen siendo correctas; no se tocan.
- NO ejecutar `npm audit fix --force` (rompe `@astrojs/check`).
- NO subir de major ninguna dependencia.

## Git workflow

- Branch: `advisor/004-dev-pages-deps`.
- Commits separados por unidad: uno para borrar la página, otro para deps. Español, imperativo, ≤70 chars.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Borrar la página dev indexable

Elimina el archivo `src/pages/dev-booking.astro`.

**Verify**: `test -f src/pages/dev-booking.astro && echo EXISTE || echo BORRADA` → `BORRADA`.

### Step 2: Confirmar que no quedan enlaces entrantes

`grep -rn "dev-booking" src/ public/` → solo puede quedar (a lo sumo) la
referencia en `_dev/` si la hubiera; NO debe haber enlaces desde páginas
públicas (Header, Footer, índice). Si aparece un `<a>` o `data-dialog` apuntando
a `/dev-booking/` en una página pública, ver STOP.

**Verify**: `grep -rn "dev-booking" src/` → 0 matches (o solo comentarios internos en `_dev/`).

### Step 3: Aplicar el fix no-breaking de npm audit

```
npm audit fix
```

(Sin `--force`.) Esto debe resolver `devalue`. Si `npm audit fix` intenta tocar
`@astrojs/check`/`yaml`, NO uses force; el residual de `yaml` se acepta (ver nota).

**Verify**: `npm audit` → ya no lista `devalue`; puede seguir listando los 5 moderate de `yaml` (aceptados).

### Step 4: Actualizar astro y sitemap dentro de rango

```
npm update astro @astrojs/sitemap
```

**Verify**: `npm ls astro @astrojs/sitemap` → astro `6.4.x`, sitemap `3.7.3` (o superior dentro de `^`).

### Step 5: Verificación integral

**Verify**: `npx astro check && npm run build` → exit 0. Tras el build, comprueba que la página dev no se generó:
`test -d dist/dev-booking && echo FALLO || echo OK` → `OK`.
Y que el sitemap no la referencia: `grep -c "dev-booking" dist/sitemap-*.xml` → 0.

## Test plan

Sin tests unitarios (cambio de build/deps). Verificación = los comandos de cada
step. Si el plan 001 ya está aplicado, ejecuta también `npm test` → debe seguir
verde tras el bump de astro.

## Done criteria

ALL must hold:

- [ ] `src/pages/dev-booking.astro` no existe
- [ ] `grep -rn "dev-booking" src/` → 0 matches en páginas públicas
- [ ] `npm audit` no lista `devalue`
- [ ] `npm ls astro` → 6.4.x
- [ ] `npx astro check` exit 0
- [ ] `npm run build` exit 0 y `dist/dev-booking/` no existe
- [ ] (si plan 001 aplicado) `npm test` exit 0
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 004 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- Una página pública (Header/Footer/index/servicios) enlaza a `/dev-booking/` —
  borrar la página rompería ese enlace; reporta dónde está antes de seguir.
- `npm audit fix` (sin force) propone cambios breaking o degrada `@astrojs/check`
  por debajo de 0.9.x — NO lo apliques, reporta.
- Tras `npm update astro`, `astro check` o `build` fallan: el minor 6.4 introdujo
  algo inesperado. Revierte el bump (`git checkout package.json package-lock.json`),
  deja el resto del plan aplicado y reporta.

## Maintenance notes

- Las páginas `_dev/*` siguen construyéndose (solo ocultas a buscadores). Si se
  quiere que ni se generen en producción, habría que excluirlas del build con un
  hook o moverlas fuera de `src/pages/` — deferido, no es urgente.
- El advisory de `yaml` queda aceptado: es una dependencia **solo de build**
  (`@astrojs/check` → language-server) que procesa exclusivamente el YAML del
  propio repo (entrada confiable); el DoS por stack overflow no es alcanzable.
  Revisar de nuevo cuando `@astrojs/check` publique una versión que lo resuelva
  sin downgrade.
- Convención del repo: justificar en el commit cualquier bump de dependencia
  (docs/project-rules.md "Decisiones que requieren ratio explícito").
