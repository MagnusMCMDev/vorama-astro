# Booking System Spec — Voramà

> Especificación funcional completa del módulo. Sirve como contrato para la implementación. Si algo aquí entra en conflicto con `architecture.md` o `project-rules.md`, ganan estos últimos y se actualiza esta spec.

---

## 1. Objetivo del producto

Permitir a un visitante de la web reservar una sesión de masaje en 4 pasos:

1. Ver los huecos libres reales del calendario de Miguel.
2. Elegir día y hora.
3. Rellenar sus datos.
4. Enviar la solicitud → Miguel recibe email.

Tras el envío, Miguel se pone en contacto por WhatsApp para confirmar y coordinar el pago en metálico.

---

## 2. Catálogo de servicios

Definidos en `src/content/booking/services.json`. Schema:

```ts
type Service = {
  id: string;          // kebab-case, contractual
  name: string;        // mostrado en UI y emails
  durationMin: number; // 60 | 90 | 120
  priceEur: number;
};
```

Datos iniciales:

```json
[
  { "id": "californiano-90",  "name": "Masaje Californiano 90 min",  "durationMin": 90,  "priceEur": 60  },
  { "id": "californiano-120", "name": "Masaje Californiano 120 min", "durationMin": 120, "priceEur": 80  },
  { "id": "cuatro-manos-60",  "name": "Cuatro Manos 60 min",         "durationMin": 60,  "priceEur": 100 },
  { "id": "cuatro-manos-90",  "name": "Cuatro Manos 90 min",         "durationMin": 90,  "priceEur": 130 },
  { "id": "para-dos-60",      "name": "Para Dos 60 min",             "durationMin": 60,  "priceEur": 100 },
  { "id": "para-dos-90",      "name": "Para Dos 90 min",             "durationMin": 90,  "priceEur": 130 }
]
```

---

## 3. Reglas de disponibilidad semanal

Definidas en `src/content/booking/availability-rules.json`. Schema:

```ts
type AvailabilityRule = {
  serviceId: string;
  weekly: {
    [weekday in '0' | '1' | '2' | '3' | '4' | '5' | '6']: TimeRange[];
  };
};

type TimeRange = { start: string; end: string }; // 'HH:mm' 24h
```

`weekday`: 0 = domingo, 1 = lunes, …, 6 = sábado.

Una entrada por `serviceId`. Una franja vacía (`[]`) significa que ese día NO se ofrece ese servicio.

**Plantilla inicial (a confirmar con Miguel):**

```json
[
  {
    "serviceId": "californiano-90",
    "weekly": {
      "0": [],
      "1": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }],
      "2": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }],
      "3": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }],
      "4": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }],
      "5": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }],
      "6": [{ "start": "11:00", "end": "15:00" }]
    }
  }
]
```

Las demás 5 variantes (`californiano-120`, `cuatro-manos-60/90`, `para-dos-60/90`) tendrán entradas similares; las franjas concretas las define Miguel antes de C1.

---

## 4. Generación de slots

Algoritmo en `src/lib/booking/availability.ts`:

```
Para cada día D del mes consultado:
  weekday = D.getDay()
  rangos = rules[serviceId].weekly[weekday]
  para cada rango {start, end}:
    cursor = D + start
    mientras cursor + durationMin <= D + end:
      slotsCandidatos.push({ start: cursor, end: cursor + durationMin })
      cursor += SLOT_STEP_MIN  // 15 min
  
  busy = await gcal.queryFreebusy(D, D + 1d)
  
  para cada slot en slotsCandidatos:
    expanded = { start: slot.start - BUFFER_MIN, end: slot.end + BUFFER_MIN }
    si NO solapa con ningún busy: → slotsLibres.push(slot)
  
  si slotsLibres.length > 0:
    days.set(D, slotsLibres)
```

**Constantes:**

- `SLOT_STEP_MIN = 15` (configurable en `config.ts`).
- `BUFFER_MIN = 20` (env `PUBLIC_BOOKING_BUFFER_MIN`).
- `MAX_DAYS_AHEAD = 60` (env `PUBLIC_BOOKING_MAX_DAYS_AHEAD`). El calendario no permite navegar más allá.
- `TIMEZONE = 'Europe/Madrid'` (env `PUBLIC_BOOKING_TIMEZONE`). Usar `Intl.DateTimeFormat` para conversiones.

---

## 5. Contrato Google Calendar (lectura)

### 5.1. Setup que debe hacer Miguel (una vez)

**A. Compartir calendario en modo libre/ocupado:**

1. Abrir Google Calendar en navegador → engranaje (Ajustes) → Calendarios → seleccionar el calendario que se usará para reservas (puede ser "Mi calendario" o uno dedicado).
2. Sección "Permisos de acceso a eventos":
   - Marcar **"Hacer público el calendario"**.
   - En el desplegable, elegir **"Ver solo libre/ocupado (ocultar detalles)"**.
3. Sección "Integrar calendario": copiar el **"ID del calendario"** (formato `xxx@group.calendar.google.com` o `tu-email@gmail.com`).
4. Guardar.

**B. Crear API key en Google Cloud:**

1. Ir a https://console.cloud.google.com/ → crear proyecto "Voramà Booking".
2. APIs & Services → Library → buscar "Google Calendar API" → Enable.
3. APIs & Services → Credentials → Create Credentials → API key.
4. Editar la key creada:
   - **Application restrictions: HTTP referrers (web sites)**.
   - Añadir referrer: `https://magnusmcmdev.github.io/vorama-astro/*` (y el dominio final si se cambia más adelante).
   - **API restrictions: Restrict key**.
   - Marcar solo "Google Calendar API".
5. Guardar y copiar la key.

**C. Configurar quotas/alertas:**

- Google Cloud → APIs & Services → Calendar API → Quotas.
- Free tier: 1.000.000 requests/día (sobra para este proyecto).
- Activar alertas a partir de 50% y 80% de uso para detectar abuso temprano.

### 5.2. Llamada cliente

```http
POST https://www.googleapis.com/calendar/v3/freeBusy?key={PUBLIC_GCAL_API_KEY}
Content-Type: application/json

{
  "timeMin": "2026-05-10T00:00:00+02:00",
  "timeMax": "2026-06-10T00:00:00+02:00",
  "items": [{ "id": "{PUBLIC_GCAL_CALENDAR_ID}" }]
}
```

**Respuesta esperada (`200 OK`):**

```json
{
  "kind": "calendar#freeBusy",
  "timeMin": "...",
  "timeMax": "...",
  "calendars": {
    "{PUBLIC_GCAL_CALENDAR_ID}": {
      "busy": [
        { "start": "2026-05-12T10:00:00+02:00", "end": "2026-05-12T11:30:00+02:00" }
      ]
    }
  }
}
```

**Manejo de errores:**

- `403 Forbidden` (referrer inválido) → `BookingError('GCAL_DOWN', ...)`. No debería ocurrir en producción si el setup es correcto.
- `429 Too Many Requests` → reintentar 1 vez con backoff de 1 s, luego `BookingError`.
- `5xx` → reintentar 1 vez, luego `BookingError`.
- Network error / timeout 8 s → `BookingError('OFFLINE', ...)`.

### 5.3. Caché

Clave: `booking:freebusy:{YYYY-MM}:{serviceId}` en `sessionStorage`.

Valor: `{ ts: number, busy: TimeRange[] }`.

TTL: 60 s. Si stale, refetch.

Razón de cachear por mes: el `CalendarPicker` carga un mes entero a la vez; navegar dentro del mismo mes no debe disparar más calls.

---

## 6. Contrato Web3Forms (envío)

### 6.1. Setup que debe hacer Miguel (una vez)

1. Ir a https://web3forms.com/.
2. Introducir email destino (el de Miguel) → recibir Access Key por email.
3. Verificar el email.
4. Opcional: configurar autoresponder (no usado por defecto en este proyecto; toda comunicación al cliente es manual por WhatsApp).
5. Copiar la Access Key.

### 6.2. Llamada cliente

```http
POST https://api.web3forms.com/submit
Content-Type: application/json

{
  "access_key": "{PUBLIC_WEB3FORMS_KEY}",
  "subject": "[Voramà] Solicitud de reserva: Masaje Californiano 90 min — 12/05/2026 16:30",
  "from_name": "Ana García",
  "replyto": "ana@example.com",
  "botcheck": "",
  "message": "Servicio: Masaje Californiano 90 min (60€)\nFecha: martes 12 de mayo de 2026\nHora: 16:30 (Europe/Madrid)\n\nCliente:\n  Nombre: Ana García\n  Email: ana@example.com\n  Teléfono: +34 600 123 456\n\nNotas: Primera vez. Prefiero presión media.\n\nConsentimiento RGPD: aceptado.\n\n— Enviado desde voramaterapias.com"
}
```

**Respuesta esperada (`200 OK`):**

```json
{ "success": true, "message": "Email sent successfully" }
```

**Manejo de errores:**

- `botcheck` no vacío → Web3Forms descarta silenciosamente; el cliente recibe `success: false`. Tratamos como éxito en UI (no avisar al bot) pero no hacemos nada.
- `4xx` con `success: false` → `BookingError('SUBMIT_FAILED', ...)` mostrar reintentar.
- `5xx` o network → reintento 1 vez, luego `BookingError`.

---

## 7. Schemas Zod completos

```ts
// src/lib/booking/schemas.ts

import { z } from 'zod';

export const TimeRangeSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
  end:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
});

export const ServiceSchema = z.object({
  id:          z.string().regex(/^[a-z0-9-]+$/),
  name:        z.string().min(1),
  durationMin: z.number().int().positive(),
  priceEur:    z.number().int().nonnegative(),
});

export const AvailabilityRuleSchema = z.object({
  serviceId: z.string().regex(/^[a-z0-9-]+$/),
  weekly: z.record(
    z.enum(['0', '1', '2', '3', '4', '5', '6']),
    z.array(TimeRangeSchema)
  ),
});

export const CustomerSchema = z.object({
  name:        z.string().min(2, 'Indica tu nombre').max(80),
  email:       z.string().email('Email no válido'),
  phone:       z.string().min(7, 'Teléfono no válido').max(20),
  notes:       z.string().max(500).optional(),
  consentRgpd: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }) }),
});

export const BookingRequestSchema = z.object({
  serviceId:  z.string().regex(/^[a-z0-9-]+$/),
  startISO:   z.string().datetime({ offset: true }),
  customer:   CustomerSchema,
  hp_website: z.literal('', { errorMap: () => ({ message: '' }) }), // honeypot, debe quedar vacío
});
```

---

## 8. UX paso a paso

### Paso 1 — Calendario

- Cabecera: nombre del servicio + duración + precio.
- Navegación de mes: chevrons izq/der + título "mayo 2026". `PageUp/PageDown` en teclado.
- Grid 7×6, lunes-domingo. Días pasados deshabilitados. Días sin slots libres: `aria-disabled`, color atenuado.
- Día seleccionado: fondo `--vrm-color-primary-light`.
- Loading: skeleton de grid + texto sr-only "Cargando disponibilidad".
- Error: banner inline "No hemos podido cargar la disponibilidad" + botón "Reintentar".

### Paso 2 — Slots

- Bajo el calendario (desktop) o en pantalla nueva (mobile).
- Lista vertical de horas (formato HH:mm). Slots como botones grandes (≥ 44 px alto).
- Slot seleccionado: fondo `--vrm-color-primary`, texto blanco.
- "Continuar" → paso 3.

### Paso 3 — Formulario

- Campos en orden: nombre, email, teléfono, notas, checkbox RGPD.
- Validación inline con `aria-describedby`. No bloquea tipear, solo el avance.
- Honeypot `botcheck` oculto con `display:none` y `tabindex=-1`.
- "Atrás" vuelve al calendario manteniendo selección. "Continuar" → paso 4.

### Paso 4 — Resumen

- Recap: servicio + fecha + hora + datos cliente.
- Aviso: "Tras enviar, Miguel se pondrá en contacto por WhatsApp para confirmar la cita y coordinar el pago en metálico."
- "Atrás" → formulario. "Confirmar solicitud" → submit.

### Paso 5a — Éxito

- Icono check.
- Texto: "¡Solicitud recibida! Miguel te contactará por WhatsApp en breve para confirmar tu reserva."
- Botón "Cerrar".

### Paso 5b — Error

- Icono error.
- Texto según `code`:
  - `GCAL_DOWN`: "No hemos podido comprobar la disponibilidad ahora mismo. Inténtalo de nuevo o escríbenos por WhatsApp."
  - `SUBMIT_FAILED`: "No hemos podido enviar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp."
  - `OFFLINE`: "Parece que no hay conexión. Comprueba tu internet o escríbenos por WhatsApp."
  - `INVALID_SLOT`: "Ese horario ya no está disponible. Por favor, elige otro."
- Acciones: "Reintentar" + "Abrir WhatsApp" (link a `wa.me/<TELEFONO>` con texto pre-rellenado).

---

## 9. Variables de entorno

Definidas en `.env.example` (commiteado, sin valores) y configuradas como GitHub Actions secrets para inyectar en build:

```
PUBLIC_GCAL_API_KEY=
PUBLIC_GCAL_CALENDAR_ID=
PUBLIC_WEB3FORMS_KEY=
PUBLIC_BOOKING_BUFFER_MIN=20
PUBLIC_BOOKING_MAX_DAYS_AHEAD=60
PUBLIC_BOOKING_TIMEZONE=Europe/Madrid
```

`config.ts` lanza error fatal si falta cualquiera de las 3 primeras (las claves obligatorias).

---

## 10. Privacidad y RGPD

- Datos recogidos: nombre, email, teléfono, notas opcionales.
- Finalidad: gestionar la solicitud de reserva.
- Plazo: el email queda en la bandeja de Miguel; no hay almacenamiento adicional.
- Encargados de tratamiento: Google (Calendar API), Web3Forms.
- Derechos ARCO: contactar a través de email/WhatsApp publicados en `/legal/privacidad/`.
- Consent obligatorio en el formulario, con link a `/legal/privacidad/`.
- Sin cookies. Sin localStorage permanente. Solo sessionStorage para caché efímera de freebusy.

Actualizar la página `/legal/privacidad/` (colección `legal`) para reflejar:

- Que se usa Web3Forms para procesar el formulario.
- Que se consulta Google Calendar API para mostrar disponibilidad (sin enviar datos del cliente).

---

## 11. Casos límite documentados

- **Cliente intenta reservar en el pasado:** el calendario no muestra días pasados como activos. Si por algún motivo se manipula el DOM, el `availability.ts` filtra `startISO <= now` antes de devolver slots.
- **Cliente cierra el dialog a mitad:** estado se pierde (no persistente). Al reabrir, vuelve al paso 1.
- **Cliente envía dos veces seguidas:** rate-limit `sessionStorage` bloquea con mensaje "Solicitud ya enviada, espera unos segundos".
- **Slot ocupado entre el cargar y el enviar:** la siguiente refetch del calendario lo muestra ocupado. Si dos clientes envían la misma hora dentro del TTL caché, ambos reciben éxito y Miguel resuelve por WhatsApp con uno de ellos. Caso aceptado.
- **Cambio de zona horaria del navegador:** los horarios se muestran y envían en `Europe/Madrid` independientemente de la zona del navegador, pero internamente se manejan con ISO con offset explícito para evitar ambigüedad.

---

## 12. Dependencias npm

Solo se añade lo estrictamente necesario:

- `zod` (si no está ya en el proyecto). Usado para validación.

NO se añaden:

- `googleapis` (usamos `fetch` nativo).
- `@web3forms/*` (usamos `fetch` nativo).
- librerías de date (usamos `Intl.DateTimeFormat` y aritmética nativa).
- librerías de calendario UI.
