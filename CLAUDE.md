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
