# Implementation Plans — Voramà Astro

Dos rondas de la skill `improve`:

- **001-009** — ronda del 2026-06-13 (commit `5b37c88`), *deep*. **Todos ejecutados, mergeados y en
  producción** en https://vorama.es desde el 2026-06-15.
- **010-016** — ronda del 2026-09-22 (commit `8bdbb94`): auditoría de implementación, seguridad,
  rendimiento, SEO y tecnologías + plan de actualización de versiones; revisada y ampliada el mismo día
  (plan 016, pasos nuevos en 011-015). **Pendientes de ejecutar.**

Cada executor: lee el plan entero antes de empezar, ejecuta su *drift check*, respeta sus STOP conditions
y actualiza su fila al terminar.

> **Sesión no interactiva**: no había nadie a quien preguntar qué hallazgos convertir en plan, así que se
> aplicó el criterio por defecto de la skill: los de mayor apalancamiento (011, 013, 014, 016), los pedidos
> explícitamente (010 y 015: versiones y plan de actualización) y uno de cumplimiento con impacto legal (012).
> Los descartados y los diferidos están más abajo, para no re-auditarlos.

## Ronda 2026-09 — orden de ejecución y estado

**Orden recomendado (probado): 010 → 016 → 011 → 013 → 014 → 012 → 015.** Se ejecutaron todos los planes de
código **en este orden** sobre un clon desechable del repo, siguiendo su texto. Cada paso aplicó limpio
sobre el anterior y el resultado final fue: `npm audit` → 0 vulnerabilidades, `astro check` 0/0/0,
**23/23 tests** en el simulacro (14 existentes + 7 del widget + 2 de envío; con la ronda 2 del 016 el widget aporta 8, así que al final serán 24), build de **16 páginas** + la redirección de
`/servicios/`, y la portada pasa de 73 903 a 49 044 bytes.

| Orden | Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|-------|------|--------|-----------|----------|--------|------------|--------|
| 1 | 010 | Actualizar a Astro 7 y Vitest 5; `npm audit` a cero | P1 | S | LOW | — | DONE — **en producción** (2026-09-22): `main` = `c0f1ef0`, deploy en verde, verificado en vorama.es (Astro 7.3.4, widget y diálogos legales OK). Se instaló `astro@7.3.4` (parche de ese día, salida idéntica a 7.3.3) |
| 2 | 016 | Widget de reservas: reintento, foco, anuncios, mes sin huecos (+ tests DOM) | P1 | M | LOW-MED | — | DONE — **en producción** (2026-09-22): `main` = `5eca6af`, revisado en 2 rondas, CI 22/22 y deploy en verde; verificado en vorama.es (aviso de mes sin huecos, foco en "Mes siguiente", "Reintentar" vuelve a pedir la disponibilidad) |
| 3 | 011 | Páginas legales reales + enlace roto de privacidad + 404 propia | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `2f98655`, deploy en verde (16 páginas); verificado en vorama.es (3 páginas legales 200, 404 propia con estado 404, portada 48 148 bytes con un solo `<dialog>`, enlaces de pie/contacto/widget a `/politica-de-privacidad/`) |
| 4 | 013 | Accesibilidad: contraste AA, honeypot, tarjetas, carrusel, menú, mensajes | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `8efb2fb`, CI 22/22 y deploy en verde; Lighthouse accesibilidad **100 en las 12 páginas** (antes 92-96); verificado en vorama.es (token `#676460`, honeypot oculto, mensajes enfocables, botón de pausa, etiquetas con precio) |
| 5 | 014 | Imagen social, preload del hero, datos estructurados, sitemap, redirección `/servicios/` | P1 | M | LOW | — | DONE — **en producción** (2026-09-23): `main` = `430d40e`, CI 22/22 y deploy en verde; verificado en vorama.es (OG JPEG 1200×630 → 200, preload `MATCH`, horario real, sin `aggregateRating` ni `generator`, sitemap sin `lastmod`, `/servicios/` redirige). Pendiente del titular: re-scrape en el depurador de Facebook y revisar 404 en Search Console |
| 6 | 012 | Privacidad y cookies acordes a lo que hace la web (+ bug de `sessionStorage`) | P2 | M | LOW | 011 | TODO — requiere visto bueno del titular antes del merge |
| 7 | 015 | CI (Node 24, actions v7), Dependabot, CI de PR y documentación obsoleta | P2 | S | LOW | 010 | TODO |

Valores de estado: TODO | IN PROGRESS | DONE | BLOCKED (motivo en una línea) | REJECTED (racional).

`plans/016-booking-widget-a11y.patch` es parte del plan 016 (el arreglo probado, listo para `git apply`).

### Por qué este orden

1. **010** primero y solo: todo lo demás se construye y se prueba ya sobre Astro 7.
2. **016** antes que 011 y 012 porque los tres tocan `widget-render.ts`: el 016 aplica un parche exacto que
   necesita el archivo tal como está en `8bdbb94`; el 011 (enlace de privacidad) y el 012 (campo de notas)
   editan líneas que el parche no toca y se aplican bien después.
3. **011** antes que 013/014/012: es el que más archivos toca (`BaseLayout`, `Footer`, `ContactForm`).
4. **013** y **014** tocan archivos distintos entre sí (se pueden hacer en paralelo en ramas separadas).
5. **012** cuando el titular pueda leer el texto legal (depende de 011; va después de 013 para que sus
   avisos nuevos hereden el gris con contraste corregido).
6. **015** al final: recoge CI, Dependabot y documentación con todo lo demás asentado.

### Solapes de archivos (ya resueltos por el orden)

- `widget-render.ts`: 016 (calendario, horarios, `aria-invalid`) → 011 (enlace de privacidad) → 012 (campo de notas).
- `ContactForm.astro`: 011 (enlace de privacidad) → 013 (honeypot, mensajes) → 012 (línea de consentimiento del email).
- `BaseLayout.astro`: 011 (quita los `<LegalDialog>` del `<body>`) → 014 (reescribe el `<head>`).
- `index.astro`: 014 (objeto `jsonLd` y props del layout) → 012 (aviso bajo el vídeo).
- `package.json`: 010 (versiones) → 016 (`happy-dom`) → 015 (`engines`).

## Acciones del operador (fuera del repo)

| Cuándo | Acción | Plan |
|--------|--------|------|
| Ya | Google Cloud → credenciales → API key de Calendar: quitar el referrer `magnusmcmdev.github.io` (**hoy sigue aceptado**, comprobado) y dejar solo `https://vorama.es/*` y la Calendar API | 015 |
| Antes de mergear 012 | Leer y aprobar los textos nuevos de privacidad y cookies; aceptar el DPA de Web3Forms | 012 |
| Tras desplegar 014 | Validar la portada en el test de resultados enriquecidos; forzar re-scrape de la vista previa en el depurador de Facebook | 014 |
| Tras desplegar 014 | Search Console: sitemap enviado; lista de 404 → añadir cada URL antigua a `redirects` | 014 |
| Tras mergear 015 | Comprobar el deploy en verde con Node 24 y el primer PR de Dependabot con el CI en verde | 015 |
| Cuando convenga | Si la cuenta de Gmail del calendario de reservas es también personal, usar un calendario secundario solo para citas | 015 |

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
