# Plan 016: Widget de reservas — «Reintentar» que reintenta, foco estable, anuncios correctos y aviso de mes sin huecos

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bdbb94..HEAD -- src/lib/booking/widget-state.ts src/lib/booking/widget-render.ts`
> Debe salir **vacío** (ningún plan anterior del orden recomendado toca estos dos archivos antes que este).
> Si no está vacío, `git apply --check plans/016-booking-widget-a11y.patch` dirá si el parche sigue aplicando;
> si no aplica, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MEDIUM (toca el flujo de reservas, pero el cambio está **probado**: ver "Current state")
- **Depends on**: none (recomendado justo después de 010)
- **Category**: bug / accessibility
- **Planned at**: commit `8bdbb94`, 2026-09-22

## Why this matters

El widget de reservas es el único camino de ingresos de la web. Se comprobaron cuatro fallos, en
producción (https://vorama.es, 2026-09-22, sin enviar ninguna reserva) y con los tests DOM de este plan:

1. **«Reintentar» no reintenta.** Si falla la consulta a Google Calendar (se simuló devolviendo un 503),
   el widget muestra el error con un botón "Reintentar" que **no vuelve a llamar a la API**: pinta el
   calendario con los 30 días en gris ("no disponible"). El visitante cree que no hay huecos y se va.
   Causa: `widget-state.ts:380-383` vuelve al paso `calendar` sin llamar a `loadAvailability()`.
2. **El foco del teclado se pierde en cada selección.** Tras pulsar "Mes siguiente", elegir día o elegir
   hora, `document.activeElement` pasa a ser `<body>` (en producción se comprobó al cambiar de mes —ahora no
   hay días libres que elegir—; el test lo reproduce también al elegir día). Cada `render()` hace
   `container.innerHTML = …` y destruye el botón enfocado; quien navega con teclado vuelve a empezar desde
   el botón de cerrar y tiene que tabular por **todos** los días disponibles (cada día es una parada de
   tabulación). Falla WCAG 2.4.3.
3. **Los lectores de pantalla oyen mensajes caducados.** La región `aria-live` se recrea en cada render
   copiando su atributo `data-announce`, así que el primer mensaje ("90 minutos seleccionados. Elige una
   fecha.") **se repite tras cada clic** (comprobado en producción al cambiar de mes), mientras que el
   anuncio "Día … seleccionado, N horarios disponibles" se escribe en un nodo que se destruye antes de
   leerse. WCAG 4.1.3.
4. **ARIA inválido en los horarios** (revisión de código, confirmado por el test): `<ul role="listbox">` con
   `<li role="option">` que contienen `<button>` (controles interactivos anidados). Lighthouse no lo ve
   porque el widget no está en el HTML inicial.

Además, cuando un mes no tiene huecos (agenda completa o **bloqueada a propósito por el titular**, como
ahora) el visitante solo ve una rejilla gris sin explicación. El arreglo añade un aviso con enlace a
WhatsApp. Y, al fallar la validación del formulario, el foco no va al primer campo con error.

## Current state

**Probado**: el parche `plans/016-booking-widget-a11y.patch` se aplicó en dos clones desechables del repo:

- `astro@6.4.6` + `vitest@4.1.8`: 21/21 tests y `astro check` 0/0/0.
- `astro@7.3.3` + `vitest@5.0.1` (plan 010 aplicado): 21/21 tests, `astro check` 0/0/0 y build correcto.

En los dos casos, **los 7 tests nuevos fallan con el código actual**, cada uno por el fallo que describe, y
pasan con el parche. `git apply --check plans/016-booking-widget-a11y.patch` aplica limpio sobre `8bdbb94`.

- `src/lib/booking/widget-state.ts:104-152` — `render()` actual:

```ts
  function render() {
    let html = '';
    const live = container.querySelector<HTMLElement>('[aria-live="polite"]');
    const msg = live?.getAttribute('data-announce');
    …
    container.innerHTML = `
      <div aria-live="polite" class="sr-only" data-announce="${msg ?? ''}"></div>
      <div class="bw-content">${html}</div>`;

    attachListeners();
    if (msg) setTimeout(() => announce(msg), 50);
  }
```

- `widget-state.ts:379-383` — el reintento:

```ts
    container.querySelector('[data-bw-retry]')?.addEventListener('click', () => {
      state.errorCode = null;
      goToStep(state.selectedSlot ? 'summary' : 'calendar', 'Reintentar');
    });
```

- `widget-render.ts:156-160` — días: el `tabindex` itinerante está en el `<td>`, no en el botón (todos los
  botones de día son paradas de tabulación); `widget-render.ts:209-219` — horarios con
  `role="listbox"`/`role="option"` y un `<button>` dentro de cada opción.
- `renderError` (`widget-render.ts:344-357`) **siempre** muestra "Reintentar"; para `GCAL_DOWN` y `OFFLINE`
  al cargar la disponibilidad, `state.selectedSlot` es `null`.
- Tests actuales: `src/lib/booking/availability.test.ts` (14), entorno `node` en `vitest.config.ts`. El
  widget necesita DOM: el test nuevo usa `// @vitest-environment happy-dom` **solo en su fichero**, así que el
  resto de la suite sigue en `node`.
- `widget-render.ts` es puro (devuelve strings) y `widget-state.ts` solo depende de `fetchBusy`
  (`gcal.ts`), que el test simula con `vi.mock`. `config.ts` ya se puede importar en tests gracias a
  `src/lib/booking/test-setup.ts`.

Qué hace el parche (para revisarlo, no para teclearlo):

| Archivo | Cambio |
|---|---|
| `widget-state.ts` | Estructura fija al montar: `<div class="sr-only" aria-live="polite" data-bw-live>` + `<div class="bw-content" data-bw-content>`; `render()` solo sustituye el contenido y **devuelve el foco** al mismo día / hora / flecha de mes (`focusSelectorFor`); `announce()` escribe en la región fija; `goToStep()` anuncia después de renderizar; "Reintentar" vuelve a llamar a `loadAvailability()` cuando no hay hora elegida; aviso de mes sin huecos; flechas del calendario que saltan los días sin huecos; flechas ←→↑↓ en horarios con `tabindex` itinerante; foco al primer campo con `aria-invalid="true"` si falla la validación |
| `widget-render.ts` | Una sola parada de tabulación en la rejilla (día elegido o primer día disponible) con `tabindex` en el **botón**; horarios como `<ul>` de botones con `aria-pressed` (sin listbox/option); `renderEmptyMonth()`; `aria-invalid` en nombre, email, teléfono y casilla |
| `widget-state.test.ts` (nuevo) | 7 tests con happy-dom: reintento, mes sin huecos, foco en día, foco en "Mes siguiente", una parada en la rejilla, horarios sin listbox, anuncios |

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors`, `0 warnings`, `0 hints` |
| Tests | `npm test` | `Tests  21 passed (21)` (14 + 7) |
| Build | `npm run build` | `Complete!` |
| Dev | `npm run dev` | en DEV el freebusy es un mock vacío: todos los huecos libres |

`npm run build` necesita `.env` (5 claves `PUBLIC_*` con valor `dummy`: `PUBLIC_GCAL_API_KEY`,
`PUBLIC_GCAL_CALENDAR_ID`, `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_WEB3FORMS_KEY_CONTACTO`,
`PUBLIC_WEB3FORMS_KEY_REGALA`). Está en `.gitignore`: **nunca lo commitees**.

## Scope

**In scope**:
- `src/lib/booking/widget-state.ts`
- `src/lib/booking/widget-render.ts` (solo lo que cambia el parche)
- `src/lib/booking/widget-state.test.ts` (crear, lo crea el parche)
- `package.json` / `package-lock.json` (solo añadir `happy-dom` como devDependency)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- `availability.ts`, `gcal.ts`, `submit.ts`, `config.ts`, `schemas.ts`, `types.ts` (el 012 toca `submit.ts`; la
  lógica de huecos y zona horaria no cambia).
- `BookingDialog.astro` (sus estilos globales ya cubren `.bw-empty` y `.sr-only`).
- El enlace de privacidad (`widget-render.ts`, línea de `consentRgpd`), que cambia el 011, y el campo de
  notas, que cambia el 012.
- `vitest.config.ts`: el entorno DOM se declara solo en el fichero de test.

## Git workflow

- Branch: `advisor/016-widget`.
- Commits: (1) `happy-dom` + tests en rojo; (2) arreglo. Español, imperativo, ≤70 caracteres. Ejemplo:
  `Mantener foco y anuncios del widget de reservas entre pasos`.
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm test`, `npm run check`.

**Verify**: `npm test` → `14 passed` · `git apply --check plans/016-booking-widget-a11y.patch` → sin salida (aplica).

### Step 2: Añadir happy-dom

```
npm install -D happy-dom@^20.14.5
```

**Verify**: `node -p "require('./package.json').devDependencies['happy-dom']"` → `^20.14.5` · `npm ls happy-dom` → una sola versión `20.x`.

### Step 3: Tests primero (deben fallar)

Aplica **solo** el fichero de test del parche:

```
git apply --include="src/lib/booking/widget-state.test.ts" plans/016-booking-widget-a11y.patch
```

**Verify**: `npm test` → `Tests  7 failed | 14 passed (21)`. Los 7 fallos esperados, con estos mensajes:

- "«Reintentar» vuelve a pedir la disponibilidad…" → `expected "vi.fn()" to be called 2 times, but got 1 times`
- "avisa cuando el mes no tiene huecos…" → falla al no encontrar `.bw-empty--month`
- "mantiene el foco en el día elegido" → `expected undefined to be '2026-06-02'`
- "mantiene el foco en «Mes siguiente»…" → `expected false to be true`
- "la rejilla del calendario es una sola parada…" → `expected +0 to be 1`
- "los horarios son botones con aria-pressed…" → `expected 8 to be +0`
- "anuncia el día elegido…" → recibe `'90 minutos seleccionados. Elige una f…'`

Si alguno **pasa** antes del arreglo, STOP (el código ya no es el descrito).

### Step 4: Aplicar el arreglo

```
git apply --exclude="src/lib/booking/widget-state.test.ts" plans/016-booking-widget-a11y.patch
```

**Verify**:
- `npm test` → `Tests  21 passed (21)`
- `npm run check` → `0 errors`, `0 warnings`, `0 hints`
- `npm run build` → OK
- `grep -c 'role="listbox"\|role="option"' src/lib/booking/widget-render.ts` → `0`
- `grep -c "data-announce" src/lib/booking/widget-state.ts` → `0`
- `grep -n "loadAvailability();" src/lib/booking/widget-state.ts` → incluye una línea dentro del handler de `data-bw-retry`

### Step 5: Prueba manual con teclado (`npm run dev`)

En DEV todos los huecos salen libres (mock). Abre http://localhost:4321/masaje-californiano-relajante/:

1. Tab hasta una tarjeta "Sesión de 90 minutos" → Enter: se abre el calendario.
2. Tab hasta la rejilla: **una sola** parada; las flechas mueven entre días disponibles; Enter elige el día.
3. Tras Enter, el foco **sigue en el día** (no salta al botón de cerrar). Tab → primer horario; las flechas
   recorren horarios; Enter elige; Tab → "Continuar →".
4. "Mes siguiente" con Enter: el foco se queda en la flecha.
5. En el formulario, "Continuar" con los campos vacíos: el foco va al campo "Nombre" y se lee el error.

Deja constancia en el informe de que lo has comprobado (o de que no has podido abrir un navegador).

## Test plan

- Nuevo: `src/lib/booking/widget-state.test.ts` (7 tests, happy-dom, `fetchBusy` simulado con `vi.mock`,
  fecha fijada a 2026-06-01 con `vi.useFakeTimers({ toFake: ['Date'] })` para que haya huecos). Patrón de
  estilo: `availability.test.ts`.
- Recomendado después del merge: con un lector de pantalla (NVDA + Chrome o VoiceOver + Safari), hacer una
  reserva completa en el entorno de desarrollo y comprobar que se oyen el mes, el día elegido y los
  horarios.

## Done criteria

- [ ] `npm test` → 21 passed (14 + 7), con los 7 nuevos vistos en rojo antes del arreglo
- [ ] `npm run check` 0/0/0 · `npm run build` OK
- [ ] `happy-dom` en `devDependencies`; `vitest.config.ts` sin cambios
- [ ] Sin `role="listbox"`/`role="option"` en `widget-render.ts`; sin `data-announce` en `widget-state.ts`
- [ ] Prueba manual del Step 5 hecha (o motivo por el que no)
- [ ] `git status` sin cambios fuera del Scope (y sin `.env`)
- [ ] Fila 016 de `plans/README.md` actualizada

## STOP conditions

Para y reporta si:

- `git apply --check` falla (los archivos han cambiado desde `8bdbb94`). No reconstruyas el parche a mano.
- Algún test nuevo pasa antes del arreglo, o alguno de los 14 de `availability.test.ts` falla después.
- `npm install -D happy-dom` rompe el árbol de dependencias o `npm audit` pasa a mostrar vulnerabilidades nuevas.
- En la prueba manual, elegir día u hora deja de funcionar con el ratón.

## Maintenance notes

- Regla para cambios futuros del widget: **nunca** sustituir `container.innerHTML` entero; renderizar dentro
  de `[data-bw-content]` para no destruir la región `aria-live` fija, y si se añade un control que se
  re-renderiza al pulsarlo, añadirlo a `focusSelectorFor()`.
- `tests`: cualquier cambio de pasos del widget debe venir con su test en `widget-state.test.ts` (ya hay
  entorno DOM). Residual pendiente (fuera de este plan): el `svc as any` de `widget-state.ts` al enviar.
- El aviso de mes sin huecos cubre el caso de "agenda bloqueada a propósito". Si algún día se quiere un
  mensaje distinto para eso (p. ej. "reservas cerradas hasta enero"), la opción limpia es un campo en
  `site.ts` que el widget lea; no añadir lógica de fechas al calendario.
- Revisor: comprobar que el parche no toca la línea del enlace de privacidad ni el campo de notas (son del
  011 y del 012).
