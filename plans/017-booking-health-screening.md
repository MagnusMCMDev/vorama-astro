# Plan 017: Pregunta de salud obligatoria en la reserva, con consentimiento explícito

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git apply --check plans/017-booking-health-screening.patch`
> Debe aplicar sin errores. Si no aplica, STOP (los archivos del widget han cambiado desde `3e80609`).

## Status

- **Priority**: P1 (petición del titular: seguridad de los clientes)
- **Effort**: M
- **Risk**: LOW-MEDIUM (toca el flujo de reservas; el cambio está **probado**, ver "Current state")
- **Depends on**: 016 (en producción). Va **antes** que 012, cuyo texto legal describe este formulario.
- **Category**: feature / compliance
- **Planned at**: commit `3e80609`, 2026-09-23

## Why this matters

El titular necesita saber **antes de confirmar la cita** si el cliente tiene alguna contraindicación para el
masaje (caso real: un cliente en ayunas con un brote de gota al que hubo que desaconsejar la sesión). Hoy eso
depende de que el cliente lo escriba por iniciativa propia en el campo de notas, cuyo placeholder sugiere
"lesión reciente", sin ninguna base legal para tratar ese dato de salud.

La solución es mejor para los dos objetivos a la vez:

- **Seguridad**: una pregunta **obligatoria** de sí o no ("¿Tienes ahora mismo alguna lesión, dolencia,
  embarazo u otro problema de salud?"), con ejemplos concretos. Todos los clientes tienen que pensarlo antes
  de enviar la solicitud.
- **Legalidad**: si responden "Sí", aparece un campo para contarlo y una **casilla de consentimiento
  explícito** (art. 9.2.a RGPD), obligatoria en ese caso. Con "No" no se envía ningún dato de salud.
- **Aviso al titular**: el email de la solicitud lleva "⚠ revisar salud" en el asunto y el detalle en el
  cuerpo, para verlo antes de confirmar por WhatsApp.

El campo de notas se queda para preferencias ("zona en la que centrarse, preferencia de presión…").

## Current state

**Probado**: el parche `plans/017-booking-health-screening.patch` se aplicó en un clon del repo (`3e80609`):

- Con solo los tests aplicados: `Tests  7 failed | 22 passed (29)` (los 7 nuevos, cada uno por lo que describe).
- Con el arreglo: `Tests  29 passed (29)`, `astro check` 0/0/0, build de 16 páginas.
- En Chrome (servidor de desarrollo): el detalle aparece solo con "Sí"; sin responder, error y foco en la
  pregunta; con "Sí" sin detalle ni casilla, los dos errores y foco en el detalle.

Qué hace el parche (para revisarlo, no para teclearlo):

| Archivo | Cambio |
|---|---|
| `types.ts` | `Customer` gana `health: 'no' \| 'yes'`, `healthNotes?`, `healthConsent?` |
| `schemas.ts` | `CustomerSchema` valida esos campos; con `'yes'` exige detalle y `healthConsent === true` |
| `widget-render.ts` | `FormState` con `health`/`healthNotes`/`healthConsent`; `<fieldset>` con la pregunta, ejemplos, radios No/Sí, y (solo con Sí) detalle + casilla de consentimiento explícito; nuevo placeholder de notas; fila "Salud" en el resumen |
| `widget-state.ts` | Estado inicial, validación (pregunta obligatoria; con Sí, detalle y consentimiento), mostrar/ocultar el detalle sin re-render, lectura de los campos al enviar y envío en `customer` |
| `submit.ts` | Email: "Salud: nada que indicar." o bloque "⚠ INDICA UNA LESIÓN O PROBLEMA DE SALUD" + detalle + consentimiento; asunto con "· ⚠ revisar salud" si es Sí |
| `BookingDialog.astro` | Estilos `.bw-field__hint`, `.bw-health*` (y `[hidden]` del detalle) |
| `widget-state.test.ts` | 4 tests DOM nuevos (obligatoria + foco; Sí exige detalle y consentimiento; Sí completo llega al resumen y a `submitBooking`; No no envía salud); `submitBooking` simulado con `vi.mock` |
| `booking-health.test.ts` (nuevo) | 3 tests del email (No, Sí, Sí sin consentimiento rechazado) |

Textos que verá el cliente (el titular puede ajustarlos antes del merge):

- Pregunta: **¿Tienes ahora mismo alguna lesión, dolencia, embarazo u otro problema de salud?**
- Ayuda: *Por ejemplo: fiebre o infección, inflamación o un ataque de gota, heridas o problemas en la piel,
  trombosis o varices importantes, una operación reciente… En algunos casos el masaje no es recomendable y
  prefiero saberlo antes de confirmar la cita.*
- Con "Sí": **Cuéntame brevemente qué te ocurre** + casilla *Consiento expresamente que Voramà Terapias trate
  estos datos de salud solo para valorar si el masaje es adecuado para mí.*

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors`, `0 warnings`, `0 hints` |
| Tests | `npm test` | `Tests  29 passed (29)` |
| Build | `npm run build` | `Complete!` (16 páginas) |

`.env` ficticio (5 claves `PUBLIC_*` = `dummy`); **nunca se commitea**.

## Scope

**In scope**: los 8 archivos del parche (`types.ts`, `schemas.ts`, `widget-render.ts`, `widget-state.ts`,
`submit.ts`, `BookingDialog.astro`, `widget-state.test.ts`, `booking-health.test.ts`).

**Out of scope**: los textos legales (plan 012); `availability.ts`, `gcal.ts`, `config.ts`; `plans/`.

## Git workflow

- Branch: `advisor/017-health`. Commits: (1) tests en rojo; (2) arreglo. Español, imperativo, ≤70 caracteres.
- Sin push ni PR.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm test`.

**Verify**: `npm test` → `Tests  22 passed (22)` · `git apply --check plans/017-booking-health-screening.patch` → sin salida.

### Step 2: Tests primero (deben fallar)

```
git apply --include="src/lib/booking/*.test.ts" plans/017-booking-health-screening.patch
```

**Verify**: `npm test` → `Tests  7 failed | 22 passed (29)`. Fallan exactamente los 7 nuevos:
"sin problemas de salud…", "con un problema de salud…", "rechaza «Sí» sin consentimiento…",
"la pregunta de salud es obligatoria…", "con «Sí» muestra el detalle…", "con «Sí», detalle y consentimiento…",
"con «No» no envía datos de salud". Si alguno pasa, STOP.

### Step 3: Aplicar el arreglo

```
git apply --exclude="src/lib/booking/*.test.ts" plans/017-booking-health-screening.patch
```

**Verify**:
- `npm test` → `Tests  29 passed (29)`
- `npm run check` → 0/0/0 · `npm run build` → 16 páginas
- `grep -c "lesión reciente" src/lib/booking/widget-render.ts` → `0`
- `grep -c 'name="healthConsent"' src/lib/booking/widget-render.ts` → `1`
- `grep -c "revisar salud" src/lib/booking/submit.ts` → `1`

## Test plan

Los 7 tests nuevos (ver tabla). Prueba en navegador: la hace el revisor (servidor de desarrollo, todos los
huecos libres): responder No / Sí, errores, foco y el resumen.

## Done criteria

- [ ] `npm test` → 29 passed, con los 7 nuevos vistos en rojo antes del arreglo
- [ ] `npm run check` 0/0/0 · `npm run build` 16 páginas
- [ ] Sin "lesión reciente" en el placeholder; pregunta de salud y casilla de consentimiento explícito presentes
- [ ] Solo los 8 archivos del parche; `.env` sin commitear

## STOP conditions

- `git apply --check` falla.
- Algún test nuevo pasa antes del arreglo, o falla alguno de los 22 anteriores después.

## Maintenance notes

- El texto legal (plan 012) describe esta pregunta: si cambia (p. ej. se deja de pedir el detalle), hay que
  actualizar la política de privacidad.
- Los datos de salud viajan por Web3Forms y llegan a Gmail: por eso el titular debe aceptar el DPA de
  Web3Forms (plan 012) y borrar de su correo las solicitudes antiguas según el plazo de conservación.
- Si algún día se quiere que los detalles de salud **no** pasen por el formulario (por ejemplo, preguntar solo
  sí/no y pedir el detalle por WhatsApp), basta con quitar el `<textarea>` y ajustar el email y la política.
