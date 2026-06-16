# Plan 006: Reescribir el README, crear CLAUDE.md y corregir el inventario de componentes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- README.md docs/component-inventory.md docs/migration-roadmap.md`
> Compara con "Current state" si hubo cambios.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

El `README.md` del repo es el **starter boilerplate de Astro sin tocar** ("Astro
Starter Kit: Minimal"): describe una estructura que no es la real, no menciona
las variables de entorno, ni el sistema de reservas, ni el mapa de `docs/`. Una
documentación activamente equivocada confunde más que su ausencia. Además, este
repo lo desarrollan principalmente agentes de IA (Claude Code) y **no existe un
`CLAUDE.md`** que les diga "lee `docs/conventions.md` y `docs/project-rules.md`
antes de tocar nada" ni cuáles son los comandos de verificación — el contexto
existe en `docs/` pero nada apunta a él desde la raíz. Por último, el
`docs/component-inventory.md` referencia componentes que **ya no existen**
(`CalendlyDialog.astro`, sustituido por el sistema de reservas; `SEO.astro`, cuya
lógica está inline en `BaseLayout.astro`). Corregir estos tres documentos es alto
apalancamiento y riesgo cero (no toca código).

## Current state

- `README.md` — 44 líneas de plantilla Astro genérica. A reemplazar por completo.
- **No existe** `CLAUDE.md` en la raíz. (Sí hay uno global del usuario en `~/.claude`, irrelevante para el repo.)
- `docs/component-inventory.md` contiene afirmaciones obsoletas:
  - L19: `- **Interactive** (4): Dialog, LegalDialog, CalendlyDialog, ContactForm.`
  - L25-27: sección `## SEO.astro` con `**Path:** src/components/layout/SEO.astro.` (ese archivo NO existe; la lógica SEO está en `BaseLayout.astro:59-99`).
  - L76: `- Botón CTA "Reserva" (abre CalendlyDialog).`
  - L430: `**Usado en:** base de LegalDialog y CalendlyDialog.`
  - L470-472: sección `## CalendlyDialog.astro` con su path.
  - L571: fila de tabla `| CalendlyDialog | ⏳ pendiente B6 | |`.
- Realidad de componentes (verificada): `src/components/interactive/` = `Dialog.astro`, `LegalDialog.astro`, `ContactForm.astro`. El diálogo de reservas es `src/components/booking/BookingDialog.astro` + librería `src/lib/booking/*.ts`. No hay `SEO.astro` ni `CalendlyDialog.astro`.
- `docs/migration-roadmap.md` — describe fases B1–B9; el sistema de reservas (commits C1–C4 + fixes posteriores) ya está construido, pero el doc no lo refleja como estado actual.
- Datos para el README/CLAUDE (verificados): build con `npm run build`; type-check `npx astro check`; dev `npm run dev` (sirve en `http://localhost:4321/vorama-astro/`); `engines.node >=22.12.0`; `output: 'static'`, `base: '/vorama-astro/'`; env en `.env.example`; en DEV el widget usa freebusy mock vacío (`gcal.ts` corta si `import.meta.env.DEV`).
- Tras el plan 001, existe `npm test`; tras 003, hay 2 vars de entorno más para los formularios. Si esos planes aún no se aplicaron, NO menciones `npm test` como existente — ver Step 2.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors (la doc no afecta, es sanity) |
| Build     | `npm run build`    | exit 0 |

## Scope

**In scope**:
- `README.md` (reemplazo completo)
- `CLAUDE.md` (crear en la raíz)
- `docs/component-inventory.md` (correcciones puntuales)
- `docs/migration-roadmap.md` (añadir nota de estado)
- `plans/README.md`

**Out of scope**:
- Cualquier archivo `.ts`/`.astro`/`.css` — este plan no toca código.
- El resto de `docs/*` que ya es correcto (architecture, conventions, project-rules) — solo se actualiza su fecha de revisión si lo tocas, y no hace falta tocarlos.

## Git workflow

- Branch: `advisor/006-docs`.
- Commits en español, imperativo, ≤70 chars. Ej: `Reescribir README y añadir CLAUDE.md`.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Reescribir README.md

Reemplaza TODO el contenido de `README.md` por:

```markdown
# Voramà Terapias — Sitio web (Astro)

Sitio estático del centro de masaje californiano **Voramà Terapias**
(Barcelona): servicios, formación, regalo de sesiones, contacto y un sistema de
**reservas propio** (lee la disponibilidad de Google Calendar y envía la
solicitud por email con Web3Forms — sin backend).

- **Stack**: Astro (static) + TypeScript estricto + CSS scoped con tokens `--vrm-*`. Sin frameworks de UI.
- **Hosting**: GitHub Pages. `base: '/vorama-astro/'`, `output: 'static'`.
- **Node**: >= 22.12.0.

## Puesta en marcha

```sh
npm install
cp .env.example .env   # rellena las claves (ver más abajo)
npm run dev            # http://localhost:4321/vorama-astro/
```

En desarrollo el widget de reservas usa un mock de disponibilidad (todos los
huecos libres), porque la API key de Google está restringida al dominio de
producción.

## Comandos

| Comando             | Acción                                  |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                  |
| `npm run check`     | Type-check (`astro check`)              |
| `npm test`          | Tests (Vitest)                          |
| `npm run build`     | Build de producción a `./dist/`         |
| `npm run preview`   | Previsualiza el build                   |

> Si `npm run check` o `npm test` no existen aún en `package.json`, usa
> `npx astro check` y revisa si la suite de tests ya está instalada.

## Variables de entorno

Todas con prefijo `PUBLIC_` (acaban en el bundle; la seguridad la dan las
restricciones del proveedor, no la ocultación). Ver `.env.example` para la lista
completa y las instrucciones. En CI se configuran como **GitHub Secrets** y se
inyectan en el step Build de `.github/workflows/deploy.yml`.

## Estructura

- `src/pages/` — una página `.astro` por ruta (URLs cerradas por SEO; ver `docs/conventions.md`).
- `src/components/` — `layout/`, `sections/`, `interactive/`, `booking/`.
- `src/lib/booking/` — lógica del sistema de reservas (disponibilidad, Google Calendar, Web3Forms).
- `src/content/` — Content Collections (servicios, FAQs, reseñas, legal, booking) validadas con Zod.
- `src/styles/` — `theme.css` (tokens) + `globals.css`.
- `docs/` — documentación del proyecto (arrancar por aquí, ver abajo).

## Documentación

- `docs/architecture.md` — arquitectura general.
- `docs/conventions.md` — naming, estructura de componentes, reglas de código.
- `docs/project-rules.md` — qué se permite y qué no.
- `docs/component-inventory.md` — inventario de componentes.
- `docs/migration-roadmap.md` — fases del proyecto.
- `docs/booking/` — especificación del sistema de reservas (arquitectura, spec, setup de Google Calendar y Web3Forms).

## Despliegue

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) hace
`astro check` + build + deploy a GitHub Pages.
```

**Verify**: `grep -c "Astro Starter Kit" README.md` → 0.

### Step 2: Crear CLAUDE.md en la raíz

Crea `CLAUDE.md` con:

```markdown
# CLAUDE.md — Guía para agentes en este repo

Sitio estático de **Voramà Terapias** (Astro static + TS estricto + CSS scoped,
sin frameworks de UI). Lee esto antes de tocar nada.

## Antes de empezar

1. Lee `docs/conventions.md` (naming, estructura de componentes, idioma) y
   `docs/project-rules.md` (qué está permitido y qué no). Son normativos.
2. Código y nombres en inglés; contenido, comentarios de copy y **mensajes de
   commit en español** (imperativo, ≤70 chars).
3. CSS: siempre scoped, tokens `--vrm-*`, nada de Tailwind/SCSS, evitar `!important`.

## Verificación (ejecútalas antes de dar algo por terminado)

- `npm run check` (o `npx astro check`) → 0 errors.
- `npm test` → verde (si la suite existe; vive en `src/**/*.test.ts`).
- `npm run build` → exit 0.

## Sistema de reservas (lo más delicado)

- Vive en `src/lib/booking/*.ts` + `src/components/booking/BookingDialog.astro`.
- 100% cliente: lee Google Calendar freebusy con una API key `PUBLIC_*` y envía
  por Web3Forms. Sin backend.
- `src/lib/booking/availability.ts` genera los huecos y la fecha/hora se calcula
  en `Europe/Madrid` con offset propio. **Esta lógica ya ha tenido varias
  regresiones de zona horaria** — cualquier cambio aquí debe ir acompañado de
  tests (`availability.test.ts`).
- `config.ts` lanza en build si faltan las claves `PUBLIC_*`; en DEV el freebusy
  es un mock vacío.

## Restricciones del proyecto

- `output: 'static'`, GitHub Pages, `base: '/vorama-astro/'`. No introducir
  backend ni cambiar a hybrid sin discutirlo (ver `docs/project-rules.md`).
- Mantener las URLs actuales (continuidad SEO).
- Las páginas de prueba viven en `src/pages/_dev/` (ocultas a buscadores).
```

**Verify**: `test -f CLAUDE.md && echo OK` → `OK`.

### Step 3: Corregir docs/component-inventory.md

Aplica estas correcciones de contenido (busca el texto y sustitúyelo):

1. L19: `- **Interactive** (4): Dialog, LegalDialog, CalendlyDialog, ContactForm.`
   → `- **Interactive** (3): Dialog, LegalDialog, ContactForm.  · **Booking**: BookingDialog (`src/components/booking/`) + librería `src/lib/booking/*.ts`.`
2. Sección `## SEO.astro` (L25-27 y su cuerpo): añade al inicio de la sección la nota
   `> **Obsoleto:** no existe un `SEO.astro`. La lógica SEO está inline en `src/layouts/BaseLayout.astro` (cabecera `<head>`, props `title`/`description`/`canonical`/`ogImage`/`jsonLd`).`
   (No hace falta borrar el resto si describe bien qué hace; basta con marcar el estado real.)
3. L76: `(abre CalendlyDialog)` → `(abre BookingDialog)`.
4. L430: `base de LegalDialog y CalendlyDialog` → `base de LegalDialog y BookingDialog`.
5. Sección `## CalendlyDialog.astro` (≈L470): añade al inicio
   `> **Eliminado.** Calendly se sustituyó por el sistema de reservas propio (BookingDialog + `src/lib/booking/`). Mantenido aquí solo como referencia histórica.`
6. L571 (tabla): `| CalendlyDialog | ⏳ pendiente B6 | |` → `| BookingDialog | ✅ hecho (reemplaza Calendly) | |`.

**Verify**: `grep -c "BookingDialog" docs/component-inventory.md` → ≥3.

### Step 4: Nota de estado en migration-roadmap.md

Añade, justo después del primer encabezado/contexto de `docs/migration-roadmap.md`,
un bloque:

```markdown
> **Estado a 2026-06-13:** Fases B1–B9 completas. El sistema de reservas propio
> (sustituye a Calendly) está implementado: `src/lib/booking/*` + `BookingDialog`,
> con lectura de Google Calendar (freebusy) y envío por Web3Forms. Trabajo
> posterior: ajustes móviles, rendimiento y el cutover de dominio (pendiente).
> El detalle de fases de abajo es referencia histórica.
```

**Verify**: `grep -c "Estado a 2026-06-13" docs/migration-roadmap.md` → 1.

### Step 5: Sanity build

**Verify**: `npm run build` → exit 0 (la documentación no debe afectar; es para confirmar que no rompiste nada del repo).

## Test plan

No aplica (solo documentación). La verificación son los `grep`/`test -f` de cada
step + un build limpio.

## Done criteria

ALL must hold:

- [ ] `grep -c "Astro Starter Kit" README.md` → 0
- [ ] `README.md` menciona reservas, `.env`, y el mapa de `docs/`
- [ ] `CLAUDE.md` existe en la raíz y apunta a conventions + project-rules
- [ ] `grep -c "CalendlyDialog" docs/component-inventory.md` → solo en contexto "eliminado/histórico" (no como componente vigente en la lista de interactivos L19)
- [ ] `grep -c "Estado a 2026-06-13" docs/migration-roadmap.md` → 1
- [ ] `npm run build` exit 0
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 006 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- `docs/component-inventory.md` no contiene los textos citados (la numeración de
  líneas puede haber cambiado; busca por contenido). Si un texto no aparece en
  absoluto, reporta cuál antes de improvisar.
- Descubres que `SEO.astro` o `CalendlyDialog.astro` SÍ existen
  (`ls src/components/**/SEO.astro src/components/**/CalendlyDialog.astro`):
  entonces la doc no estaba obsoleta y NO debes marcarlos como eliminados — reporta.

## Maintenance notes

- El README dice "si `npm run check`/`npm test` no existen, usa `npx astro check`"
  para ser robusto ante el orden de ejecución de los planes. Una vez aplicados
  001 y 003, se puede simplificar esa nota.
- Mantener `CLAUDE.md` como puntero fino (no duplicar el contenido de `docs/`);
  si crece, mover detalle a `docs/` y dejar solo enlaces.
- Cuando se resuelva el dominio (plan 009), actualizar la sección "Despliegue"
  del README y el estado del roadmap.
