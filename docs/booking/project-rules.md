# Project Rules — Sistema de Reservas Voramà

> Reglas duras del módulo. Lo que SE permite, lo que NO se permite, y lo que requiere discusión previa con el dueño del proyecto. Hereda y respeta `docs/project-rules.md` general; en caso de conflicto gana la regla general salvo donde se especifique lo contrario aquí.

---

## 1. SE PERMITE

### Stack y arquitectura

- **Astro static** con `output: 'static'`. Sigue desplegándose en GitHub Pages.
- **TypeScript estricto** en todos los módulos `src/lib/booking/`.
- **Vanilla TS** para la lógica del widget (sin React/Vue/Svelte/Preact).
- **Zod** para validación de schemas (build-time y runtime).
- **Content Collections** de Astro para `services` y `availability-rules`.
- **CSS scoped** dentro de cada componente `.astro`. Nesting nativo.
- **Tokens `--vrm-*`** del proyecto para colores, espaciados, tipografía, radius, shadows, transitions.
- **Reutilizar `Dialog.astro`** existente como base del modal.
- **`fetch` nativo** del navegador para llamar a Google Calendar y Web3Forms.
- **`sessionStorage`** para caché de freebusy (TTL 60 s).
- **API keys públicas en el bundle** SIEMPRE QUE estén restringidas por el proveedor (referrer en GCal, honeypot en Web3Forms).

### Producto

- **Solicitudes "pending"** que Miguel confirma manualmente fuera del sistema (WhatsApp).
- **Email a Miguel** vía Web3Forms como único registro de la reserva.
- **6 servicios** del catálogo: californiano-90/120, cuatro-manos-60/90, para-dos-60/90.
- **Buffer entre reservas** configurable (default 20 min).
- **Reglas semanales** distintas por servicio (cada serviceId puede tener franjas distintas por día de la semana).
- **Cancelación y reprogramación** vía WhatsApp con Miguel.
- **Pago en metálico o presencial** (no online).

---

## 2. NO SE PERMITE

### Arquitectura y stack

- ❌ **Migrar a Vercel/Netlify/Cloudflare Pages** o cualquier hosting con backend. Decisión explícita del usuario: GitHub Pages obligatorio.
- ❌ **Endpoints API propios** (`src/pages/api/*.ts` para reservas). Todo es client-side.
- ❌ **Adapter Astro** (`@astrojs/vercel`, `@astrojs/node`, etc.). El proyecto sigue `output: 'static'`.
- ❌ **Base de datos** (Turso, Postgres, Supabase, SQLite local, IndexedDB persistente). No se persiste estado de reservas en ningún lado del sistema; el email es el registro.
- ❌ **OAuth de usuario** para Google Calendar. Se usa solo lectura pública "free/busy" con API key restringida.
- ❌ **Service account de Google** (requiere backend para custodiar la JSON key).
- ❌ **WhatsApp Business API** (Twilio, 360dialog, Meta API). Comunicación con cliente es manual.
- ❌ **Stripe / Paypal / pasarela de pago** en el MVP. Pago metálico/presencial.
- ❌ **Frameworks de UI** (React, Vue, Svelte, Preact, SolidJS). Vanilla TS es suficiente.
- ❌ **jQuery, Tailwind, Bootstrap, SCSS**. Heredado de las reglas generales del proyecto.
- ❌ **Librerías pesadas de calendario** (FullCalendar, react-day-picker, etc.). Se construye un picker propio mínimo (~5 KB).
- ❌ **`localStorage`** para datos del cliente entre sesiones. Solo `sessionStorage` para caché efímera.

### Datos y privacidad

- ❌ **Almacenar PII del cliente** en repo, en sessionStorage permanente, en cookies, en analytics.
- ❌ **Compartir el calendario de Miguel con detalles**. Solo modo "Ver libre/ocupado".
- ❌ **Logs con PII** (nombre, email, teléfono) en `console.*` ni en errores enviados a terceros.
- ❌ **Tracking de pasos del widget** sin consent banner aprobado.

### Producto

- ❌ **Confirmación automática al cliente** por email/SMS. Lo hace Miguel manualmente por WhatsApp.
- ❌ **Auto-cancelación por el cliente** desde el widget. Solo por WhatsApp con Miguel.
- ❌ **Selector de terapeuta**. Solo hay uno (Miguel).
- ❌ **Multi-idioma** (catalán, inglés). Solo español en el MVP.
- ❌ **Reservas con > 60 días de antelación**. Límite hardcodeado en `config.ts`.
- ❌ **Slots con duración custom**. Solo las duraciones del catálogo (60, 90, 120 min según servicio).

---

## 3. REQUIERE DISCUSIÓN PREVIA

Cambios que NO son automáticos: deben proponerse al usuario y validarse antes de implementar.

- Añadir/quitar servicios del catálogo.
- Cambiar precios.
- Reestructurar las franjas horarias semanales (cambio de `availability-rules.json`).
- Cambiar el buffer global (`PUBLIC_BOOKING_BUFFER_MIN`).
- Añadir un campo nuevo al formulario (más PII).
- Cambiar el copy del email enviado a Miguel.
- Migrar a otro servicio form-to-email distinto de Web3Forms.
- Cambiar el modo de compartición del calendario Google.
- Activar telemetría/analytics del widget.
- Cualquier dependencia npm nueva además de `zod`.

---

## 4. Calidad mínima por componente

- Cada componente `.astro` ≤ **200 líneas**. Si crece más, refactorizar.
- Cada módulo `.ts` ≤ **300 líneas**. Si crece más, dividir.
- Sin `any` salvo en boundaries hacia APIs externas, y siempre con cast explícito + comentario.
- Todas las props de componente tipadas con `interface Props`.
- Todos los componentes interactivos navegables por teclado (Tab, Shift+Tab, Enter, Esc, flechas donde aplique).
- Todos los componentes con foco visible siguiendo los tokens del proyecto.
- Componentes mobile-first (testear primero en 360 px).

---

## 5. Antes del cutover

Checklist obligatoria antes de hacer el swap `CalendlyDialog` → `BookingDialog` en producción:

- [ ] Lighthouse mobile en una página con widget abierto: **Performance ≥ 90, Accessibility ≥ 95, SEO 100**.
- [ ] Smoke test manual: abrir widget desde Header desktop, Header mobile, ReservaCard de cada servicio, botón Sobre Mí. Comprobar que el `serviceId` correcto se pasa.
- [ ] Smoke test manual: solicitar una reserva real → confirmar que llega el email a Miguel → confirmar que aparece su evento manualmente en GCal y que la siguiente consulta al widget marca ese slot como ocupado.
- [ ] Probar 3 navegadores: Chrome, Safari, Firefox. Probar al menos un mobile real (iOS Safari).
- [ ] Probar offline: el widget muestra `BookingError` con CTA WhatsApp.
- [ ] Verificar que la API key Google está restringida por referrer al dominio final.
- [ ] Eliminar todas las referencias a `calendly.com` y al script `widget.js`.
- [ ] Build limpio sin warnings de TypeScript ni de Astro.

---

## 6. Cuando dudes

- Mantén el sistema **mínimo y simple**. Si una feature requiere backend, BD, o complejidad significativa, NO se implementa: se descarta o se gestiona manualmente vía WhatsApp.
- En conflicto entre "más bonito" y "más simple", gana **simple**.
- En conflicto entre "más feature" y "menos dependencias", gana **menos dependencias**.
- Si una decisión cambia un contrato (Service.id, schemas, env vars), pregúntalo antes.
