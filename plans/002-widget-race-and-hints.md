# Plan 002: Corregir la condición de carrera del calendario y limpiar los hints de astro check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/lib/booking/widget-state.ts src/lib/booking/widget-render.ts src/lib/booking/schemas.ts`
> Si algún archivo in-scope cambió desde que se escribió este plan, compara los
> extractos de "Current state" con el código vivo antes de continuar; si no
> coinciden, trátalo como STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-vitest-availability-tests.md (la suite verde es la red de seguridad)
- **Category**: bug
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

El widget de reservas carga la disponibilidad de Google Calendar de forma
asíncrona. Si la persona navega de mes rápidamente (clic en "›" varias veces, o
"‹" e inmediatamente "›"), se disparan varias peticiones `fetchBusy()` en
paralelo y **la que resuelve última gana**, sin comprobar si sigue
correspondiendo al mes que se está mostrando. Resultado: el calendario puede
pintar la disponibilidad de un mes sobre la cuadrícula de otro, ofreciendo
huecos que no existen o escondiendo los que sí. Es el tipo de fallo silencioso
que solo aparece con red lenta. El arreglo es un token de petición monótono.
De paso, este plan elimina los 3 hints que `astro check` arrastra (imports sin
usar y una API de Zod deprecada) para que el type-check quede limpio y futuros
warnings reales no se pierdan entre el ruido.

## Current state

- `src/lib/booking/widget-state.ts` — orquestador del widget (vanilla TS montado por BookingDialog.astro). La función con el bug:

```ts
// widget-state.ts:154-180
async function loadAvailability() {
  if (!state.serviceId || !state.durationMin) return;
  state.isLoadingCal = true;
  state.availability = null;
  render();

  try {
    const busy = await fetchBusy(state.year, state.month0);
    const avail = getMonthAvailability(state.serviceId, state.durationMin, state.year, state.month0, busy);
    state.availability = avail;
    state.isLoadingCal = false;
    // Si el día seleccionado ya no tiene slots en el nuevo mes, deseleccionar
    if (state.selectedDate && !avail.days.has(state.selectedDate)) {
      state.selectedDate = null;
      state.selectedSlot = null;
      state.slotsForDate = [];
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : 'GCAL_DOWN';
    state.isLoadingCal = false;
    state.errorCode = code;
    goToStep('error', 'No se pudo cargar la disponibilidad');
    return;
  }

  render();
}
```

  `loadAvailability()` se invoca desde el handler de `[data-cal-prev]`
  (línea ~227) y `[data-cal-next]` (~238), que ya han mutado `state.year` /
  `state.month0` ANTES del await. Por eso leer `state.year` después del await
  no garantiza que sea el mes pedido. El bug es de orden de resolución, no de
  qué valor se lee.

- `src/lib/booking/widget-render.ts:7` — import con 2 símbolos sin usar (hints ts(6196)):

```ts
import type { BookingStep, BookingErrorCode, ServiceType } from './types.ts';
```

  `ServiceType` SÍ se usa (Records de labels/variants). `BookingStep` y
  `BookingErrorCode` no.

- `src/lib/booking/schemas.ts:53-62` — el método `.email()` está deprecado en la Zod v4 que bundlea Astro 6 (hint ts(6385)):

```ts
  email: z
    .string()
    .min(1, 'Indica tu email')
    .email('El email no es válido'),
```

- Convenciones: imports con extensión `.ts` explícita, comentarios en español. La firma de `getMonthAvailability` tras el plan 001 acepta un 6º parámetro opcional `now` — NO lo toques aquí, sigue llamándose con 5 argumentos y es correcto.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors, 0 warnings, **0 hints** al terminar el plan |
| Tests     | `npm test`         | exit 0, suite del plan 001 sigue verde |
| Build     | `npm run build`    | exit 0 |

## Scope

**In scope**:
- `src/lib/booking/widget-state.ts`
- `src/lib/booking/widget-render.ts`
- `src/lib/booking/schemas.ts`
- `plans/README.md`

**Out of scope** (NO tocar):
- `src/lib/booking/availability.ts` — ya cubierto por el plan 001.
- `src/lib/booking/gcal.ts` — el `fetchBusy` ya tiene su propio AbortController para timeout; NO añadas cancelación de red aquí, el token de petición resuelve el problema sin tocar gcal.
- `src/components/**` y cualquier `.astro`.

## Git workflow

- Branch: `advisor/002-widget-race`.
- Commits en español, imperativo, ≤70 chars. Ej: `Descartar respuestas freebusy obsoletas al navegar de mes`.
- NO push ni PR salvo instrucción del operador.

## Steps

### Step 1: Añadir token de petición a loadAvailability

En `widget-state.ts`, declara un contador a nivel del closure de `mountWidget`
(junto a `state`, antes de `function render()`). Busca la línea donde termina la
definición del objeto `state` (`};` tras `errorCode: null,`) e inserta justo
después:

```ts
  // Token monótono: cada carga de disponibilidad incrementa el contador.
  // Una respuesta cuyo token ya no es el último se descarta (el usuario
  // navegó a otro mes mientras la petición estaba en vuelo).
  let loadToken = 0;
```

Luego reescribe `loadAvailability` para capturar el mes pedido y el token, y
comprobar el token tras cada punto de await:

```ts
  async function loadAvailability() {
    if (!state.serviceId || !state.durationMin) return;
    const token = ++loadToken;
    const reqYear = state.year;
    const reqMonth0 = state.month0;
    state.isLoadingCal = true;
    state.availability = null;
    render();

    try {
      const busy = await fetchBusy(reqYear, reqMonth0);
      if (token !== loadToken) return; // respuesta obsoleta → descartar
      const avail = getMonthAvailability(state.serviceId, state.durationMin, reqYear, reqMonth0, busy);
      state.availability = avail;
      state.isLoadingCal = false;
      if (state.selectedDate && !avail.days.has(state.selectedDate)) {
        state.selectedDate = null;
        state.selectedSlot = null;
        state.slotsForDate = [];
      }
    } catch (err) {
      if (token !== loadToken) return; // error de una petición ya superada
      const code = err instanceof Error ? err.message : 'GCAL_DOWN';
      state.isLoadingCal = false;
      state.errorCode = code;
      goToStep('error', 'No se pudo cargar la disponibilidad');
      return;
    }

    render();
  }
```

Cambios clave: usa `reqYear`/`reqMonth0` (no `state.year`/`state.month0`) al
llamar a `getMonthAvailability`, y dos guardas `if (token !== loadToken) return;`
— una DESPUÉS del `await fetchBusy` y otra como PRIMERA línea del `catch`.

**Verify**: `npx astro check` → 0 errors. Si el plan 001 ya está aplicado, `npm test` → suite verde (esta función no tiene test directo; la verificación es el type-check + que no rompe los tests existentes).

### Step 2: Eliminar imports sin usar en widget-render.ts

En `widget-render.ts:7`, deja solo el símbolo usado:

```ts
import type { ServiceType } from './types.ts';
```

**Verify**: `npx astro check` → desaparecen los 2 hints ts(6196) de `widget-render.ts`.

### Step 3: Migrar la validación de email a la API no deprecada de Zod

En `schemas.ts`, sustituye el campo `email` del `CustomerSchema`:

```ts
  email: z
    .email('El email no es válido'),
```

(Se elimina `.string().min(1,…)`: `z.email()` ya rechaza la cadena vacía y los
no-emails. El mensaje de error se conserva.) **Verificado** contra la zod 4.4.3
bundleada en este repo: `z.email('mensaje')` acepta el mensaje posicional y
`safeParse('')`/`safeParse('x')` devuelven `success: false`.

**Verify**: `npx astro check` → desaparece el hint ts(6385) y el resultado final es `0 errors - 0 warnings - 0 hints`.

### Step 4: Verificación integral

**Verify**: `npx astro check && npm run build` → ambos exit 0; astro check sin hints. Si el plan 001 ya está aplicado, además `npm test` → verde.

## Test plan

No se añaden tests nuevos en este plan: la condición de carrera depende del
orden de resolución de `fetch` (timing), que no es determinista sin un mock de
red elaborado — deliberadamente fuera de alcance (registrado como residual en
plans/README.md). La red de seguridad es:

- La suite del plan 001 sigue verde (garantiza que la firma de `getMonthAvailability` no se rompió).
- `astro check` a 0 hints valida los cambios de imports y Zod.

Si el operador quiere cobertura del race: requeriría inyectar `fetchBusy` en
`mountWidget` (hoy es import directo) — eso es un refactor mayor, no este plan.

## Done criteria

ALL must hold:

- [ ] `npx astro check` → `0 errors - 0 warnings - 0 hints`
- [ ] `npm test` exit 0 (suite 001 verde)
- [ ] `npm run build` exit 0
- [ ] `grep -n "if (token !== loadToken) return;" src/lib/booking/widget-state.ts` → 2 matches
- [ ] `grep -n "reqYear" src/lib/booking/widget-state.ts` → ≥2 matches
- [ ] `grep -n "BookingStep\|BookingErrorCode" src/lib/booking/widget-render.ts` → 0 matches
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 002 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- Los extractos de "Current state" no coinciden con el código vivo (deriva — probable si alguien ya tocó widget-state.ts).
- `z.email()` no existe en la versión de Zod resuelta (astro check da error en vez de hint). Fallback: revierte el Step 3 al original `.string().min(1).email()` y reporta que la versión de Zod no soporta el top-level format; deja el resto del plan aplicado.
- Tras el Step 1, `astro check` reporta que `getMonthAvailability` espera distinto número de argumentos: significa que el plan 001 no se aplicó o difiere. STOP.
- Quieres correr `npm test` pero aún no existe el script (plan 001 sin aplicar): NO es fallo de este plan. La llamada de 5 argumentos a `getMonthAvailability` es compatible con la firma pre-001, así que el cambio compila igual; usa solo `astro check`/`build` como verificación y aplica 001 cuando quieras la red de tests.

## Maintenance notes

- El patrón del token (`++loadToken` + guarda tras await) debe replicarse en
  cualquier otra carga asíncrona que se añada al widget (p.ej. si en el futuro
  se valida el slot contra el calendario justo antes del submit).
- Pendiente deferido: inyección de dependencias (`fetchBusy`, `submitBooking`)
  en `mountWidget` para poder testear el flujo asíncrono y el `svc as any` de la
  llamada a `submitBooking` (widget-state.ts:360). No se aborda aquí para
  mantener el cambio de bajo riesgo.
- Lo que un revisor debe mirar: que las dos guardas de token estén DESPUÉS de
  sus respectivos `await`/punto de fallo, no antes, y que `getMonthAvailability`
  reciba `reqYear`/`reqMonth0`, no `state.*`.
