# Conventions — Sistema de Reservas Voramà

> Convenciones específicas del módulo de reservas. Hereda y NO contradice las generales del proyecto (ver `docs/conventions.md`). Si hay conflicto, gana la convención general.

---

## 1. Idioma

- Todo el contenido visible para el usuario es **español de España**. No hay i18n en el MVP.
- Comentarios de código en **español** (consistencia con el resto del proyecto).
- Identificadores de código (variables, funciones, tipos): **inglés** (consistencia con el resto del proyecto).

---

## 2. Estructura de carpetas

```
src/
├── content/
│   └── booking/
│       ├── services.json
│       └── availability-rules.json
├── lib/
│   └── booking/
│       ├── types.ts
│       ├── schemas.ts
│       ├── config.ts
│       ├── availability.ts
│       ├── gcal.ts
│       └── submit.ts
└── components/
    └── booking/
        ├── BookingDialog.astro
        ├── BookingWidget.astro
        ├── booking-widget.client.ts
        ├── CalendarPicker.astro
        ├── TimeSlotList.astro
        ├── BookingForm.astro
        ├── BookingSummary.astro
        ├── BookingSuccess.astro
        └── BookingError.astro
```

- **No mezclar** archivos del módulo con `src/components/sections/` o `src/components/interactive/`. Toda la lógica/UI de booking vive bajo `*/booking/`.
- Todos los componentes booking son `.astro`. La lógica cliente reactiva vive en archivos `*.client.ts` aparte, importados con `<script>` en el componente.

---

## 3. Naming

### Archivos

- Componentes Astro: **PascalCase**. Ej: `CalendarPicker.astro`, `BookingForm.astro`.
- Módulos TS de lib: **kebab-case** o nombre corto en minúsculas. Ej: `availability.ts`, `gcal.ts`, `submit.ts`. Coincide con el patrón existente del proyecto.
- Scripts cliente acoplados a un componente: `nombre-componente.client.ts`. Ej: `booking-widget.client.ts`.
- Datos en repo: **kebab-case.json**. Ej: `services.json`, `availability-rules.json`.

### Identificadores de servicio (`Service.id`)

Patrón: `{tipo}-{duracion}` en kebab-case.

- `californiano-90`, `californiano-120`
- `cuatro-manos-60`, `cuatro-manos-90`
- `para-dos-60`, `para-dos-90`

Estos IDs son contractuales: aparecen en el código, en `services.json`, en `availability-rules.json` y en los `data-service-id` de los botones. Cambiar un ID es un breaking change.

### Tipos TS

- Entidades: PascalCase singular. `Service`, `AvailabilityRule`, `Slot`, `BookingRequest`, `Customer`, `TimeRange`.
- Tipos auxiliares: PascalCase descriptivos. `WeekdayKey` (`'0' | '1' | … | '6'`), `BookingStep` (`'calendar' | 'form' | 'summary' | 'success' | 'error'`).
- Sufijo `Schema` para Zod: `ServiceSchema`, `BookingRequestSchema`.

### CSS

- Sigue el BEM-light global con prefijo `vrm-` para clases que pueden colisionar fuera del componente.
- Componentes scoped (estilos dentro del `<style>` del `.astro`) usan clases sin prefijo: `.calendar`, `.calendar__day`, `.calendar__day--available`.
- Estados booleanos como modificadores: `--available`, `--selected`, `--disabled`, `--today`.

### Eventos personalizados

- Prefijo del proyecto `vrm:`. Eventos del módulo prefijados con `vrm:booking:`.
  - `vrm:dialog-open` (existente, se reutiliza)
  - `vrm:booking:step-change` — interno del widget
  - `vrm:booking:submit-success`
  - `vrm:booking:submit-error`

---

## 4. Schemas Zod

- Todos los schemas viven en `src/lib/booking/schemas.ts` y se exportan junto con los tipos inferidos:

  ```ts
  export const ServiceSchema = z.object({ /* … */ });
  export type Service = z.infer<typeof ServiceSchema>;
  ```

- Validación de datos en repo (`services.json`, `availability-rules.json`) se hace en `src/content.config.ts` via Content Collections con los mismos schemas reexportados.
- Validación runtime del formulario (datos del cliente) usa `BookingRequestSchema` antes de cualquier POST.
- Mensajes de error de Zod en español, definidos junto al schema con `.refine()` / `.string({ message: '…' })`.

---

## 5. Manejo de errores

Tres categorías:

1. **Validación de input** (cliente rellena mal el formulario): mensaje inline junto al campo, `aria-describedby`. No se cambia de paso.
2. **Error externo recuperable** (GCal o Web3Forms responden 5xx, timeout, sin red): mostrar `BookingError` con botón "Reintentar" + CTA secundaria a WhatsApp.
3. **Error fatal** (configuración rota, schemas inválidos en build): falla el build. No debe llegar a producción.

Estructura de errores en código:

```ts
class BookingError extends Error {
  constructor(public code: 'GCAL_DOWN' | 'SUBMIT_FAILED' | 'INVALID_SLOT' | 'OFFLINE', message: string) {
    super(message);
  }
}
```

Loguear errores en `console.error` con prefijo `[booking]` para facilitar debug en producción. Nunca enviar PII a console.

---

## 6. Caché y red

- Toda llamada a Google Calendar pasa por `gcal.ts` que aplica caché en `sessionStorage`.
- Clave de caché: `booking:freebusy:{YYYY-MM}:{serviceId}`. TTL: 60 s.
- Fetch con `signal: AbortSignal.timeout(8000)`. Cancelar al cambiar de paso o cerrar el dialog.
- Nunca hacer fetch desde un componente `.astro`; siempre desde `src/lib/booking/*`.

---

## 7. Estados del widget

```
calendar  ──pick day+time──>  form  ──submit valid──>  summary
   ▲                            │                        │
   └─── back ────────────────────                          │
                                                          ▼
                                  success  ◄── ok ──┐  submit
                                                    │
                                  error   ◄── ko ───┘
```

- Solo `calendar` y `form` son editables; `summary`, `success`, `error` son lectura.
- Volver atrás permitido desde `form` y `summary`. Desde `success` no — el dialog se cierra y vuelve a abrirse fresco.

---

## 8. Imports y aliases

- Usar el alias `~/` (configurado a `src/`) para imports cross-folder.
- Imports relativos solo dentro de la misma carpeta `booking`.
- Orden: builtins de Node → libs externas → `~/` aliases → relativos.

---

## 9. Comentarios

- Todo módulo `*.ts` empieza con un comentario de cabecera de **2-4 líneas** explicando su responsabilidad.
- Funciones públicas exportadas: JSDoc con `@param` y `@returns` cuando ayude a la legibilidad por IA.
- No comentar lo obvio. Comentar el "por qué", no el "qué".

---

## 10. Tests

- En el MVP no hay tests automatizados. La validación es manual (smoke test post-cutover, ver `migration-roadmap.md`).
- Si en el futuro se añade Vitest, tests viven junto al código: `availability.test.ts` adyacente a `availability.ts`.

---

## 11. Telemetría

- En el MVP no se instrumenta nada. No se envía analytics de los pasos del widget.
- Si se decide añadir, documentarlo aquí antes de implementarlo y respetar consent banner del sitio.

---

## 12. Excepciones

Cualquier desviación de estas convenciones debe documentarse:

1. En el archivo afectado, comentario `// CONVENTION-EXCEPTION: motivo`.
2. En este documento, en una sección "Excepciones registradas" al final.

### Excepciones registradas

(ninguna por ahora)
