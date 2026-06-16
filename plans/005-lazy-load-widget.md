# Plan 005: Cargar la librería de reservas bajo demanda (dynamic import)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/components/booking/BookingDialog.astro`
> Compara con "Current state" si hubo cambios.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (recomendado tras 002, que también toca el flujo del widget)
- **Category**: perf
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

`BookingDialog.astro` se incluye en `BaseLayout.astro`, o sea en **todas las
páginas**. Su `<script>` hace `import { mountWidget } from '…/widget-state.ts'`
a nivel de módulo, lo que arrastra al bundle de cada página toda la cadena de
reservas: `widget-state → widget-render → availability → gcal → submit →
schemas → zod`. **Zod** en particular es pesado y solo se necesita cuando
alguien abre el diálogo de reserva (una fracción de las visitas). Cambiando el
import estático por un `import()` dinámico en el `vrm:dialog-open`, ese chunk se
descarga únicamente al abrir el diálogo. Beneficio: menos JS en el camino
crítico de cada página (mejora TBT/LCP en móvil, alineado con la regla del
proyecto de "no scripts render-blocking" y el patrón facade que ya se usa para
el vídeo de YouTube). Bonus: si faltara una variable de entorno de reservas, el
error deja de poder romper la carga de la página — solo afectaría al diálogo,
que ya tiene fallback a WhatsApp.

## Current state

`src/components/booking/BookingDialog.astro:398-449` — el script al final:

```ts
import type { ServiceId, ServiceType, MountOptions } from '~/lib/booking/types.ts';
import { mountWidget } from '~/lib/booking/widget-state.ts';

const dlg = document.getElementById('booking') as HTMLDialogElement | null;
const mount = document.getElementById('bw-mount');
if (!dlg || !mount) throw new Error('[BookingDialog] elementos no encontrados');

let lastOptions: MountOptions = { mode: 'hub' };

// Captura el contexto del botón que abre el dialog (fase capture)
document.addEventListener('click', (e) => {
  const opener = (e.target as Element).closest<HTMLElement>('[data-dialog="booking"]');
  if (!opener) return;
  const serviceId = opener.dataset.serviceId as ServiceId | undefined;
  const durationMin = Number(opener.dataset.durationMin) || 0;
  if (serviceId && durationMin) {
    lastOptions = { mode: 'direct', serviceId, durationMin };
  } else {
    const serviceType = opener.dataset.serviceType as ServiceType | undefined;
    lastOptions = { mode: 'hub', serviceType };
  }
}, true);

// Cuando el dialog abre, monta el widget
dlg.addEventListener('vrm:dialog-open', () => {
  try {
    mountWidget(mount, lastOptions);
  } catch (err) {
    console.error('[BookingDialog] Error al montar el widget:', err);
    const wa = 'https://wa.me/34623941891?text=' + encodeURIComponent('Hola, quiero reservar una sesión de masaje');
    mount.innerHTML = `… fallback WhatsApp …`;
  }
});

dlg.addEventListener('close', () => { mount.innerHTML = ''; });
```

- `mountWidget` es síncrona y solo se llama dentro del handler de apertura → es seguro cargarla justo antes con `await import()`.
- El import de `types.ts` es `import type` → se borra en build, no añade peso; se queda igual.
- Vite/Astro emite un chunk separado por cada `import()` dinámico, y lo descarga al ejecutarse esa línea. Ese es el mecanismo que produce la mejora.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors |
| Build     | `npm run build`    | exit 0 |

## Scope

**In scope**:
- `src/components/booking/BookingDialog.astro` (solo el bloque `<script>`)
- `plans/README.md`

**Out of scope**:
- `src/lib/booking/**` — no se toca la librería; el cambio es solo cómo se importa.
- `BaseLayout.astro` — el diálogo sigue incluido en todas las páginas (es el markup, que es ligero); lo que se difiere es el JS.

## Git workflow

- Branch: `advisor/005-lazy-widget`.
- Commit en español, imperativo, ≤70 chars. Ej: `Cargar el widget de reservas con import dinámico`.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Convertir el import de mountWidget en dinámico

En el `<script>` de `BookingDialog.astro`:

1. Borra la línea `import { mountWidget } from '~/lib/booking/widget-state.ts';`
   (deja el `import type … from '…/types.ts'`).
2. Justo encima del `dlg.addEventListener('vrm:dialog-open', …)` deja un comentario:

```ts
// La librería de reservas (incluido Zod) se importa de forma diferida al abrir
// el diálogo, para no añadir ese JS al bundle de todas las páginas.
```

3. Haz el handler `async` y carga el módulo dentro del `try`:

```ts
dlg.addEventListener('vrm:dialog-open', async () => {
  try {
    const { mountWidget } = await import('~/lib/booking/widget-state.ts');
    mountWidget(mount, lastOptions);
  } catch (err) {
    console.error('[BookingDialog] Error al montar el widget:', err);
    const wa = 'https://wa.me/34623941891?text=' + encodeURIComponent('Hola, quiero reservar una sesión de masaje');
    mount.innerHTML = `… (deja el fallback HTML existente sin cambios) …`;
  }
});
```

No cambies el contenido del `catch` ni el resto del script (captura del opener, handler de `close`).

**Verify**: `npx astro check` → 0 errors.

### Step 2: Build y comprobación del chunk diferido

**Verify**: `npm run build` → exit 0.

Comprobación del split (mecánica): la lógica del widget debe vivir en un chunk
de `dist/_astro/` que se carga por `import()`, no desde el script de entrada de
cada página.

- **Nota:** Vite minifica los nombres de símbolo en producción, así que NO busques `getMonthAvailability` en `dist/` (no sobrevive). Usa strings literales que SÍ sobreviven:
  - `grep -rl "api.web3forms.com" dist/_astro/*.js` → el chunk PESADO del widget (p.ej. `widget-state.*.js`, ~96 KB; contiene Zod + gcal + submit).
  - `grep -rl "vrm:dialog-open" dist/_astro/*.js` → el chunk LOADER de BookingDialog (~2-3 KB), que debe ser un archivo DISTINTO del anterior y contener `import(` (dinámico).
  - Que sean archivos distintos prueba que la librería pesada NO entra en el bundle que carga cada página; solo se baja al abrir el diálogo.

(La prueba definitiva del ahorro es comparar el peso de JS inicial de una página
antes/después en DevTools → Network; opcional para el operador.)

## Test plan

Sin tests unitarios. Verificación funcional manual que el operador hace tras
desplegar (o en `npm run preview`):

1. Cargar una página cualquiera → en Network NO debe descargarse el chunk de reservas hasta interactuar.
2. Pulsar "Reservar" → el chunk se descarga y el diálogo se monta con normalidad (hub o directo según el botón).
3. Forzar fallo (sin red al abrir) → aparece el fallback de WhatsApp, no una excepción que rompa la página.

## Done criteria

ALL must hold:

- [ ] `grep -n "await import('~/lib/booking/widget-state" src/components/booking/BookingDialog.astro` → 1 match
- [ ] `grep -n "^import { mountWidget }" src/components/booking/BookingDialog.astro` → 0 matches
- [ ] `npx astro check` exit 0
- [ ] `npm run build` exit 0
- [ ] `grep -rl "api.web3forms.com" dist/_astro/*.js` y `grep -rl "vrm:dialog-open" dist/_astro/*.js` → archivos DISTINTOS (la lib pesada está en su propio chunk diferido, separada del loader)
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 005 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- El extracto de "Current state" no coincide (deriva — p.ej. el plan 002 reorganizó el script de otra forma; en ese caso re-localiza el handler `vrm:dialog-open` y aplica el mismo cambio, pero si no lo encuentras, STOP).
- Tras el cambio, abrir el diálogo lanza un error de carga del módulo (ruta del `import()` mal resuelta). El path debe ser el alias `~/lib/booking/widget-state.ts` idéntico al import original.
- `npm run build` falla o no genera ningún chunk con `getMonthAvailability` (el tree-shaking lo eliminó por error) → revierte y reporta.

## Maintenance notes

- Si en el futuro se precarga el widget (p.ej. `<link rel="modulepreload">` al
  hacer hover sobre "Reservar", imitando la estrategia `prefetch` de Astro),
  hacerlo aquí; el `import()` dinámico es compatible con modulepreload.
- El teléfono del fallback (`34623941891`) sigue hardcodeado en este `catch`;
  el plan 008 lo centraliza. Si 008 ya se aplicó, respeta su referencia en vez
  de reintroducir el literal.
- Un revisor debe confirmar que el handler quedó `async` y que `mountWidget` se
  usa solo dentro del `try` (si se usara fuera, el `await import` no lo cubriría).
