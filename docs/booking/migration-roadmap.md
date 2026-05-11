# Migration Roadmap — Sistema de Reservas Voramà

> Plan por fases para construir el módulo de reservas y reemplazar Calendly. Cada fase tiene criterios de "done" verificables. Se ejecuta en este orden, sin saltos.

---

## Contexto

Hoy: Calendly como widget popup en cada botón "Reservar" (`src/components/interactive/CalendlyDialog.astro` carga lazy `widget.js` y monta iframe inline). URL única `calendly.com/vorama/sesion-masaje-120` para todos los servicios.

Objetivo: widget propio integrado, lectura real de disponibilidad de Google Calendar, envío vía Web3Forms, todo client-side en GitHub Pages. Cero backend.

---

## Fase C0 — Decisiones tomadas (✅ ya validadas)

- Hosting: GitHub Pages.
- Storage: ninguno; GCal solo lectura libre/ocupado.
- Notificación: Web3Forms (email a Miguel).
- 1 terapeuta, sin pago online, sin auto-cancelación cliente, solo español.

Documentado en `architecture.md` y `project-rules.md`.

---

## Fase C1 — Contracts y datos en repo (1 día)

**Objetivo:** definir tipos, schemas y datos sin runtime. El proyecto debe seguir compilando.

**Tareas:**

1. Crear `src/lib/booking/types.ts` con todos los tipos de dominio.
2. Crear `src/lib/booking/schemas.ts` con todos los Zod schemas.
3. Crear `src/lib/booking/config.ts` con constantes (buffer, max días, timezone, step).
4. Crear `src/content/booking/services.json` con los 6 servicios reales.
5. Crear `src/content/booking/availability-rules.json` con franjas iniciales (a confirmar con Miguel).
6. Añadir colecciones `booking/services` y `booking/availability-rules` en `src/content.config.ts` con los Zod schemas.
7. Añadir las variables `PUBLIC_*` a `.env.example` (no a `.env` real aún).
8. Añadir `zod` a `package.json` si no está.

**Criterios de "done":**

- [ ] `npm run build` pasa sin warnings.
- [ ] `astro check` no reporta errores de tipos.
- [ ] `getCollection('bookingServices')` y `getCollection('bookingAvailabilityRules')` devuelven arrays tipados.
- [ ] No se ha tocado nada en `src/components/` ni en `src/pages/`.

---

## Fase C2 — Widget UI con datos mock (2 días)

**Objetivo:** el widget completo funciona end-to-end con disponibilidad mockeada. Sin llamadas a GCal ni a Web3Forms reales. UX y a11y validadas.

**Tareas:**

1. Crear `src/components/booking/BookingDialog.astro` (wrapper sobre `Dialog.astro`).
2. Crear `src/components/booking/BookingWidget.astro` + `booking-widget.client.ts` (orquestador de pasos).
3. Crear `CalendarPicker.astro` (grid mes, navegación teclado completa, ARIA grid).
4. Crear `TimeSlotList.astro` (listbox de slots).
5. Crear `BookingForm.astro` (formulario con validación inline, honeypot, consent RGPD).
6. Crear `BookingSummary.astro`, `BookingSuccess.astro`, `BookingError.astro`.
7. En `src/lib/booking/availability.ts`: lógica de generación de slots desde rules (sin GCal aún). Mockear `freebusy` con array vacío.
8. En `src/lib/booking/submit.ts`: stub que devuelve `{ ok: true }` sin POST real.
9. Montar el widget en `src/pages/_dev/booking.astro` para iterar visualmente.
10. CSS scoped en cada componente con tokens `--vrm-*`.

**Criterios de "done":**

- [ ] El widget se abre y se cierra desde un botón de prueba.
- [ ] Navegable 100 % por teclado: Tab, Shift+Tab, flechas, Enter, Esc.
- [ ] Lighthouse mobile en `/_dev/booking/`: Performance ≥ 90, Accessibility ≥ 95.
- [ ] Validación del formulario funciona (campos requeridos, email, teléfono, consent).
- [ ] Cambios de paso anunciados vía `aria-live`.
- [ ] Mobile: dialog full-screen, slots como botones ≥ 44 px.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Bundle del widget ≤ 15 KB gzip.

---

## Fase C3 — Integración real con Google Calendar y Web3Forms (1-2 días)

**Objetivo:** sustituir los mocks por llamadas reales. El widget muestra disponibilidad real y envía emails reales.

**Pre-requisitos (gestionados por Miguel, documentados en `booking-system-spec.md`):**

- Calendario Google compartido en modo "Ver libre/ocupado".
- API key de Google Cloud creada y restringida por referrer.
- Cuenta Web3Forms y access key obtenida.
- Variables `PUBLIC_GCAL_API_KEY`, `PUBLIC_GCAL_CALENDAR_ID`, `PUBLIC_WEB3FORMS_KEY` configuradas en GitHub Actions secrets del repo.

**Tareas:**

1. Implementar `src/lib/booking/gcal.ts`: fetch a `https://www.googleapis.com/calendar/v3/freeBusy?key=...` con caché en `sessionStorage` (TTL 60 s).
2. Conectar `availability.ts` con `gcal.ts` (sustituir mock por llamada real, aplicar buffer al filtrar).
3. Implementar `src/lib/booking/submit.ts`: POST real a `https://api.web3forms.com/submit` con JSON.
4. Manejo de errores: timeout 8 s, reintento 1 vez, fallback a `BookingError` con CTA WhatsApp.
5. Validar el workflow de GitHub Actions inyecta los `PUBLIC_*` correctamente en el build.
6. Tests manuales en preview deploy (rama no-main) con la API key de prueba.

**Criterios de "done":**

- [ ] El calendario muestra días con disponibilidad real (verificable creando un evento de prueba en GCal y viendo el slot desaparecer tras 60 s de caché).
- [ ] Una solicitud de prueba llega como email a la cuenta de Miguel.
- [ ] Cuando se desconecta la red, el widget muestra `BookingError` y no se cuelga.
- [ ] La API key Google rechaza requests desde otros dominios (verificable en consola de error).
- [ ] El honeypot de Web3Forms descarta bots (test manual rellenando el campo oculto).
- [ ] Caché funciona (network tab muestra una sola llamada freebusy por mes).

---

## Fase C4 — Cutover (½ día)

**Objetivo:** reemplazar Calendly en producción. Cero referencias a Calendly tras este paso.

**Tareas:**

1. En `src/layouts/BaseLayout.astro`: cambiar `<CalendlyDialog />` por `<BookingDialog />`.
2. En `src/components/sections/ReservaCard.astro`: cambiar `data-dialog="dialog-calendly"` → `data-dialog="booking"`. Añadir props `serviceId`, `durationMin` y propagarlas a `data-service-id` / `data-duration-min`.
3. Pasar las props correctas en cada uso de `<ReservaCard>` (en cada `index.astro` de los 3 servicios + `servicios-masaje-californiano/index.astro`).
4. En cada botón "Reservar" suelto (Header desktop, Header mobile, Sobre Mí): cambiar `data-dialog="dialog-calendly"` → `data-dialog="booking"` y añadir `data-service-id` por defecto (`californiano-90`) + `data-duration-min="90"`.
5. Eliminar `src/components/interactive/CalendlyDialog.astro`.
6. Quitar cualquier referencia a `assets.calendly.com` y `calendly.com/vorama/...` del código.
7. Eliminar `src/pages/_dev/booking.astro` (o renombrar a `booking-test.astro` y mantener fuera del sitemap).
8. Smoke test completo de la checklist en `project-rules.md` § 5.
9. Merge a main → deploy a GitHub Pages.

**Criterios de "done":**

- [ ] `grep -r "calendly" src/` devuelve cero resultados.
- [ ] Smoke test manual completo OK (todos los puntos de § 5 de `project-rules.md`).
- [ ] Lighthouse en página principal y en página de servicio individual: targets cumplidos.
- [ ] Una reserva real de prueba completa el flujo: email recibido + evento creado manualmente + slot desaparece.

---

## Fases futuras (post-MVP, sin compromiso de fecha)

### C5 — Hardening (½ día, si surge necesidad)

- Métricas básicas de éxito/fallo (sin PII): contador de aperturas del dialog, contador de submits exitosos vs error.
- Mejora de copys según feedback real de clientes.
- Revisión RGPD post-uso real.

### C6 — Auto-creación de evento en GCal (opcional)

- Conectar Web3Forms con Zapier/Make para crear automáticamente el evento `tentative` en GCal de Miguel al recibir el email.
- Ahorra a Miguel un paso manual.
- Coste y mantenimiento de Zapier a evaluar.

### C7 — Pago online

- Stripe Payment Links generados al confirmar reserva.
- Requiere backend mínimo o link estático por servicio (más simple).
- Decisión queda en backlog; depende de demanda real de pago anticipado.

---

## Validación visual continua

Durante todas las fases:

- Comparar visualmente el widget con el resto del sitio (mismos tokens, misma sensación).
- Probar siempre mobile primero.
- Tomar screenshots de cada paso del widget en C2 y compartir con el usuario para feedback temprano.

---

## Indicadores de éxito post-deploy

A los 14 días del cutover:

- 0 emails de cliente quejándose de no poder reservar.
- ≥ 1 reserva exitosa por la nueva vía.
- 0 envíos detectados de spam vía Web3Forms (si pasa, activar reCAPTCHA opcional).
- Lighthouse mobile mantiene targets ≥ 90/95/100.

Si alguno de estos KPIs falla, abrir issue para C5.
