# Component Inventory — Sistema de Reservas Voramà

> Inventario tipado de todos los componentes y módulos del módulo de reservas. Sigue el estilo del `docs/component-inventory.md` general del proyecto.

---

## Resumen

**13 unidades** organizadas en 3 grupos:

- **Componentes Astro** (9): UI declarativa scoped.
- **Módulos lib TS** (6): lógica pura sin DOM.
- **Datos en repo** (2): JSON validados con Zod.

---

## 1. Componentes Astro (`src/components/booking/`)

### `BookingDialog.astro`

**Propósito:** wrapper sobre `Dialog.astro` que escucha `vrm:dialog-open` con `dialogId='booking'` y monta el widget.

**Props:** ninguna (componente global, se incluye una vez en `BaseLayout.astro`).

**Recibe payload via evento:** `{ serviceId: string, durationMin: number }` desde el botón que dispara la apertura.

**Notas:**
- Reutiliza `Dialog.astro` sin modificarlo.
- Mantiene un único `<dialog>` global; los pasos del widget cambian dentro.
- Lazy-importa `booking-widget.client.ts` la primera vez que se abre.

---

### `BookingWidget.astro` + `booking-widget.client.ts`

**Propósito:** orquestador multi-paso. Mantiene el estado `BookingStep` y renderiza el componente del paso actual.

**Props:** `serviceId: string`, `durationMin: number` (recibidas via dataset del contenedor).

**Estados:** `calendar | form | summary | success | error`.

**Eventos emitidos:**
- `vrm:booking:step-change` (detail: `{ from, to }`)
- `vrm:booking:submit-success`
- `vrm:booking:submit-error` (detail: `{ code }`)

---

### `CalendarPicker.astro`

**Propósito:** grid mensual de fechas. Marca días con disponibilidad como activos.

**Props:** `serviceId: string`, `durationMin: number`, `selectedDate?: string`.

**A11y:** `role="grid"`, celdas con `role="gridcell"` y `aria-disabled` cuando no hay slots. Navegación: flechas, Home/End (inicio/fin de semana), PageUp/PageDown (mes anterior/siguiente).

**Llama a:** `availability.ts → getAvailabilityForMonth(serviceId, year, month)`.

---

### `TimeSlotList.astro`

**Propósito:** lista de slots libres del día seleccionado.

**Props:** `slots: Slot[]`, `selectedSlot?: Slot`.

**A11y:** `role="listbox"`, slots con `role="option"` y `aria-selected`. Navegación: flechas arriba/abajo, Enter para seleccionar.

---

### `BookingForm.astro`

**Propósito:** formulario con datos del cliente.

**Props:** `serviceId: string`, `slot: Slot`.

**Campos:**
- `name` (requerido, 2-80 chars)
- `email` (requerido, formato válido)
- `phone` (requerido, formato internacional)
- `notes` (opcional, max 500 chars)
- `consentRgpd` (checkbox requerido)
- `botcheck` (honeypot oculto, debe quedar vacío)

**Validación:** inline con `aria-describedby`. Bloquea avanzar a `summary` hasta que pase.

---

### `BookingSummary.astro`

**Propósito:** resumen final antes del submit.

**Props:** `serviceId: string`, `slot: Slot`, `customer: Customer`.

**Acciones:** "Atrás" → vuelve a `form`. "Confirmar solicitud" → llama a `submit.ts`.

---

### `BookingSuccess.astro`

**Propósito:** mensaje de éxito tras submit exitoso.

**Props:** ninguna (mensaje estático).

**Copy:** "Hemos recibido tu solicitud. Miguel te contactará por WhatsApp en breve para confirmar."

**Acción:** botón "Cerrar" cierra el dialog. Sin opción de "volver atrás".

---

### `BookingError.astro`

**Propósito:** estado de error recuperable.

**Props:** `code: 'GCAL_DOWN' | 'SUBMIT_FAILED' | 'OFFLINE' | 'INVALID_SLOT'`.

**Acciones:** "Reintentar" (vuelve al paso anterior y reintenta) + CTA secundaria "Contactar por WhatsApp" (link a `wa.me/<TELEFONO>`).

---

## 2. Módulos lib TS (`src/lib/booking/`)

### `types.ts`

**Exporta:**
- `Service`, `ServiceId`
- `AvailabilityRule`, `WeekdayKey`, `TimeRange`
- `Slot`
- `Customer`, `BookingRequest`
- `BookingStep`
- `BookingErrorCode`

Sin lógica, solo tipos.

---

### `schemas.ts`

**Exporta los Zod schemas correspondientes a cada tipo de `types.ts`:**

- `ServiceSchema`, `AvailabilityRuleSchema`, `TimeRangeSchema`
- `CustomerSchema`, `BookingRequestSchema`

Mensajes de error en español. Reusados desde `src/content.config.ts` para validar JSON en build.

---

### `config.ts`

**Constantes derivadas de `import.meta.env.PUBLIC_*`:**

```ts
export const BUFFER_MIN: number;        // default 20
export const MAX_DAYS_AHEAD: number;    // default 60
export const TIMEZONE: string;          // 'Europe/Madrid'
export const SLOT_STEP_MIN: number;     // 15
export const GCAL_API_KEY: string;
export const GCAL_CALENDAR_ID: string;
export const WEB3FORMS_KEY: string;
```

Lanza error fatal en build si falta cualquiera de las claves obligatorias.

---

### `availability.ts`

**Funciones públicas:**

```ts
getAvailabilityForMonth(
  serviceId: ServiceId,
  year: number,
  monthZeroBased: number
): Promise<{ days: Map<string, Slot[]> }>;

getSlotsForDay(
  serviceId: ServiceId,
  isoDate: string
): Promise<Slot[]>;
```

Combina:
1. La `AvailabilityRule` del servicio (build-time, importada de `src/content/booking/availability-rules.json` via Content Collection).
2. El resultado de `gcal.queryFreebusy(timeMin, timeMax)`.
3. El buffer (`BUFFER_MIN`).

Genera slots cada `SLOT_STEP_MIN` minutos dentro de las franjas, descarta los que solapen con `busy[]` ± buffer.

---

### `gcal.ts`

**Funciones públicas:**

```ts
queryFreebusy(
  timeMinISO: string,
  timeMaxISO: string,
  signal?: AbortSignal
): Promise<{ busy: TimeRange[] }>;
```

Internamente:
1. Comprueba `sessionStorage` con clave `booking:freebusy:{YYYY-MM}:{serviceId}`. Si hit y TTL < 60 s, devuelve cacheado.
2. Si no, fetch a `https://www.googleapis.com/calendar/v3/freeBusy?key=GCAL_API_KEY` con timeout 8 s.
3. Cachea respuesta y devuelve.

Lanza `BookingError('GCAL_DOWN', …)` en fallo.

---

### `submit.ts`

**Funciones públicas:**

```ts
submitBooking(request: BookingRequest): Promise<{ ok: true }>;
```

1. Valida con `BookingRequestSchema`.
2. Comprueba honeypot vacío.
3. Comprueba rate-limit en `sessionStorage` (1 envío/min).
4. POST a `https://api.web3forms.com/submit` con body JSON formateado (subject + cuerpo legible).
5. Reintento 1 vez en caso de fallo de red.

Lanza `BookingError('SUBMIT_FAILED' | 'OFFLINE', …)` en fallo.

---

## 3. Datos en repo (`src/content/booking/`)

### `services.json`

Array de objetos `Service`. 6 entradas iniciales (ver schema en `booking-system-spec.md`).

Validado con `ServiceSchema` en `src/content.config.ts`.

---

### `availability-rules.json`

Array de objetos `AvailabilityRule`. Una entrada por `serviceId`.

Validado con `AvailabilityRuleSchema` en `src/content.config.ts`.

---

## 4. Componentes existentes que se modifican

### `src/components/sections/ReservaCard.astro`

Cambios mínimos:
- Añadir props `serviceId: string` y `durationMin: number`.
- Cambiar `data-dialog="dialog-calendly"` → `data-dialog="booking"`.
- Añadir `data-service-id={serviceId}` y `data-duration-min={durationMin}` al botón.

### `src/layouts/BaseLayout.astro`

Cambios mínimos:
- Cambiar `import CalendlyDialog ...` → `import BookingDialog ...`.
- Cambiar `<CalendlyDialog />` → `<BookingDialog />`.

### `src/components/layout/Header.astro` + páginas con CTAs sueltos

En cada botón "Reservar":
- Cambiar `data-dialog="dialog-calendly"` → `data-dialog="booking"`.
- Añadir `data-service-id="californiano-90"` (default razonable).
- Añadir `data-duration-min="90"`.

### `src/content.config.ts`

Añadir colecciones `bookingServices` y `bookingAvailabilityRules` con sus schemas.

---

## 5. Componentes existentes que se eliminan

### `src/components/interactive/CalendlyDialog.astro`

Borrado completo en C4.

---

## 6. Componentes que NO se crean

Decisiones explícitas para evitar abstracción prematura:

- ❌ `BookingButton.astro` — el botón es `ReservaCard` (modificada) o un `<button>` inline en Header. No hace falta wrapper.
- ❌ `ServiceSelector.astro` — el `serviceId` siempre llega del botón, nunca se elige dentro del widget.
- ❌ `TherapistSelector.astro` — solo hay 1 terapeuta.
- ❌ `BookingAdminPanel.astro` — Miguel gestiona desde su Google Calendar y email.
- ❌ Wrappers tipo `BookingHeading.astro`, `BookingButton.astro`, `BookingInput.astro` — usar elementos HTML directos con clases scoped.

---

## 7. Tracking de implementación

| Componente / módulo | Fase | Estado |
|---|---|---|
| `types.ts` | C1 | ⬜ |
| `schemas.ts` | C1 | ⬜ |
| `config.ts` | C1 | ⬜ |
| `services.json` | C1 | ⬜ |
| `availability-rules.json` | C1 | ⬜ |
| `BookingDialog.astro` | C2 | ⬜ |
| `BookingWidget.astro` + client | C2 | ⬜ |
| `CalendarPicker.astro` | C2 | ⬜ |
| `TimeSlotList.astro` | C2 | ⬜ |
| `BookingForm.astro` | C2 | ⬜ |
| `BookingSummary.astro` | C2 | ⬜ |
| `BookingSuccess.astro` | C2 | ⬜ |
| `BookingError.astro` | C2 | ⬜ |
| `availability.ts` (mock) | C2 | ⬜ |
| `submit.ts` (stub) | C2 | ⬜ |
| `gcal.ts` (real) | C3 | ⬜ |
| `availability.ts` (real) | C3 | ⬜ |
| `submit.ts` (real) | C3 | ⬜ |
| Cutover (modificar ReservaCard, BaseLayout, Header) | C4 | ⬜ |
| Eliminar CalendlyDialog | C4 | ⬜ |

Marcar ✅ a medida que se completen.
