# Plan 012: Alinear las políticas de privacidad y de cookies con lo que la web hace de verdad

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bdbb94..HEAD -- src/content/legal src/lib/booking/widget-render.ts src/lib/booking/submit.ts src/components/sections/MapEmbed.astro src/pages/index.astro src/components/booking/BookingDialog.astro src/components/interactive/ContactForm.astro`
> Cambios esperados según el orden recomendado (010 → 016 → 011 → 013 → 014 → 018 → 019 → 017 → **012**):
> `widget-render.ts` (016, 011 y 017: formulario con la pregunta de salud), `submit.ts` (017: email con el
> bloque de salud; `checkRateLimit`/`markSubmit` siguen como en "Current state"), `ContactForm.astro` (011 y
> 013), `index.astro` (014: `jsonLd` y props del layout), `BookingDialog.astro` (017: estilos) y
> `privacidad.md`/`aviso-legal.md` (018 y 019: identidad = nombre, teléfono y email, `lastUpdated` 2026-09-23).
> Ninguno toca el bloque del vídeo, `MapEmbed.astro`, `cookies.md` ni las secciones de `privacidad.md` que
> reescribe este plan. Cualquier otro cambio: compara con "Current state" y, si no coincide, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (texto legal + dos `try/catch` con test). **El texto legal se publica a nombre del titular: no se mergea sin su visto bueno** (ver "Decisiones del titular").
- **Depends on**: 011 (páginas legales), 018 y 019 (identidad) y **017** (la pregunta de salud que este texto describe)
- **Category**: compliance / bug
- **Planned at**: commit `8bdbb94`, 2026-09-22 · **v2** en `f2e3515`, 2026-09-23 (salud con consentimiento explícito, identidad reducida)

## Why this matters

Los dos textos vienen de la web WordPress antigua (fechados 2024-11-06) y describen una web que ya no existe:

1. **Privacidad dice que los datos se comparten con "Google Analytics"** (`privacidad.md:63`). La web no
   tiene ninguna analítica (`grep -rn "gtag\|analytics" src` → nada). A la vez **omite a quién sí
   llegan los datos**: Web3Forms (reenvía los formularios; Web3Creative, India; guarda los envíos hasta 3
   años, según su política), Google (el buzón de Gmail donde llegan las solicitudes y el calendario de
   citas; además, el navegador consulta la disponibilidad directamente a la API de Google Calendar) y
   GitHub (aloja la web y registra la IP de los visitantes por seguridad, según su documentación).
   Tampoco informa de transferencias internacionales (art. 13.1.f RGPD).
2. **Dice que no se tratan datos de salud** (`privacidad.md:45`), pero la reserva sí los recoge. Por
   decisión del titular (2026-09-23: la seguridad del cliente exige saber las contraindicaciones antes de
   confirmar), el plan 017 añade una **pregunta de salud obligatoria** y, si la respuesta es "Sí", un detalle
   con **consentimiento explícito** (art. 9.2.a RGPD). La política debe declarar ese tratamiento: qué se
   pide, para qué, con qué base legal y quién lo recibe.
3. **Única base legal "el consentimiento"** (`privacidad.md:47-51`) y el principio de licitud dice que
   "se requerirá en todo momento el consentimiento" (línea 35). Las solicitudes de reserva y de vale
   regalo son medidas precontractuales a petición del interesado (art. 6.1.b), no consentimiento.
4. **"El uso del Sitio Web implicará la aceptación de la Política de Privacidad"** (línea 96): el
   consentimiento tácito por navegar no es válido (arts. 4.11 y 7 RGPD).
5. **Cookies describe cosas inexistentes**: cookies propias que "reconocen al visitante recurrente",
   cookies de estadísticas de Google Analytics y "plugins" de Facebook/Instagram/YouTube. En realidad la
   web **no instala ninguna cookie**: solo guarda 2 claves técnicas en `sessionStorage` al usar el
   calendario de reservas, y carga YouTube y Google Maps **solo si el usuario pulsa** (facades). Eso
   permite no tener banner de cookies, siempre que el usuario sepa, antes de pulsar, que se cargará un
   tercero: hoy los botones "Ver mapa" y el de reproducir no lo dicen.
6. **Bug relacionado**: `submit.ts` lee y escribe `sessionStorage` para el rate-limit **sin `try/catch`**
   (a diferencia de `gcal.ts`, que sí lo protege). Con el almacenamiento bloqueado (p. ej. Chrome o
   Firefox con "bloquear todas las cookies y datos de sitios") `checkRateLimit()` lanza un
   `SecurityError` y **la reserva no se puede enviar**. La nueva política de cookies dirá que bloquear
   el almacenamiento no impide reservar; este plan hace que sea verdad.

## Decisiones del titular (léelas antes de empezar)

El plan aplica estos valores por defecto. El operador puede cambiarlos editando este archivo antes de
ejecutarlo:

1. **Datos de salud → SÍ se piden**, con pregunta obligatoria y consentimiento explícito (plan 017,
   decidido por el titular el 2026-09-23). Este plan redacta la política para ese formulario.
2. **Plazo de conservación → 18 meses** (confirmado por el titular el 2026-09-23).
3. **Identidad → nombre, teléfono y email** (planes 018 y 019): este plan no toca esas líneas.
4. Fuera del repo (lo hace el titular, no el ejecutor): aceptar el **acuerdo de encargo de tratamiento
   (DPA) de Web3Forms** (su política dice que lo ofrece) y revisar si su panel permite borrar envíos antiguos.
   Con datos de salud pasando por Web3Forms, el DPA deja de ser opcional.

## Current state

**Plan probado (v1)**: los Steps 3-6 se aplicaron en un clon del repo (sobre 010, 016, 011, 013 y 014),
tomando los bloques de código **de este mismo archivo**: `astro check` 0/0/0, los 2 tests nuevos de
`submit.test.ts` (el de `sessionStorage` bloqueado en rojo antes del arreglo), build de 16 páginas y todas
las comprobaciones de los Steps en verde. La v2 solo cambia textos de los Steps 3b-3g, quita el antiguo
Step 2 y añade `health: 'no'` al test; los recuentos parten de los 29 tests que deja el 017.

- `src/content/legal/privacidad.md` (101 líneas). Secciones `###` en este orden: Leyes (10-17), Identidad
  del responsable (19-25), Registro de Datos (27-29), Principios (31-41), Categorías (43-45), Base legal
  (47-51), Fines (53-55), Retención (57-59), Destinatarios (61-63), Menores (65-67), Secreto y seguridad
  (69-71), Derechos (73-88), Reclamaciones (90-92); luego `## II. ACEPTACIÓN…` (94-98) y la línea final
  100 (`*Este documento de Política de Privacidad fue creado el día 06/11/2024.*`).
  - **Identidad y derechos**: tras los planes 018 y 019, la sección de identidad tiene el nombre, el teléfono
    y el email del titular, y el párrafo de derechos remite al formulario de contacto, al email y al
    teléfono/WhatsApp. **No los toques.** Los números de línea de este bloque son los de `8bdbb94`: guíate siempre por los encabezados.
  - Línea 16: `- El Real Decreto 1720/2007, de 21 de diciembre, por el que se aprueba el Reglamento de desarrollo de la Ley Orgánica 15/1999, … (RDLOPD).`
  - Líneas 27-29:

    ```md
    ### Registro de Datos de Carácter Personal

    En cumplimiento de lo establecido en el RGPD y la LOPD-GDD, le informamos que los datos personales recabados por Voramà Terapias, mediante los formularios extendidos en sus páginas quedarán incorporados y serán tratados en nuestro fichero con el fin de poder facilitar, agilizar y cumplir los compromisos establecidos entre Voramà Terapias y el Usuario o el mantenimiento de la relación que se establezca en los formularios que este rellene, o para atender una solicitud o consulta del mismo.
    ```
  - Línea 35: `- **Principio de licitud, lealtad y transparencia:** se requerirá en todo momento el consentimiento del Usuario previa información completamente transparente de los fines para los cuales se recogen los datos personales.`
  - Línea 45: `Las categorías de datos que se tratan en Voramà Terapias son únicamente datos identificativos. En ningún caso, se tratan categorías especiales de datos personales en el sentido del artículo 9 del RGPD.`
  - Líneas 49-51: `La base legal para el tratamiento de los datos personales es el consentimiento. …` + `El Usuario tendrá derecho a retirar su consentimiento en cualquier momento. …`
  - Línea 59: `Los datos personales solo serán retenidos durante el tiempo mínimo necesario … **18 meses**, o hasta que el Usuario solicite su supresión.`
  - Línea 63: `Los datos personales del Usuario serán compartidos con los siguientes destinatarios: **Google Analytics**.`
  - Línea 96: `Es necesario que el Usuario haya leído y esté conforme con las condiciones … El uso del Sitio Web implicará la aceptación de la Política de Privacidad del mismo.`
- `src/content/legal/cookies.md` (39 líneas): secciones "Cookies propias", "Cookies de terceros"
  (Google Analytics), "Cookies de redes sociales" (Facebook, Instagram, YouTube) y "Deshabilitar…". Se
  reescribe entero.
- Front matter: `cookies.md` tiene `lastUpdated: "2024-11-06"`; `privacidad.md`, `"2026-09-23"` (lo cambió el
  plan 018). Schema: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.
  Tras el plan 011, `LegalContent.astro` pinta "Última actualización: …" a partir de este campo.
- Formularios reales (lo que la política debe describir):
  - `ContactForm.astro` variante `contacto`: nombre, apellidos, email, teléfono, comentario, casilla de privacidad.
  - `ContactForm.astro` variante `regala`: lo mismo + masaje a regalar, duración y "Mensaje para el destinatario (opcional)".
  - Widget de reservas (tras el 017): nombre, email, teléfono, **pregunta de salud obligatoria (No/Sí)**; con
    "Sí", detalle (máx. 500) y casilla de consentimiento explícito; notas opcionales de preferencias; casilla
    de privacidad. El email incluye `Salud: …` y `Consentimiento RGPD: aceptado.`.
- Almacenamiento: `gcal.ts:27-29` clave `booking:freebusy:${year}-${MM}` (caché de 60 s, `FREEBUSY_CACHE_TTL_MS`), protegida con `try/catch`; `submit.ts:13` clave `booking:last-submit`.
- `src/lib/booking/submit.ts:13-25`:

```ts
const RATE_KEY = 'booking:last-submit';
const RATE_WINDOW_MS = 60_000; // 1 minuto

function checkRateLimit(): void {
  const last = sessionStorage.getItem(RATE_KEY);
  if (last && Date.now() - Number(last) < RATE_WINDOW_MS) {
    throw new Error('RATE_LIMIT');
  }
}

function markSubmit(): void {
  sessionStorage.setItem(RATE_KEY, String(Date.now()));
}
```

  `checkRateLimit()` se llama **antes** del `try` de `submitBooking` (su excepción sale tal cual) y
  `markSubmit()` **dentro** del `try`, después de un envío correcto (si lanzara, el `catch` lo convertiría
  en `SUBMIT_FAILED` aunque la reserva ya se hubiera enviado).
- Facades de terceros:
  - `src/components/sections/MapEmbed.astro:14-21` — botón con `<span class="map-embed__label">Ver mapa</span>`
    y `<span class="map-embed__hint">{title}</span>`; estilo `.map-embed__hint` en líneas 61-64
    (`font-size: var(--vrm-font-size-sm); color: var(--vrm-color-text-muted);`). Se usa 2 veces en `/contacto/`.
  - `src/pages/index.astro:93-113` — `<div class="video-wrap">` con un `<button class="video" data-video-id=…>`;
    al pulsar se crea un iframe de `https://www.youtube-nocookie.com/embed/…` (línea 641). `index.astro:17`
    ya define `const base = import.meta.env.BASE_URL;`. `.video-wrap` está en las líneas 327-330.
- Tests: `vitest.config.ts` usa `environment: 'node'` y `setupFiles: ['./src/lib/booking/test-setup.ts']`
  (fija las variables `PUBLIC_*` con `vi.stubEnv`, así que `config.ts` se puede importar en tests). Patrón
  de test: `src/lib/booking/availability.test.ts` (`import { describe, it, expect } from 'vitest';`,
  descripciones en español).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | 31 passed (29 con el 017 aplicado + 2 nuevos) |
| Build | `npm run build` | `Complete!` (16 páginas si el 011 está aplicado) |

`npm run build` necesita `.env`: en un worktree nuevo crea uno con las 5 claves `PUBLIC_GCAL_API_KEY`,
`PUBLIC_GCAL_CALENDAR_ID`, `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_WEB3FORMS_KEY_CONTACTO`,
`PUBLIC_WEB3FORMS_KEY_REGALA` con valor `dummy`. Está en `.gitignore`: **nunca lo commitees**.

## Scope

**In scope**:
- `src/content/legal/privacidad.md` (solo las secciones indicadas)
- `src/content/legal/cookies.md` (reescritura completa)
- `src/components/interactive/ContactForm.astro` (solo el array `lines` del email, Step 5b)
- `src/lib/booking/submit.ts` (solo `checkRateLimit` y `markSubmit`)
- `src/lib/booking/submit.test.ts` (crear)
- `src/components/sections/MapEmbed.astro` (una línea de aviso + su estilo)
- `src/pages/index.astro` (una línea de aviso bajo el vídeo + su estilo)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- `src/content/legal/aviso-legal.md` — ya lo ajustó el plan 018.
- La sección de identidad y el párrafo de derechos de `privacidad.md` (plan 018).
- El formulario de reserva (`widget-render.ts`, `widget-state.ts`, `BookingDialog.astro`): lo cambia el plan 017.
- Secciones de privacidad no listadas en el Step 3 (Fines, Menores, Seguridad, Derechos, Reclamaciones).
- `src/lib/booking/gcal.ts` (ya protege su acceso a `sessionStorage`), `availability.ts` y el resto del widget.
- Añadir un banner de cookies: no hace falta (la web no instala cookies) y no forma parte de este plan.
- `--vrm-color-text-muted` (lo cambia el plan 013).

## Git workflow

- Branch: `advisor/012-privacy-cookies`.
- Commits: (1) texto legal; (2) avisos de YouTube/Maps; (3) consentimiento en el email del formulario de
  contacto; (4) rate-limit tolerante + test. Español, imperativo, ≤70 caracteres. Ejemplo: `Tolerar sessionStorage bloqueado al enviar reservas`.
- NO hagas push ni abras PR: el titular debe leer el texto antes del merge.

## Steps

### Step 1: Línea base y dependencia

`npm ci`, `.env` ficticio, `npm test`, `npm run build`.

**Verify**: `test -f src/pages/politica-de-cookies/index.astro && test -f src/components/sections/LegalContent.astro && echo OK` → `OK` (si no, el plan 011 no está aplicado: STOP) · `grep -c 'name="healthConsent"' src/lib/booking/widget-render.ts` → `1` (si no, el plan 017 no está aplicado: STOP) · `npm test` → `29 passed`.

### Step 2: (sin cambios en el formulario)

La pregunta de salud y el nuevo placeholder de notas los añade el plan 017. Este plan no toca el widget.

**Verify**: `grep -c "lesión reciente" src/lib/booking/widget-render.ts` → `0` (lo quitó el 017).

### Step 3: Corregir `privacidad.md`

Haz estas ediciones usando los encabezados como ancla (no por número de línea: las líneas cambian al editar):

**3a.** En "### Leyes que incorpora esta política de privacidad", borra la viñeta que empieza por `- El Real Decreto 1720/2007`.

**3b.** Sustituye la sección `### Registro de Datos de Carácter Personal` (encabezado + su párrafo) por:

```md
### Qué datos tratamos y para qué

Voramà Terapias solo trata los datos personales que el Usuario facilita voluntariamente en los formularios del Sitio Web:

- **Formulario de contacto:** nombre, apellidos, email, teléfono y el comentario o la pregunta. Se usan para responder a la consulta.
- **Solicitud de vale regalo:** los mismos datos, el masaje y la duración elegidos y, si lo escribe, un mensaje para la persona que recibirá el regalo. Se usan para gestionar la compra y el envío del vale.
- **Solicitud de reserva:** nombre, email, teléfono, el servicio, la fecha y la hora elegidos, la respuesta a si tiene alguna lesión, dolencia, embarazo u otro problema de salud y, si responde que sí, la descripción que él mismo haga; y, si las añade, notas para preparar la sesión. Se usan para confirmar y gestionar la cita y para valorar, antes de confirmarla, si el masaje es adecuado o está contraindicado.

El Sitio Web no utiliza herramientas de analítica ni de publicidad y no elabora perfiles de sus visitantes.
```

**3c.** En "### Principios aplicables…", sustituye la viñeta que empieza por `- **Principio de licitud, lealtad y transparencia:**` por:

```md
- **Principio de licitud, lealtad y transparencia:** los datos personales se tratarán de forma lícita, leal y transparente, informando al Usuario de los fines para los que se recogen.
```

**3d.** Sustituye el párrafo de `### Categorías de datos personales` por:

```md
Se tratan datos identificativos y de contacto (nombre, apellidos, email y teléfono) y los detalles de cada solicitud (servicio, fecha y hora, comentarios).

En la solicitud de reserva se pregunta, además, si el Usuario tiene alguna lesión, dolencia, embarazo u otro problema de salud. Si responde que sí, se tratan los datos de salud que él mismo describa, que son una categoría especial de datos (artículo 9 del RGPD). Se usan únicamente para valorar si el masaje es adecuado o está contraindicado y, en su caso, para desaconsejar o adaptar la sesión.
```

**3e.** Sustituye los dos párrafos de `### Base legal para el tratamiento de los datos personales` por:

```md
- **Solicitudes de reserva y de vale regalo:** la aplicación, a petición del Usuario, de medidas precontractuales y, en su caso, la ejecución del contrato de prestación del servicio (artículo 6.1.b del RGPD).
- **Formulario de contacto:** el consentimiento del Usuario (artículo 6.1.a del RGPD), que presta al marcar la casilla de aceptación antes de enviarlo.
- **Datos de salud de la solicitud de reserva:** el consentimiento explícito del Usuario (artículo 9.2.a del RGPD), que presta marcando la casilla específica que aparece cuando indica que tiene un problema de salud. Sin ese consentimiento no se puede enviar la descripción.

El Usuario puede retirar su consentimiento en cualquier momento a través del formulario de contacto, por email o por teléfono o WhatsApp, sin que ello afecte a la licitud del tratamiento anterior a la retirada.
```

**3f.** Sustituye el párrafo de `### Períodos de retención de los datos personales` por:

```md
Los datos de cada solicitud, incluidos los de salud, se conservan como máximo **18 meses** desde el último contacto, o hasta que el Usuario solicite su supresión, salvo que una obligación legal exija conservarlos más tiempo (por ejemplo, las facturas de los servicios contratados). Web3Forms, el proveedor que transmite los formularios, conserva además una copia de los envíos según su propia política de privacidad.
```

**3g.** Sustituye la sección `### Destinatarios de los datos personales` (encabezado + párrafo) por:

```md
### Destinatarios de los datos personales

No se ceden datos a terceros, salvo obligación legal. Para prestar el servicio intervienen estos proveedores, que acceden a los datos solo en la medida necesaria:

- **Web3Forms** (Web3Creative, India): transmite el contenido de los formularios, incluidos, en su caso, los datos de salud de la solicitud de reserva, al correo electrónico de Voramà Terapias.
- **Google** (Google Ireland Ltd. y Google LLC): proveedor del correo electrónico en el que se reciben las solicitudes y del calendario con el que se gestionan las citas. Al abrir el calendario de reservas, el navegador del Usuario consulta la disponibilidad directamente a Google, que recibe su dirección IP.
- **GitHub** (GitHub, Inc.): aloja el Sitio Web y registra la dirección IP de los visitantes por motivos de seguridad.

### Transferencias internacionales de datos

Algunos de estos proveedores tratan datos fuera del Espacio Económico Europeo. Google y GitHub están adheridos al Marco de Privacidad de Datos UE-EE. UU., que cuenta con una decisión de adecuación de la Comisión Europea. Web3Forms ampara sus transferencias en las cláusulas contractuales tipo aprobadas por la Comisión Europea.
```

**3h.** En `## II. ACEPTACIÓN Y CAMBIOS EN ESTA POLÍTICA DE PRIVACIDAD`, sustituye el primer párrafo (el que empieza por `Es necesario que el Usuario haya leído`) por:

```md
Antes de enviar cualquier formulario, el Usuario debe leer esta Política de Privacidad y aceptarla marcando la casilla correspondiente.
```

**3i.** Borra la última línea (`*Este documento de Política de Privacidad fue creado el día 06/11/2024.*`): la página ya muestra la fecha del front matter.

**3j.** En el front matter, pon en `lastUpdated` la fecha de hoy en formato `"YYYY-MM-DD"` (hoy vale `"2026-09-23"`, del plan 018: si ejecutas el plan ese mismo día, déjalo igual).

**Verify**:
- `grep -c "Google Analytics\|1720/2007\|implicará la aceptación\|creado el día" src/content/legal/privacidad.md` → `0`
- `grep -c "Web3Forms\|GitHub\|Transferencias internacionales\|6.1.b" src/content/legal/privacidad.md` → `≥4`
- `grep -c "9.2.a" src/content/legal/privacidad.md` → `1` · `grep -c "problema de salud" src/content/legal/privacidad.md` → `≥2`
- `git diff src/content/legal/privacidad.md | grep "^[-+]" | grep -c "623 941 891"` → `0` (no has tocado la identidad ni los derechos)

### Step 4: Reescribir `cookies.md`

Sustituye **todo** el archivo por lo siguiente (con la fecha de hoy en `lastUpdated`). Sin tablas: el
procesador Markdown y los estilos `.legal-content` no las contemplan.

```md
---
title: Política de Cookies
lastUpdated: "YYYY-MM-DD"
---

Esta Política de Cookies explica qué información se guarda en el dispositivo del Usuario cuando visita el Sitio Web de Voramà Terapias.

## Este sitio no usa cookies de análisis ni de publicidad

Voramà Terapias no instala cookies propias ni utiliza herramientas de analítica, publicidad o seguimiento. Navegar por el Sitio Web no deja cookies en su dispositivo.

## Almacenamiento técnico del sistema de reservas

Cuando el Usuario usa el calendario de reservas, el Sitio Web guarda dos datos técnicos en el almacenamiento de sesión del navegador (*sessionStorage*), que se borra automáticamente al cerrar la pestaña:

- **`booking:freebusy:AAAA-MM`**: guarda la disponibilidad del mes consultado para no repetir la consulta al calendario. Caduca a los 60 segundos.
- **`booking:last-submit`**: guarda la hora del último envío para evitar solicitudes de reserva duplicadas.

Estos datos no identifican al Usuario, no se envían a ningún servidor y son necesarios para el servicio de reservas que el propio Usuario solicita, por lo que están exentos de consentimiento (artículo 22.2 de la LSSI-CE).

## Contenidos de terceros que solo se cargan si el Usuario lo pide

- **Vídeo de YouTube (página de inicio):** no se carga hasta que el Usuario pulsa reproducir. Se usa el modo de privacidad mejorada de YouTube (youtube-nocookie.com), pero al reproducirlo Google puede guardar información en el dispositivo. Más información en la [Política de privacidad de Google](https://policies.google.com/privacy).
- **Mapas de Google Maps (página de contacto):** no se cargan hasta que el Usuario pulsa «Ver mapa». Al cargarlos, Google puede instalar sus propias cookies. Más información en [Cómo utiliza Google las cookies](https://policies.google.com/technologies/cookies).

## Enlaces a redes sociales

Los enlaces a Instagram, Facebook y WhatsApp son enlaces normales: no se carga nada de esas redes hasta que el Usuario hace clic, y a partir de ese momento se aplican sus propias políticas.

## Cómo borrar o bloquear el almacenamiento

El Usuario puede borrar o bloquear las cookies y el almacenamiento del Sitio Web desde la configuración de su navegador. Si bloquea el almacenamiento de sesión, el calendario de reservas seguirá funcionando, aunque consultará la disponibilidad cada vez.
```

**Verify**: `grep -c "Analytics\|Facebook:" src/content/legal/cookies.md` → `0` · `grep -c "booking:last-submit" src/content/legal/cookies.md` → `1` · `npm run build` → sin errores de schema de la colección `legal`.

### Step 5: Avisar antes de cargar YouTube y Google Maps

1. `MapEmbed.astro`: dentro del `<button>`, justo después de `<span class="map-embed__hint">{title}</span>`, añade:

```astro
    <span class="map-embed__note">Se cargará Google Maps, que puede usar cookies</span>
```

   y en el `<style>`, después de la regla `.map-embed__hint`:

```css
  .map-embed__note {
    font-size: var(--vrm-font-size-xs);
    color: var(--vrm-color-text-muted);
  }
```

2. `index.astro`: dentro de `<div class="video-wrap">`, justo después del `</button>` del vídeo, añade:

```astro
      <p class="video-note">
        El vídeo se carga desde YouTube (modo de privacidad mejorada) solo al pulsar reproducir.
        <a href={`${base}politica-de-cookies/`}>Más información</a>.
      </p>
```

   y en el `<style>` de la página, después de la regla `.video-wrap`:

```css
  .video-note {
    margin-top: var(--vrm-space-sm);
    font-size: var(--vrm-font-size-xs);
    color: var(--vrm-color-text-muted);
    text-align: center;
  }
```

**Verify**: `npm run build` → OK · `grep -o '<p class="video-note"' dist/index.html | wc -l` → `1` · `grep -o '<span class="map-embed__note"' dist/contacto/index.html | wc -l` → `2`.

### Step 5b: Dejar constancia del consentimiento en el email del formulario de contacto

El email de las reservas ya termina con `Consentimiento RGPD: aceptado.` (`submit.ts:50`); el del
formulario de contacto y vale regalo no, y para el formulario de contacto la base legal es precisamente
el consentimiento (art. 7.1 RGPD: hay que poder demostrarlo). En el `<script>` de `ContactForm.astro`,
en el array `lines`, añade una línea al final:

```ts
      const lines = [
        `Nombre: ${nombre} ${apellidos}`,
        `Email: ${email}`,
        telefono ? `Teléfono: ${telefono}` : null,
        masaje   ? `Masaje: ${masaje}` : null,
        duracion ? `Duración: ${duracion}` : null,
        mensaje  ? `\nMensaje:\n${mensaje}` : null,
        '\nConsentimiento RGPD: aceptado.',
      ].filter(Boolean).join('\n');
```

(Solo se añade la última entrada del array; el resto queda igual.)

**Verify**: `grep -c "Consentimiento RGPD: aceptado." src/components/interactive/ContactForm.astro` → `1` · `npm run check` → 0 errors.

### Step 6: Rate-limit tolerante a `sessionStorage` bloqueado (con test primero)

1. Crea `src/lib/booking/submit.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitBooking } from './submit.ts';
import type { BookingRequest, Service } from './types.ts';

const service: Service = {
  id: 'californiano-90', name: 'Masaje californiano', durationMin: 90, priceEur: 60,
};

const request: BookingRequest = {
  serviceId: 'californiano-90',
  startISO: '2026-10-05T18:00:00+02:00',
  customer: { name: 'Ana Prueba', email: 'ana@example.com', phone: '600000000', health: 'no', consentRgpd: true },
  hp_website: '',
};

function okFetch() {
  return vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitBooking — almacenamiento de sesión', () => {
  it('envía la reserva aunque el navegador bloquee sessionStorage', async () => {
    const blocked = {
      getItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
      setItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
    };
    const fetchMock = okFetch();
    vi.stubGlobal('sessionStorage', blocked);
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitBooking(request, service)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mantiene el rate-limit de 1 minuto cuando sessionStorage funciona', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    vi.stubGlobal('fetch', okFetch());

    await submitBooking(request, service);
    await expect(submitBooking(request, service)).rejects.toThrow('RATE_LIMIT');
  });
});
```

   (Se usa `vi.stubGlobal` en ambos casos para que el resultado no dependa de si la versión de Node trae
   `sessionStorage` nativo. `health: 'no'` es obligatorio desde el plan 017: sin él, el primer test fallaría
   por la validación y no por `sessionStorage`.)

**Verify**: `npm test` → el test "envía la reserva aunque el navegador bloquee sessionStorage" **falla**
(con `SecurityError`) y el de rate-limit pasa. Si el primero ya pasa antes del arreglo: STOP.

2. En `submit.ts`, sustituye `checkRateLimit` y `markSubmit` por:

```ts
function checkRateLimit(): void {
  let last: string | null = null;
  try {
    last = sessionStorage.getItem(RATE_KEY);
  } catch {
    // Almacenamiento bloqueado o no disponible: el rate-limit es una ayuda, no debe impedir reservar.
  }
  if (last && Date.now() - Number(last) < RATE_WINDOW_MS) {
    throw new Error('RATE_LIMIT');
  }
}

function markSubmit(): void {
  try {
    sessionStorage.setItem(RATE_KEY, String(Date.now()));
  } catch {
    // La reserva ya se ha enviado: no convertir un fallo de almacenamiento en error.
  }
}
```

**Verify**: `npm test` → `31 passed` · `npm run check` → 0 errors.

### Step 7: Verificación final

**Verify**: `npm run check` → 0 errors · `npm test` → 31 passed · `npm run build` → OK ·
`grep -c "Web3Forms" dist/politica-de-privacidad/index.html` → `≥1` ·
`grep -c "Analytics" dist/politica-de-cookies/index.html` → `0`.

## Test plan

- Nuevo: `src/lib/booking/submit.test.ts` (2 tests; ver Step 6). Sigue el estilo de `availability.test.ts`.
- Manual (`npm run preview`): en `/contacto/` ver el aviso en los botones de mapa; en la portada, el aviso
  bajo el vídeo con enlace a `/politica-de-cookies/`; leer las dos páginas legales completas y comprobar que
  lo que dicen de la reserva coincide con el formulario (pregunta de salud, casilla de consentimiento).

## Done criteria

- [ ] `grep -rn "Google Analytics" src/content/legal/` → sin resultados
- [ ] La política declara la pregunta de salud y su base legal (consentimiento explícito, art. 9.2.a)
- [ ] `lastUpdated` de `privacidad.md` y `cookies.md` = fecha de ejecución; `aviso-legal.md` sin cambios
- [ ] La sección de identidad y el párrafo de derechos de `privacidad.md` (plan 018) no aparecen en el diff
- [ ] `npm test` → 31 passed · `npm run check` → 0 errors · `npm run build` OK
- [ ] El email del formulario de contacto incluye `Consentimiento RGPD: aceptado.`
- [ ] `git status` sin cambios fuera del Scope (y sin `.env`)
- [ ] Fila 012 de `plans/README.md` actualizada, con la nota "pendiente de visto bueno del titular"

## STOP conditions

Para y reporta si:

- El plan 011 no está aplicado (Step 1).
- La casilla de privacidad del widget (`widget-render.ts`, busca `name="consentRgpd"`) ya no enlaza a
  `/politica-de-privacidad/`.
- El test de `sessionStorage` bloqueado pasa **antes** del arreglo (el código habrá cambiado).
- El build falla al validar el front matter de la colección `legal`.
- Encuentras en el código alguna analítica, píxel o cookie que este plan no menciona (la política
  debe describirla: repórtalo en lugar de redactar texto nuevo).

## Maintenance notes

- **Cualquier servicio de terceros nuevo** (analítica, chat, embeds, otro proveedor de formularios)
  obliga a actualizar estas dos páginas, y si instala cookies no exentas, a poner un banner de consentimiento.
- La política describe la pregunta de salud del plan 017: si cambia el formulario (por ejemplo, se deja de
  pedir el detalle o se pide por WhatsApp), hay que actualizar las secciones de categorías, base legal y
  destinatarios.
- Web3Forms conserva los envíos (hasta 3 años según su política de 2026): si cambia de política o de
  proveedor, revisar la sección de retención y la de transferencias.
- Revisor: leer el diff de los `.md` completo; el titular debe aprobar el texto antes del merge.
