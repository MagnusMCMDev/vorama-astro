# Implementation Plans — Voramà Astro

Dos rondas de la skill `improve`:

- **001-009** — ronda del 2026-06-13 (commit `8675271`), *deep*. **Todos ejecutados, mergeados y en
  producción** en https://vorama.es desde el 2026-06-15.
- **010-016** — ronda del 2026-09-22 (commit `2f2eac9`): auditoría de implementación, seguridad,
  rendimiento, SEO y tecnologías + plan de actualización de versiones; revisada y ampliada el mismo día
  (plan 016, pasos nuevos en 011-015). **Todos en producción desde el 2026-09-23.**
- **017-019** — añadidos el 2026-09-23 a petición del titular: quitar su NIF y su dirección de los textos
  legales (018; el email, que el 018 también quitó, vuelve con el 019) y preguntar por la salud del cliente
  antes de confirmar la cita, con consentimiento explícito (017). El 012 se reescribió (v2) para describir ese
  formulario.

Cada executor: lee el plan entero antes de empezar, ejecuta su *drift check*, respeta sus STOP conditions
y actualiza su fila al terminar.

> **Sesión no interactiva**: no había nadie a quien preguntar qué hallazgos convertir en plan, así que se
> aplicó el criterio por defecto de la skill: los de mayor apalancamiento (011, 013, 014, 016), los pedidos
> explícitamente (010 y 015: versiones y plan de actualización) y uno de cumplimiento con impacto legal (012).
> Los descartados y los diferidos están más abajo, para no re-auditarlos.

## Ronda 2026-09 — orden de ejecución y estado

**Orden recomendado: 010 → 016 → 011 → 013 → 014 → 018 → 019 → 017 → 012 → 015.** Los planes 010-016 se
ejecutaron **en este orden** (sin 017-019, que llegaron después) sobre un clon desechable del repo, siguiendo su texto. Cada paso aplicó limpio
sobre el anterior y el resultado final fue: `npm audit` → 0 vulnerabilidades, `astro check` 0/0/0,
**23/23 tests** en el simulacro (14 existentes + 7 del widget + 2 de envío; con la ronda 2 del 016 el widget aporta 8, así que al final serán 24), build de **16 páginas** + la redirección de
`/servicios/`, y la portada pasa de 73 903 a 49 044 bytes.

| Orden | Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|-------|------|--------|-----------|----------|--------|------------|--------|
| 1 | 010 | Actualizar a Astro 7 y Vitest 5; `npm audit` a cero | P1 | S | LOW | — | DONE — **en producción** (2026-09-22): `main` = `e802f7c`, deploy en verde, verificado en vorama.es (Astro 7.3.4, widget y diálogos legales OK). Se instaló `astro@7.3.4` (parche de ese día, salida idéntica a 7.3.3) |
| 2 | 016 | Widget de reservas: reintento, foco, anuncios, mes sin huecos (+ tests DOM) | P1 | M | LOW-MED | — | DONE — **en producción** (2026-09-22): `main` = `5646d9f`, revisado en 2 rondas, CI 22/22 y deploy en verde; verificado en vorama.es (aviso de mes sin huecos, foco en "Mes siguiente", "Reintentar" vuelve a pedir la disponibilidad) |
| 3 | 011 | Páginas legales reales + enlace roto de privacidad + 404 propia | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `aa6912a`, deploy en verde (16 páginas); verificado en vorama.es (3 páginas legales 200, 404 propia con estado 404, portada 48 148 bytes con un solo `<dialog>`, enlaces de pie/contacto/widget a `/politica-de-privacidad/`) |
| 4 | 013 | Accesibilidad: contraste AA, honeypot, tarjetas, carrusel, menú, mensajes | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `c509024`, CI 22/22 y deploy en verde; Lighthouse accesibilidad **100 en las 12 páginas** (antes 92-96); verificado en vorama.es (token `#676460`, honeypot oculto, mensajes enfocables, botón de pausa, etiquetas con precio) |
| 5 | 014 | Imagen social, preload del hero, datos estructurados, sitemap, redirección `/servicios/` | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `ce3d9be`, CI 22/22 y deploy en verde; verificado en vorama.es (OG JPEG 1200×630 → 200, preload `MATCH`, horario real, sin `aggregateRating` ni `generator`, sitemap sin `lastmod`, `/servicios/` redirige). Re-scrape en el depurador de Facebook y 404 de Search Console revisados por el titular (2026-09-23) |
| 6 | 018 | Quitar el NIF y la dirección del titular de los textos legales | P1 | S | LOW | 011 | DONE — **en producción** (2026-09-23): `main` = `3e80609`; verificado en vorama.es (privacidad y aviso legal solo con nombre y teléfono, "Última actualización: 23 de septiembre de 2026"). El historial de git se reescribió ese mismo día y la web antigua `magnusmcmdev.github.io`, que también los publicaba, se borró (ver "Acciones del operador") |
| 7 | 019 | Volver a poner el email de contacto en los textos legales | P0 | S | LOW | 018 | DONE — **en producción** (2026-09-23): `main` = `66aec43`, deploy en verde; verificado en vorama.es (aviso legal y privacidad con nombre, teléfono y email como enlace `mailto:`; sin NIF ni dirección). 1ª ejecución cortada por límite de uso, repetida desde cero |
| 8 | 017 | Pregunta de salud obligatoria en la reserva, con consentimiento explícito | P1 | M | LOW-MED | 016 | DONE — **en producción** (2026-09-23), publicado junto con el 012: `main` = `a3ec6f6` (017 = `65e6501` tests, `13c56b3` arreglo), deploy en verde; textos aprobados por el titular; verificado en vorama.es (el chunk del widget lleva la pregunta, la casilla de consentimiento explícito y el aviso «revisar salud»; sin «lesión reciente»). El formulario se probó en desarrollo: en producción la agenda está bloqueada a propósito |
| 9 | 012 | Privacidad y cookies acordes a lo que hace la web (+ bug de `sessionStorage`) — **v2** | P2 | M | LOW | 011, 017, 018, 019 | DONE — **en producción** (2026-09-23): `main` = `a3ec6f6` (`0dc5c47` textos, `5c07b35` avisos, `2dd81d7` consentimiento en el email, `a3ec6f6` rate-limit + test), CI y deploy en verde; textos aprobados por el titular; verificado en vorama.es (privacidad con salud y art. 9.2.a, Web3Forms, email y sin Google Analytics; cookies sin Analytics; aviso del vídeo y de los 2 mapas). Ejecución cortada por límite de uso y reanudada; rebase sobre el 019 con un conflicto trivial |
| 10 | 015 | CI (Node 24, actions v7), Dependabot, CI de PR y documentación obsoleta | P2 | S | LOW | 010 | DONE — **en producción** (2026-09-23): `main` = `a10668e` (`4ee1c69` CI + engines, `e9da7b4` Dependabot, `a10668e` docs); deploy en verde con **Node v24.21.0**; Dependabot ejecutado (npm y actions) sin PRs: todo al día; los 3 YAML validan contra SchemaStore. Pendiente: el primer PR de Dependabot estrenará `ci.yml`; el titular activa las alertas de Dependabot del repo |
| 11 | 020 | Imagen para compartir (Open Graph) sin franjas negras | P2 | S | LOW | 014 | DONE — **en producción** (2026-09-23): `main` = `a117712`, deploy en verde; `og-default.webp` (1244×890, idéntica byte a byte a la prueba previa) como origen; verificado en vorama.es (`og:image` y `twitter:image` → `og-default.*.jpg` 1200×630, bordes con brillo 113/76, sin franjas). Pendiente del titular: "Volver a extraer" en el depurador de Facebook |
| 12 | 021 | Completar los datos del negocio para Google (`image` y `priceRange`) | P3 | S | LOW | 020 | DONE — **en producción** (2026-09-23): `main` = `cd4e1a7`, deploy en verde; verificado en vorama.es (JSON-LD `HealthAndBeautyBusiness` con `image` = `og:image` y `priceRange` = `60-130 €`, calculado de `services.json`; una sola imagen `og-default` en el build). El titular puede repetir la prueba de resultados enriquecidos |

Valores de estado: TODO | IN PROGRESS | DONE | BLOCKED (motivo en una línea) | REJECTED (racional).

`plans/016-booking-widget-a11y.patch` y `plans/017-booking-health-screening.patch` son parte de sus planes (el
arreglo probado, listo para `git apply`).

### Por qué este orden

1. **010** primero y solo: todo lo demás se construye y se prueba ya sobre Astro 7.
2. **016** antes que 011 y 017 porque los tres tocan `widget-render.ts`: el 016 aplica un parche exacto que
   necesita el archivo tal como está en `2f2eac9`; el 011 (enlace de privacidad) edita líneas que el parche
   no toca, y el parche del 017 se generó ya sobre `3e80609`.
3. **011** antes que 013/014/012: es el que más archivos toca (`BaseLayout`, `Footer`, `ContactForm`).
4. **013** y **014** tocan archivos distintos entre sí (se pueden hacer en paralelo en ramas separadas).
5. **018** y **019** en cuanto el titular los pidió: son sus datos personales publicados (018) y su decisión
   de mantener el email del negocio (019).
6. **017** antes que 012: el texto legal del 012 describe la pregunta de salud, así que el formulario tiene
   que existir antes que el texto que lo explica.
7. **012** cuando el titular pueda leer el texto legal (va después de 013 para que sus avisos nuevos hereden
   el gris con contraste corregido).
8. **015** al final: recoge CI, Dependabot y documentación con todo lo demás asentado.

### Solapes de archivos (ya resueltos por el orden)

- `widget-render.ts`: 016 (calendario, horarios, `aria-invalid`) → 011 (enlace de privacidad) → 017 (pregunta de salud, placeholder de notas).
- `submit.ts`: 017 (bloque de salud en el email) → 012 (rate-limit tolerante).
- `privacidad.md`: 018 (identidad y derechos) → 019 (email en identidad y derechos) → 012 (el resto de secciones).
- `ContactForm.astro`: 011 (enlace de privacidad) → 013 (honeypot, mensajes) → 012 (línea de consentimiento del email).
- `BaseLayout.astro`: 011 (quita los `<LegalDialog>` del `<body>`) → 014 (reescribe el `<head>`).
- `index.astro`: 014 (objeto `jsonLd` y props del layout) → 012 (aviso bajo el vídeo).
- `package.json`: 010 (versiones) → 016 (`happy-dom`) → 015 (`engines`).

## Acciones del operador (fuera del repo)

| Cuándo | Acción | Plan |
|--------|--------|------|
| Hecho (2026-09-23) | API key de Calendar: el titular quitó el referrer `magnusmcmdev.github.io`. Comprobado sin mostrar la clave: `freeBusy` → 200 desde `https://vorama.es/`, 403 `API_KEY_HTTP_REFERRER_BLOCKED` desde el dominio antiguo y sin referrer | 015 |
| Hecho (2026-09-23) | Textos de la pregunta de salud leídos y aprobados por el titular | 017 |
| Revisado por el titular (2026-09-23): no aplica | DPA de Web3Forms: **no hay que firmar nada** — su DPA (v1.0, 13-07-2026, https://web3forms.com/dpa) se acepta al usar el servicio e incluye las cláusulas contractuales tipo; basta con guardar una copia en PDF. Web3Forms conserva los envíos 3 años (borrado a petición en support@web3forms.com). (Textos de privacidad y cookies: aprobados por el titular el 2026-09-23) | 012 |
| Revisado por el titular (2026-09-23): no aplica | Borrar del correo (y del panel de Web3Forms, si lo permite) las solicitudes de más de 18 meses, sobre todo las que traen datos de salud | 017 |
| Hecho (2026-09-23) | Historial de git reescrito (NIF y dirección → `[NIF eliminado]` / `[dirección eliminada]` en las versiones antiguas de los textos legales; force push con lease; 0 objetos con datos en GitHub `main` y en la copia local; identificadores de commit actualizados en `plans/`). Pendiente del titular: pedir al soporte de GitHub que purgue los commits antiguos en caché y borrar `C:\WebSites\_copias\vorama-astro-historial-original-2026-09-23.bundle` cuando esté conforme | 018 |
| Hecho (2026-09-23) | La web antigua `magnusmcmdev.github.io` (export de WordPress) seguía publicada con el NIF y la dirección en 12 páginas: el titular **borró el repositorio** `MagnusMCMDev/magnusmcmdev.github.io`. Comprobado: todas sus páginas dan 404 sin datos; vorama.es, la redirección `magnusmcmdev.github.io/vorama-astro/` y `Certificate_Asistant` siguen funcionando. Copia local intacta en `C:\WebSites\MagnusMCMDev.github.io` | 018 |
| Tras desplegar 014 | Validar la portada en el test de resultados enriquecidos; forzar re-scrape de la vista previa en el depurador de Facebook | 014 |
| Hecho (2026-09-23) | Search Console: `sitemap-index.xml` enviado y `page-sitemap.xml` de WordPress eliminado; el sitio sirve bien el sitemap (200 `application/xml`, también a Googlebot; 15 URLs). **Informe 404: solo 2 rutas internas de WordPress** (`/wp-content/plugins/*`, `/wp-content/themes/astra/*`), no páginas: el 404 es la respuesta correcta y no se redirigen. Las páginas antiguas conservaron su URL. Sitemap leído e indexación confirmada por el titular | 014 |
| Tras mergear 015 | Deploy con Node 24 comprobado (v24.21.0). **Dependabot alerts y security updates activadas** por el titular (2026-09-23; API: 204 y `enabled: true`, 0 alertas abiertas). Pendiente: el primer PR de Dependabot con el CI en verde | 015 |
| Revisado por el titular (2026-09-23): no aplica | Si la cuenta de Gmail del calendario de reservas es también personal, usar un calendario secundario solo para citas | 015 |

## Ronda 2026-06 — estado final (histórico)

| Plan | Título | Estado |
|------|--------|--------|
| 001  | Harness Vitest + tests de `availability.ts` | DONE — en producción (14 tests) |
| 002  | Race condition del calendario + limpiar hints | DONE — en producción |
| 003  | Claves Web3Forms a entorno + doble-submit | DONE — en producción (5 secrets en GitHub Actions) |
| 004  | Borrar página dev indexable + poner al día deps | DONE — en producción |
| 005  | Cargar el widget con `import()` dinámico | DONE — en producción (~96 KB fuera del crítico) |
| 006  | README + CLAUDE.md + inventario de componentes | DONE — en producción (parte de esa doc la corrige el 015) |
| 007  | Facade de clic para los mapas de Google | DONE — en producción |
| 008  | Centralizar el teléfono en `site.ts` | DONE — en producción |
| 009  | Spike: resolver dominio + cutover | DONE — cutover hecho: `vorama.es` con DNS en dondominio y GitHub Pages (`base: '/'`) |

## Hallazgos considerados y descartados (para no re-auditarlos)

De la ronda 2026-09:

- **El calendario de reservas no ofrece huecos hasta 2027** (bloque "ocupado" continuo desde el 21-09-2026):
  **intencionado** — el titular bloquea así la agenda cuando no puede dar servicio. No es un fallo; lo que sí
  se arregla (016) es que el visitante vea un aviso en lugar de una rejilla gris muda.
- **Cabeceras de seguridad (HSTS, CSP, X-Content-Type-Options, Referrer-Policy)**: GitHub Pages **no permite
  cabeceras propias**. Se valoró el `security.csp` de Astro (CSP por `<meta>` con hashes) y se descarta por
  ahora: el sitio no carga scripts de terceros ni acepta contenido de usuario, así que el beneficio real es
  bajo, y un `<meta>` CSP mal calibrado rompe el widget de reservas. La vía correcta es cambiar de hosting
  (ver "Dirección").
- **Inyección de HTML (XSS) en el widget**: revisados todos los `innerHTML`/`set:html`. Los datos del usuario
  pasan por `esc()`; lo que no se escapa son números, literales o el teléfono reducido a dígitos. Sin hallazgos.
- **Redirecciones del dominio**: `http://` → `https://`, `www` → raíz y rutas sin barra final → con barra, todas
  con 301 (comprobado). Correcto.
- **SEO on-page**: rastreadas las 12 páginas — títulos (26-60 caracteres) y descripciones (113-147) únicos, un
  `<h1>` por página, canónicas correctas, ningún enlace interno roto ni sin barra final, `alt` en todas las
  imágenes (las decorativas con `alt` vacío), JSON-LD válido en las 5 páginas que lo llevan. Lighthouse: SEO y
  buenas prácticas **100 en las 12**. Solo se planifica lo de 014.
- **`Cache-Control: max-age=600` en todo y sin brotli**: limitación de GitHub Pages, no del repo.
- **`server-response-time` 160-200 ms** (Lighthouse): es el TTFB de la CDN de GitHub en caché fría. No accionable.
- **Convertir imágenes a AVIF / reajustar `widths`**: Lighthouse estima 31-81 KB de ahorro en 3 imágenes
  (`faqs`, `playa-spa`, `relajante-3`), pero el rendimiento ya es 99-100. Ahorro marginal; queda como residual.
- **Clave `PUBLIC_GCAL_API_KEY` visible en el cliente**: inevitable sin backend. Mitigada por las restricciones
  de referrer y de API; la restricción de referrer funciona (403 con dominios ajenos y sin referrer), salvo la
  entrada antigua de `github.io`, que se quita (acción del operador).
- **Compatibilidad con Safari antiguo**: el CSS ya exige Safari ≥ 16.5 (anidamiento nativo) desde antes de esta
  ronda; Astro 7 añade la sintaxis de rango en media queries (≥ 16.4), sin subir ese mínimo. Solo se actuaría
  (`vite.build.cssTarget`) si la analítica mostrara tráfico relevante de iOS 15.
- **Honeypot del widget de reservas y rate-limit de 60 s**: correctos. (El del *ContactForm* se arregla en el 013;
  la tolerancia del rate-limit al almacenamiento bloqueado, en el 012.)
- **`robots.txt` con `Disallow: /_dev/`**: inocuo; esa ruta no existe en producción.
- **Añadir ESLint/Prettier/Husky**: sigue sin compensar a esta escala; `astro check` + TS estricto cubren lo
  material. Reconsiderar si entra más gente al repo.

De la ronda 2026-06 (siguen vigentes):

- **Fuga de listeners al re-render del widget**: no es real (`innerHTML` destruye los nodos; los persistentes
  son a nivel `document`, creados una vez).
- **DST en `getMadridOffsetMin`**: no es bug activo; fijado por los tests 11-12. Revisar solo si se ofrecen
  franjas entre 00:00 y 03:00.
- **`Number(dataset.durationMin) || 0`**: no es bug; cae con gracia al modo hub.
- **Radios de duración "stale" en regala**: auto-sanado por el `name` compartido y la limpieza de grupos.
- **Doble-submit del widget**: ya mitigado (render síncrono + rate-limit).
- **Caché de freebusy por mes y no por servicio**: correcto por diseño.
- **Advisory `yaml` de `npm audit`**: lo resuelve el plan 010 (queda en 0 vulnerabilidades).

## Dirección (opciones para el titular, no son planes)

1. **Mover el hosting a Cloudflare Pages (o Netlify)** — es lo único que desbloquea cabeceras de seguridad
   (HSTS, CSP, XCTO), compresión brotli, `Cache-Control` largo para los assets con hash y **redirecciones 301
   de verdad**. Ya estaba anotado como alternativa en `docs/project-rules.md:76`. Coste: plataforma nueva que
   mantener y mover el DNS otra vez; el despliegue actual funciona, así que no corre prisa.
2. **Analítica sin cookies** (Cloudflare Web Analytics gratis, o Plausible/Umami) — hoy no hay **ningún** dato
   de tráfico: no se sabe cuántas visitas llegan, de dónde, cuántas abren el widget ni qué dispositivos usan
   (lo que decidiría, por ejemplo, si merece la pena dar soporte a iOS antiguos). Sin cookies no obliga a poner
   banner. Coste: un script de terceros (o el de Cloudflare si se hace el punto 1) y actualizar la política de
   cookies.
3. **Sincronizar las reseñas reales desde la API de Google Places** — hoy las reseñas son un JSON estático
   (`src/content/reviews/reviews.json`) y el "4,9 · 80 reseñas" está escrito a mano en `site.ts`, así que
   envejece solo. Con una clave de Places se pueden regenerar en cada build. Coste: la API de Places es de pago
   por consulta (poco a este volumen) y hay que respetar la atribución que exige Google.
4. **Confirmación automática de la reserva** — hoy la solicitud llega por email y el titular la pasa a mano al
   calendario; el cliente no recibe confirmación automática. Un worker pequeño (Cloudflare) podría crear el
   evento y responder al cliente. Coste: introduce backend y secretos de servidor, justo lo que
   `docs/project-rules.md` evita hoy. Solo si el volumen de reservas lo justifica.

## Residuales técnicos registrados (posibles planes futuros)

- Tests de `gcal.ts` (parseo de la respuesta de freeBusy, caché y errores) — el entorno DOM del 016 ya permite
  escribirlos.
- Extraer la validación del `ContactForm` a un módulo testeable (hoy es script inline en el `.astro`, sin
  cobertura): es el formulario con más lógica sin tests del repo.
- Eliminar el `svc as any` de `widget-state.ts` al enviar la reserva (tipos de `services.json`).
- Reajustar `widths`/`sizes` de `faqs.webp`, `playa-spa.webp` y `relajante-3.webp` (31-81 KB según Lighthouse).
- Un campo en `site.ts` para "reservas cerradas hasta …" que el widget muestre como aviso propio, si el titular
  quiere un mensaje distinto del genérico de "mes sin huecos" del 016.
- `aggregateRating` incoherente: **ya no es residual**, lo resuelve el plan 014.
