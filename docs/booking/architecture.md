# Architecture — Sistema de Reservas Voramà

> Módulo de reservas propio que reemplaza Calendly. **100 % client-side, sin backend, sin base de datos.** Forma parte del proyecto `vorama-astro` y respeta sus convenciones generales (ver `docs/architecture.md`, `docs/conventions.md`, `docs/project-rules.md`).

---

## 1. Visión general

El cliente abre el widget desde cualquier botón "Reservar" del sitio, ve los huecos libres reales del calendario de Miguel (calculados con sus reglas semanales + lectura "free/busy" del calendario), elige hora, rellena sus datos, y envía la solicitud. Miguel recibe un email con todos los datos. Toda confirmación, cancelación y pago se gestionan manualmente fuera del sistema (WhatsApp + metálico/presencial).

**Decisiones que definen este diseño:**

- Hosting: **GitHub Pages** (estático). No se monta backend propio.
- Storage: **ninguno**. Las reservas no se persisten en el sistema; el email es el registro.
- Lectura de disponibilidad: **Google Calendar API en el navegador**, con calendario compartido en modo "Ver libre/ocupado" y API key restringida por dominio.
- Reglas de franjas horarias: **JSON en el repo** (`src/content/booking/availability-rules.json`), embebidas en el bundle.
- Envío de la solicitud: **Web3Forms** (form-to-email, plan free 250/mes, sin backend).
- 1 solo terapeuta (Miguel) → 1 solo calendario.
- Sin pago online, sin auto-cancelación cliente, solo español.

---

## 2. Diagrama de componentes y flujo

```
┌──────────────────────────────────────────────────────┐
│  Astro static (GitHub Pages)                         │
│                                                      │
│  ┌────────────────┐    ┌──────────────────────────┐  │
│  │ BookingWidget  │ →  │ availability.ts          │  │
│  │ (vanilla TS)   │    │  • lee rules JSON        │  │
│  │                │    │  • genera slots          │  │
│  │                │    │  • llama GCal freebusy   │──┼──→ Google Calendar API
│  │                │    │  • filtra ocupados+buffer│  │   (freebusy.query)
│  │                │    └──────────────────────────┘  │   API key restringida
│  │                │                                  │   Calendario "free/busy"
│  │                │    ┌──────────────────────────┐  │
│  │                │ →  │ submit.ts                │──┼──→ Web3Forms
│  │                │    │  • POST a Web3Forms      │  │   (access key)
│  └────────────────┘    └──────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                                                       └→ email a Miguel
```

**No hay** servidor propio, **no hay** endpoints API en `src/pages/api/*`, **no hay** variables de entorno de servidor. Las claves usadas (Google API key, Web3Forms access key) son **públicas en el bundle**, protegidas por restricciones del proveedor.

---

## 3. Capas

### 3.1. Datos en repo (build-time)

- `src/content/booking/services.json` — catálogo de servicios reservables.
- `src/content/booking/availability-rules.json` — franjas semanales por servicio.
- Validados con Zod en `src/content.config.ts`. Tipos generados automáticamente via Content Collections.

### 3.2. Lib (`src/lib/booking/`)

| Módulo | Responsabilidad |
|---|---|
| `types.ts` | Tipos TS compartidos (`Service`, `AvailabilityRule`, `Slot`, `BookingRequest`, …) |
| `schemas.ts` | Zod schemas — validación runtime del formulario y assertions defensivas |
| `config.ts` | Constantes: buffer (20 min), max días (60), timezone (`Europe/Madrid`), step de slots (15 min) |
| `availability.ts` | Generador de slots desde rules + fusión con `busy[]` + buffer |
| `gcal.ts` | Wrapper de `freeBusy.query` (fetch a `googleapis.com`) con caché en `sessionStorage` (TTL 60 s) |
| `submit.ts` | POST a `api.web3forms.com/submit` con manejo de errores y reintentos |

### 3.3. Componentes (`src/components/booking/`)

UI declarativa en `.astro` + lógica en módulo TS aparte. Patrón vanilla, sin frameworks.

Ver `component-inventory.md` para el listado completo.

### 3.4. Integración con el chasis del sitio

- Reutiliza `src/components/interactive/Dialog.astro` (focus trap, ESC, backdrop click) **sin modificarlo**.
- `BookingDialog.astro` se incluye una sola vez en `src/layouts/BaseLayout.astro` (sustituyendo el actual `<CalendlyDialog />`).
- `src/components/sections/ReservaCard.astro` cambia solo dos atributos: `data-dialog="booking"` y añade `data-service-id` + `data-duration-min`.

---

## 4. Flujo end-to-end

1. Usuario clica un botón "Reservar" → `Dialog.astro` dispara `vrm:dialog-open` con `detail: { dialogId: 'booking', serviceId, durationMin }`.
2. `BookingDialog` recibe el evento, abre el `<dialog>` y monta el widget en estado `step=calendar`.
3. `CalendarPicker` pide a `availability.ts` los días disponibles del mes actual:
   - Lee la `AvailabilityRule` del `serviceId` (ya en bundle).
   - Genera slots cada 15 min dentro de las franjas.
   - Llama a `gcal.ts → freeBusy.query` con `timeMin/timeMax` del mes (usa caché si la hay).
   - Filtra slots que solapen con `busy[]` extendido por `BUFFER_MIN`.
   - Devuelve `{ days: Map<YYYY-MM-DD, Slot[]> }`.
4. Usuario navega el calendario, elige día → `TimeSlotList` muestra los slots libres → elige hora.
5. `BookingForm` recoge nombre, email, teléfono, notas, consent RGPD. Honeypot oculto `botcheck`.
6. `BookingSummary` muestra el resumen. Botón "Solicitar".
7. `submit.ts` valida con Zod → POST a Web3Forms con el cuerpo formateado.
8. Éxito → `BookingSuccess` ("Hemos recibido tu solicitud. Miguel te contactará por WhatsApp en breve.").
9. Miguel recibe el email → decide:
   - Aceptar: crea evento en su Google Calendar manualmente y avisa al cliente por WhatsApp.
   - Rechazar/proponer otra hora: contacta al cliente por WhatsApp.

> **No hay confirmación automática al cliente.** El primer contacto post-solicitud es WhatsApp manual de Miguel.

---

## 5. Modelo de dominio (resumen)

- **Service**: `{ id, name, durationMin, priceEur }`. Identificadores: `californiano-90`, `californiano-120`, `cuatro-manos-60`, `cuatro-manos-90`, `para-dos-60`, `para-dos-90`.
- **AvailabilityRule**: `{ serviceId, weekly: { [weekday: 0..6]: TimeRange[] } }`.
- **Slot** (runtime): `{ startISO, endISO, serviceId }`.
- **BookingRequest** (runtime): `{ serviceId, startISO, customer, hp_website }`.
- No hay entidad `Booking` persistida.

Ver `booking-system-spec.md` para schemas Zod completos.

---

## 6. Variables de entorno (todas `PUBLIC_`, build-time)

```
PUBLIC_GCAL_API_KEY=
PUBLIC_GCAL_CALENDAR_ID=
PUBLIC_WEB3FORMS_KEY=
PUBLIC_BOOKING_BUFFER_MIN=20
PUBLIC_BOOKING_MAX_DAYS_AHEAD=60
PUBLIC_BOOKING_TIMEZONE=Europe/Madrid
```

Inyectadas en build via `import.meta.env.PUBLIC_*`. Las restricciones de seguridad están en el lado del proveedor:

- Google API key: restringida por **HTTP referrer** al dominio del sitio + restringida a **Calendar API**.
- Web3Forms access key: protegida por honeypot nativo + límite del plan (250/mes).
- Calendario Google: compartido solo en modo "Ver libre/ocupado", nunca con detalles.

---

## 7. Performance y caché

- Disponibilidad cacheada en `sessionStorage` con TTL **60 s** por (mes, serviceId). Reduce llamadas en navegación rápida del calendario.
- Bundle del widget: target < 15 KB (gzip). Sin frameworks. Carga lazy: el módulo TS se importa dinámicamente al primer `vrm:dialog-open` con `dialogId='booking'`.
- Lighthouse mobile target: ≥ 90 Performance, ≥ 95 Accessibility, SEO 100 (igual que el resto del sitio).

---

## 8. Accesibilidad

- Focus trap heredado del `Dialog.astro` existente.
- `CalendarPicker`: `role="grid"`, celdas con `aria-disabled` cuando no hay slots, navegación por flechas + Home/End + PageUp/PageDown (mes anterior/siguiente).
- `TimeSlotList`: `role="listbox"`, slots con `role="option"` y `aria-selected`.
- Cambios de paso anunciados con `aria-live="polite"`.
- Errores de validación con `aria-describedby` y mensajes textuales.
- Mobile: dialog full-screen, slots como botones ≥ 44 × 44 px.
- `prefers-reduced-motion` respetado en transiciones.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| API key Google scrapeable | Restringida por HTTP referrer al dominio + a Calendar API. Alertas de quota en Google Cloud al 50 % y 80 % del free tier (1 M req/día). |
| Web3Forms 250/mes insuficiente | Volumen actual lo cubre; si se llega al límite, plan paid o swap a Formspree. |
| Race condition (dos solicitudes mismo slot) | Aceptable: la segunda verá el slot libre porque Miguel aún no creó el evento. Miguel resuelve por WhatsApp. |
| URL del calendario filtrada | Solo expone busy times opacos, no detalles. Riesgo bajo. |
| GH Pages base path (`/vorama-astro/`) | Tener en cuenta en URLs internas y en el referrer de la API key. |
| GCal o Web3Forms caídos | El widget muestra `BookingError` con CTA a WhatsApp como fallback. |

---

## 10. Documentos relacionados

- `conventions.md` — naming, schemas, errores, i18n.
- `project-rules.md` — reglas duras del módulo.
- `migration-roadmap.md` — fases C1–C4.
- `component-inventory.md` — lista de componentes y módulos.
- `booking-system-spec.md` — especificación funcional + setup paso a paso.
- `../architecture.md` — arquitectura general del sitio.
