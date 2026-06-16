# Implementation Plans — Voramà Astro

Generados por la skill `improve` (deep) el 2026-06-13, contra el commit `5b37c88`.
Cada executor: lee el plan completo antes de empezar, respeta sus STOP conditions
y actualiza su fila al terminar.

## Orden de ejecución y estado

| Plan | Título | Prioridad | Esfuerzo | Depende de | Estado |
|------|--------|-----------|----------|------------|--------|
| 001  | Harness Vitest + tests de `availability.ts` | P1 | M | — | DONE (14 tests; en worktree sin mergear) |
| 002  | Race condition del calendario + limpiar hints | P1 | S | 001 | DONE (astro check 0/0/0; en worktree sin mergear) |
| 003  | Claves Web3Forms a entorno + doble-submit | P2 | S | — | DONE (commit 2d1e012, sin mergear; REQUIERE 2 secrets antes de desplegar) |
| 004  | Borrar página dev indexable + poner al día deps | P2 | S | — | DONE (5362fe7+dbb71be, sin mergear; devalue→5.8.1, astro→6.4.6; residual esbuild HIGH = dev-only de vitest) |
| 005  | Cargar el widget con `import()` dinámico | P3 | S | — | DONE (commit 99933ba, sin mergear; ~96 KB diferidos del crítico de cada página) |
| 006  | README + CLAUDE.md + inventario de componentes | P2 | M | — | DONE (en local main, sin pushear) |
| 007  | Facade de clic para los mapas de Google | P3 | M | — | DONE (commit en local main, sin pushear; 0 iframes estáticos) |
| 008  | Centralizar el teléfono en `site.ts` | P3 | S | 005 | DONE (en local main; incl. link residual de ContactForm). Solo quedan literales en site.ts/config.ts/legal.md (intencionales) |
| 009  | Spike: resolver dominio + cutover | P2 | M | — | LISTO PARA CUTOVER — dominio=vorama.es (raíz); ejecutar Fase B el día del cutover (DNS+Pages+referrer) |

Valores de estado: TODO | IN PROGRESS | DONE | BLOCKED (con motivo en una línea) | REJECTED (con racional).

## Recomendación de secuencia

1. **001 → 002** primero: 001 instala la red de tests y 002 corrige el bug real
   de concurrencia apoyándose en ella. Es el bloque de mayor apalancamiento
   (protege el money-path que ya falló 3 veces).
2. **006** en paralelo cuando quieras: es docs, riesgo cero, alto valor para los
   agentes que ejecuten el resto.
3. **003, 004** después: higiene de seguridad/deps, independientes entre sí.
4. **005, 007, 008**: mejoras de rendimiento/privacidad/deuda, independientes.
5. **009** al final, cuando el dominio esté decidido (su Fase A es solo pedir la
   decisión y puede hacerse ya).

## Notas de dependencia

- **002 requiere 001**: la suite de caracterización es la red de seguridad para
  refactorizar `loadAvailability` sin reintroducir una regresión de zona horaria.
- **005 y 008 tocan el mismo `catch` de `BookingDialog.astro`**: si haces ambos,
  aplica **005 antes** (vuelve el handler `async`) y luego 008 (solo cambia el
  literal del teléfono por la interpolación, sin reintroducir el import estático).
- **006** referencia `npm test`/`npm run check`: sus instrucciones contemplan que
  001/003 puedan no estar aún aplicados (incluye fallback a `npx astro check`).
- **009 Fase A** (resolver qué dominio) es bloqueante y requiere decisión humana;
  la Fase B (mecánica) solo se ejecuta con el dominio confirmado.

## Hallazgos considerados y descartados (para no re-auditarlos)

- **Fuga de event listeners al re-render del widget** (widget-state.ts): no es real.
  `container.innerHTML = …` destruye los nodos y sus listeners se recolectan; los
  únicos persistentes son a nivel `document` (uno por diálogo), creados una vez.
- **DST en `getMadridOffsetMin`**: no es bug activo. Las franjas reales empiezan a
  las 09:00/18:00 y la transición horaria ocurre de madrugada, así que el offset
  calculado a mediodía UTC es correcto incluso los días de cambio. Queda fijado
  por los tests 11–12 del plan 001 y una nota de mantenimiento (revisar solo si se
  ofrecen franjas entre 00:00–03:00).
- **`Number(dataset.durationMin) || 0` → estado corrupto**: no es bug. El `0` es
  falsy y el widget cae con gracia al modo hub.
- **Radios de duración "stale" en el formulario regala**: auto-sanado. Todos los
  radios comparten `name="duracion"` (solo uno marcable) y al cambiar de masaje se
  limpian los grupos ocultos; el grupo visible queda vacío y la validación
  `!duracion` lo caza.
- **Doble-submit del widget de reservas**: ya mitigado — el handler hace `render()`
  (deshabilita el botón) de forma síncrona antes del `await`, más el rate-limit de
  `submit.ts`. (El doble-submit del *ContactForm* sí se endurece en el plan 003.)
- **Caché de freebusy por mes y no por servicio** (gcal.ts): correcto por diseño —
  freebusy es por calendario, no por servicio; cachear por `(año, mes)` es lo
  adecuado.
- **ESLint / Prettier / Husky**: no compensa a esta escala; `astro check` + TS
  estricto cubren lo material. Reconsiderar si entra equipo humano o crece mucho.
- **Advisory `yaml` (npm audit, moderate)**: aceptado en el plan 004 — dependencia
  solo de build (`@astrojs/check`), procesa YAML del propio repo; el fix exige
  downgrade breaking. Revisar cuando upstream lo resuelva sin romper.

## Diferido / decisión de negocio (no convertido en plan)

- **`aggregateRating` en `site.ts`** declara `ratingValue: 5.0, reviewCount: 5`
  mientras `googleBusiness` dice `4.9 / 80`. Un `aggregateRating` auto-servido y
  con datos incoherentes puede acarrear penalización de Google (rich results) o
  riesgo legal. Es una **decisión del propietario** (qué reseñas/JSON-LD declarar),
  no un bug; por eso no se planifica. Recomendación: alinear con los datos reales
  de Google Business o retirar el `aggregateRating` self-serving.

## Residuales técnicos registrados (posibles planes futuros)

- Inyección de dependencias (`fetchBusy`, `submitBooking`) en `mountWidget` para
  poder testear el flujo asíncrono del widget y eliminar el `svc as any`
  (widget-state.ts:360).
- Extraer la validación del `ContactForm` a un módulo testeable (hoy es script
  inline en el `.astro`, sin cobertura).
