# Plan 001: Establecer harness Vitest y tests de caracterización de availability.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/lib/booking/availability.ts src/lib/booking/config.ts package.json .github/workflows/deploy.yml`
> Si algún archivo in-scope cambió desde que se escribió este plan, compara los
> extractos de "Current state" con el código vivo antes de continuar; si no
> coinciden, trátalo como STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `5b37c88`, 2026-06-12

## Why this matters

`src/lib/booking/availability.ts` genera los huecos reservables del sistema de
reservas — el money-path del negocio. Esa lógica ya falló **tres veces en
producción** (commits `d7fc7a3`, `31bd180`, `a7b16e6`: offset UTC incorrecto,
eventos cruzando medianoche, y un evento bloqueando la misma hora en TODOS los
días). Cada regresión llegó a producción porque no existe ni un solo test en el
repo. Este plan instala Vitest, hace inyectable el reloj (`Date.now()` hoy está
hardcodeado y bloquea tests de límites temporales), y codifica los tres bugs
históricos como tests de caracterización para que no haya un cuarto.

## Current state

- `package.json` — solo scripts `dev/build/preview/astro`; no hay test runner ni devDep de testing. Deps: `astro ^6.3.1`, `@astrojs/sitemap ^3.7.2`; devDeps: `@astrojs/check ^0.9.9`, `typescript ^6.0.3`. `engines.node >=22.12.0`.
- `src/lib/booking/availability.ts` — la lógica a testear. Puntos clave:

```ts
// availability.ts:63-70 — CÓDIGO MUERTO (astro check lo reporta como hint ts(6133))
/** Devuelve true si [aStart,aEnd) solapa con [bStart,bEnd) incluyendo buffer. */
function overlaps(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
  buffer: number,
): boolean {
  return aStart < bEnd + buffer && aEnd > bStart - buffer;
}
```

```ts
// availability.ts:101-112 — firma actual y reloj hardcodeado
export function getMonthAvailability(
  serviceId: ServiceId,
  durationMin: number,
  year: number,
  month0: number,
  busy: TimeRange[] = [],
): MonthAvailability {
  const now = Date.now();
  const minAdvanceMs = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
```

```ts
// availability.ts:146-151 — detección de solapamiento vigente (comparación directa en ms)
const bufferMs = BUFFER_MIN * 60_000;
const blocked = busy.some((b) => {
  const bStartMs = new Date(b.start).getTime();
  const bEndMs   = new Date(b.end).getTime();
  return startMs < bEndMs + bufferMs && endMs > bStartMs - bufferMs;
});
```

- `src/lib/booking/config.ts:31-33` — **OBSTÁCULO DE TESTABILIDAD**: `availability.ts` importa `config.ts`, y `config.ts` ejecuta `requireEnv()` a nivel de módulo, que LANZA si faltan las env. Sin mitigación, importar `availability.ts` en un test revienta:

```ts
// config.ts:7-16
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `[booking/config] Variable de entorno obligatoria no encontrada: ${key}. ` + ...
```

  Nota: el acceso es **dinámico** (`import.meta.env[key]`), así que un `define`
  de Vite NO lo sustituye; hay que poblar el objeto env real (ver Step 2).
- Defaults de negocio (config.ts:38-47): `BUFFER_MIN=20`, `MIN_ADVANCE_HOURS=24`, `MAX_DAYS_AHEAD=60`, `SLOT_STEP_MIN=15`. Los tests asumen estos defaults (no definas las PUBLIC_BOOKING_* en el entorno de test).
- `src/content/booking/availability-rules.json` — franjas reales: `californiano-90` y `californiano-120` tienen lunes–viernes (claves "1".."5") `18:00–21:00` y sábado/domingo ("6","0") `09:00–21:00`; `cuatro-manos-*` y `para-dos-*` SOLO sábado/domingo `09:00–21:00` (resto `[]`).
- Convención de imports del repo: extensiones `.ts` explícitas (`from './config.ts'`) y comentarios en español. Síguela.
- CI: `.github/workflows/deploy.yml` — tras "Type-check (astro check)" (línea 38-39) viene "Build". El step de tests se inserta entre ambos.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx astro check`        | 0 errors (hoy emite 4 hints; tras este plan, el hint de `overlaps` desaparece) |
| Tests     | `npm test`               | exit 0, todos los tests pasan |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope** (los únicos archivos que puedes modificar/crear):
- `package.json` (devDep vitest + scripts `test`, `test:watch`, `check`)
- `package-lock.json` (resultado del install)
- `vitest.config.ts` (crear)
- `src/lib/booking/test-setup.ts` (crear — neutraliza requireEnv)
- `src/lib/booking/availability.ts` (añadir parámetro `now`, borrar `overlaps()`)
- `src/lib/booking/availability.test.ts` (crear)
- `.github/workflows/deploy.yml` (añadir step de tests)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar aunque parezcan relacionados):
- `src/lib/booking/{gcal,submit,widget-state,widget-render,schemas,config,types}.ts` — sus mejoras de testabilidad están deliberadamente fuera; config.ts se neutraliza desde la config de vitest, no editándolo.
- `src/content/booking/*.json` — los tests usan las reglas reales; no las cambies para que un test pase.
- Cualquier `.astro`.

## Git workflow

- Branch: `advisor/001-vitest-availability` (la práctica observada del repo es commit directo a `main`; usa rama y deja el merge al operador).
- Commits en español, imperativo, ≤70 chars (convención de `docs/conventions.md` §11). Ej: `Añadir harness Vitest y tests de caracterización de availability`.
- NO push ni PR salvo instrucción del operador.

## Steps

### Step 1: Instalar Vitest y añadir scripts

```
npm install -D vitest
```

En `package.json`, dentro de `scripts`, añade (sin tocar los existentes):

```json
"check": "astro check",
"test": "vitest run",
"test:watch": "vitest"
```

**Verify**: `npm test` → Vitest arranca y termina con "No test files found" (exit code puede ser 1 por ausencia de tests; eso es lo esperado en este paso).

### Step 2: Configurar Vitest neutralizando requireEnv (vía setupFiles)

`src/lib/booking/config.ts` ejecuta `requireEnv()` al importarse y LANZA si
faltan las 3 claves. Como `availability.ts` importa `config.ts`, hay que poblar
el entorno ANTES de que se cargue el módulo bajo test. La forma robusta es un
archivo de setup con `vi.stubEnv` — escribe el valor en `import.meta.env` (que es
lo que `config.ts` lee de forma dinámica con `import.meta.env[key]`) y corre
antes de importar los archivos de test.

Crea `src/lib/booking/test-setup.ts`:

```ts
import { vi } from 'vitest';

// config.ts lee import.meta.env[clave] de forma DINÁMICA y lanza si falta.
// vi.stubEnv fija el valor en import.meta.env antes de que se importe config.ts.
// Valores dummy: ningún test debe tocar red.
vi.stubEnv('PUBLIC_GCAL_API_KEY', 'test-key');
vi.stubEnv('PUBLIC_GCAL_CALENDAR_ID', 'test-calendar');
vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'test-w3f');
```

Crea `vitest.config.ts` en la raíz con EXACTAMENTE esta estructura:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/lib/booking/test-setup.ts'],
  },
});
```

Crea un test de humo temporal `src/lib/booking/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getMonthAvailability } from './availability.ts';

describe('smoke', () => {
  it('importa availability sin lanzar (env neutralizado)', () => {
    expect(typeof getMonthAvailability).toBe('function');
  });
});
```

**Verify**: `npm test` → 1 test passed. Si lanza `[booking/config] Variable de entorno obligatoria no encontrada`, ver STOP conditions (hay fallback documentado).

### Step 3: Inyectar el reloj en getMonthAvailability y borrar overlaps()

En `src/lib/booking/availability.ts`:

1. Borra la función `overlaps` completa (líneas 63-70 del extracto de Current state, incluido su doc-comment).
2. Cambia la firma añadiendo un último parámetro opcional y elimina la línea `const now = Date.now();`:

```ts
export function getMonthAvailability(
  serviceId: ServiceId,
  durationMin: number,
  year: number,
  month0: number,
  busy: TimeRange[] = [],
  now: number = Date.now(),
): MonthAvailability {
  const minAdvanceMs = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
```

3. Actualiza el doc-comment de la función añadiendo `@param now - Epoch ms del "ahora" (inyectable en tests; default Date.now())`.

No cambies NADA más del cuerpo: los callers existentes (widget-state.ts) siguen funcionando porque el parámetro es opcional.

**Verify**: `npx astro check` → 0 errors y ya NO aparece el hint `'overlaps' is declared but its value is never read`.

### Step 4: Escribir los tests de caracterización

Reemplaza el contenido de `src/lib/booking/availability.test.ts` por una suite que cubra los casos de la tabla del Test plan. Estructura: `describe('getMonthAvailability')` con sub-describes por área (generación básica, regresiones históricas, buffer, límites temporales, DST). Usa SIEMPRE un `now` fijo por test (epoch ms vía `Date.parse('...')`). Helper sugerido al inicio del archivo:

```ts
const NOW_JUNE = Date.parse('2026-06-01T00:00:00Z');
function dayList(res: ReturnType<typeof getMonthAvailability>) {
  return [...res.days.keys()].sort();
}
function times(res: ReturnType<typeof getMonthAvailability>, dateKey: string) {
  return (res.days.get(dateKey) ?? []).map((s) => s.startISO.slice(11, 16));
}
```

**Verify**: `npm test` → todos los tests del Test plan pasan (≥14 tests).

### Step 5: Añadir el step de tests al CI

En `.github/workflows/deploy.yml`, entre el step "Type-check (astro check)" y el step "Build", inserta:

```yaml
      - name: Tests (vitest)
        run: npm test
```

**Verify**: `npx astro check && npm test && npm run build` → los tres con exit 0.

## Test plan

Todos en `src/lib/booking/availability.test.ts`, servicio `californiano-90` (dur 90) salvo donde se indique, `busy=[]` salvo donde se indique, `now=NOW_JUNE` salvo donde se indique. Junio 2026 = `(2026, 5)`. Datos verificados contra las reglas reales: 2026-06-08 es lunes (franja 18:00–21:00), 2026-06-07 es domingo (09:00–21:00).

1. **Lunes básico**: `times(res,'2026-06-08')` === `['18:00','18:15','18:30','18:45','19:00','19:15','19:30']` (7 slots; el último inicio que cabe con 90 min antes de 21:00 es 19:30).
2. **Domingo básico**: `times(res,'2026-06-07').length` === 43, primero `'09:00'`, último `'19:30'`. `startISO` del primero === `'2026-06-07T09:00:00+02:00'`.
3. **Día sin franjas**: `cuatro-manos-60` (dur 60): `dayList(res)` no contiene ningún miércoles (p.ej. `'2026-06-10'`); sí contiene `'2026-06-07'`.
4. **Regresión bug (a) — evento de un día NO bloquea otros días**: busy `[{start:'2026-06-08T18:15:00+02:00', end:'2026-06-08T19:30:00+02:00'}]` → `'2026-06-08'` AUSENTE de `days` (con buffer 20', los 7 slots del lunes solapan) y `times(res,'2026-06-15')` sigue teniendo 7 slots.
5. **Regresión bug (b) — evento cruzando medianoche**: busy `[{start:'2026-06-08T20:00:00+02:00', end:'2026-06-09T01:00:00+02:00'}]` → `times(res,'2026-06-08')` === `['18:00']` (su fin 19:30 ≤ 19:40 = 20:00−buffer; los demás solapan) y `times(res,'2026-06-09')` intacto con 7 slots (01:00+20' = 01:20 < 18:00).
6. **Regresión bug (c) — all-day multi-día en UTC**: busy `[{start:'2026-06-01T00:00:00Z', end:'2026-07-01T00:00:00Z'}]` → `res.days.size` === 0.
7. **Buffer posterior**: domingo, busy `[{start:'2026-06-07T16:00:00+02:00', end:'2026-06-07T17:00:00+02:00'}]` → `times` del día NO contiene `'17:00'` ni `'17:15'` (17:15 < 17:20) pero SÍ `'17:30'`.
8. **Buffer anterior**: mismo busy → NO contiene `'14:15'` (fin 15:45 > 15:40 = 16:00−buffer) pero SÍ `'14:00'` (fin 15:30 ≤ 15:40).
9. **MIN_ADVANCE_HOURS (24h) exclusivo/inclusivo**: `now = Date.parse('2026-06-13T10:00:00+02:00')`, domingo 2026-06-14 → NO contiene `'09:45'`; SÍ contiene `'10:00'` (la condición es `startMs < now+24h`, el igual entra).
10. **MAX_DAYS_AHEAD (60d)**: `now = NOW_JUNE`, mes agosto `(2026, 7)` → `res.days.size` === 0 (el primer slot posible, 1 ago 09:00+02:00 = 07:00Z, supera 2026-07-31T00:00Z).
11. **DST primavera (2026-03-29, domingo)**: `now = Date.parse('2026-03-01T00:00:00Z')`, mes `(2026, 2)` → primer slot de `'2026-03-29'` tiene `startISO === '2026-03-29T09:00:00+02:00'` y el de `'2026-03-28'` (sábado) `'2026-03-28T09:00:00+01:00'`.
12. **DST otoño (2026-10-25, domingo)**: `now = Date.parse('2026-10-01T00:00:00Z')`, mes `(2026, 9)` → primer slot de `'2026-10-25'` acaba en `+01:00` y el de `'2026-10-24'` en `+02:00`.
13. **endISO coherente**: en el caso 1, el slot de las 19:30 tiene `endISO === '2026-06-08T21:00:00+02:00'`.
14. **Mes pasado completo**: `now = NOW_JUNE`, mes mayo `(2026, 4)` → `res.days.size` === 0.

No hay test existente que usar como patrón (este archivo será el primero); usa la estructura describe/it estándar de Vitest.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exit 0 con ≥14 tests pasando
- [ ] `npx astro check` exit 0, sin el hint de `overlaps`
- [ ] `npm run build` exit 0
- [ ] `grep -n "Date.now()" src/lib/booking/availability.ts` → 2 matches (el `@param` del doc-comment + el default del parámetro); lo esencial: 0 ocurrencias de `const now = Date.now()`
- [ ] `grep -n "function overlaps" src/lib/booking/availability.ts` → 0 matches
- [ ] `grep -n "npm test" .github/workflows/deploy.yml` → 1 match entre check y build
- [ ] `git status` no muestra modificados fuera del Scope
- [ ] Fila 001 de `plans/README.md` actualizada

## STOP conditions

Stop and report back (do not improvise) si:

- Los extractos de "Current state" no coinciden con el código vivo (deriva).
- En el Step 2 el smoke test sigue lanzando el error de requireEnv pese al `setupFiles` con `vi.stubEnv`. Fallback: añade además, al principio de `vitest.config.ts` (antes de `defineConfig`), `process.env.PUBLIC_GCAL_API_KEY ??= 'test-key';` (y las otras dos claves) más `envPrefix: 'PUBLIC_'` dentro de la config — algunas versiones pueblan `import.meta.env` desde `process.env`. Si con AMBOS enfoques sigue fallando, STOP y reporta la versión de Vitest instalada.
- Algún test de la tabla falla y tras revisar tu aritmética sigue fallando: puede ser un bug real nuevo en availability.ts. NO "ajustes" la expectativa para que pase — reporta el caso exacto.
- Vitest no resuelve el import de `availability-rules.json` o las extensiones `.ts` en imports.

## Maintenance notes

- Cualquier cambio futuro en `availability-rules.json` (franjas) romperá los conteos exactos de los tests 1-3 — es intencional: obliga a revisar las expectativas junto al cambio de negocio.
- Los tests 11-12 fijan el comportamiento del offset por-día (calculado a mediodía UTC). Si algún día se ofrecen franjas entre 00:00–03:00, ese método de offset deja de ser válido y estos tests deben ampliarse.
- Plan 002 (fixes del widget) asume esta suite verde como red de seguridad; ejecútalo después.
- Diferido conscientemente: inyección de fetch/sessionStorage en `gcal.ts` y extracción de la validación de ContactForm a módulo testeable (residual registrado en plans/README.md).
