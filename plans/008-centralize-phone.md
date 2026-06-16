# Plan 008: Centralizar el número de teléfono / WhatsApp en site.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/config/site.ts src/pages/contacto/index.astro src/pages/aprende-masaje-californiano/index.astro src/components/booking/BookingDialog.astro`
> Compara con "Current state" si hubo cambios.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 005 toca el mismo `catch` de BookingDialog — si 005 ya se aplicó, respeta su forma (ver Step 4).
- **Category**: tech-debt
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

El teléfono del negocio (`623941891`, en variantes `+34 623 94 18 91`,
`34623941891`, `tel:+34623941891`) está repetido en al menos 8 archivos. Ya
existe una fuente única declarada para esto — `src/config/site.ts` con
`SITE_CONFIG.telephone` y `SITE_CONFIG.whatsapp` — pero la mayoría de los enlaces
no la usan. Si el número cambia (o si se descubre que estaba mal en una página),
hay que cazarlo en N sitios y es fácil dejar uno desincronizado. Este plan hace
que las páginas y componentes lean el número de `site.ts`, dejando una sola
fuente que editar.

Alcance honesto: el contenido legal (`.md`) y el default de entorno del
subsistema de reservas (`config.ts`) se dejan como están a propósito (ver notas);
centralizar TODO acoplaría módulos sin ganancia real.

## Current state

- `src/config/site.ts:14-49` — fuente canónica (ya marcada como "Single source of truth"):

```ts
export const SITE_CONFIG = {
  ...
  telephone: '+34 623 94 18 91',
  whatsapp: 'https://wa.me/34623941891',
  ...
} as const;
```

- Literales hardcodeados a sustituir (verificados con grep):
  - `src/pages/contacto/index.astro:30` → `description="+34 623 94 18 91"` (IconBox)
  - `src/pages/contacto/index.astro:31` → `href="https://api.whatsapp.com/send?phone=+34623941891&text=Quiero%20m%C3%A1s%20informaci%C3%B3n"`
  - `src/pages/contacto/index.astro:61` → `<a href="tel:+34623941891">623 941 891</a>`
  - `src/pages/aprende-masaje-californiano/index.astro:29` → `href="https://wa.me/34623941891?text=Hola,%20quiero%20m%C3%A1s%20info%20sobre%20las%20formaciones%20de%20masaje%20californiano"`
  - `src/components/booking/BookingDialog.astro:432` → `const wa = 'https://wa.me/34623941891?text=' + encodeURIComponent('Hola, quiero reservar una sesión de masaje');`
  - `src/pages/_dev/components.astro:147` → IconBox de WhatsApp (página dev; opcional)

- Literales que se DEJAN (no in-scope para sustituir):
  - `src/lib/booking/config.ts:53` → `WHATSAPP_NUMBER = optionalEnvStr('PUBLIC_BOOKING_WHATSAPP', '+34623941891')` — es el default override-able por entorno del subsistema de reservas.
  - `src/content/legal/aviso-legal.md:13` y `src/content/legal/privacidad.md:24` — contenido legal revisado.

- `site.ts` es un módulo de constantes TS sin dependencias server-only; se puede
  importar tanto en frontmatter `.astro` como en `<script>` cliente sin coste
  relevante (objeto pequeño).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors |
| Build     | `npm run build`    | exit 0 |

## Scope

**In scope**:
- `src/config/site.ts` (añadir `whatsappDigits`)
- `src/pages/contacto/index.astro`
- `src/pages/aprende-masaje-californiano/index.astro`
- `src/components/booking/BookingDialog.astro` (solo el literal del `catch`)
- `src/pages/_dev/components.astro` (opcional, dev)
- `plans/README.md`

**Out of scope**:
- `src/lib/booking/config.ts`, `src/content/legal/*.md` — ver "Current state".
- La lógica del widget / cualquier otra cosa de `src/lib/booking/`.

## Git workflow

- Branch: `advisor/008-centralize-phone`.
- Commit en español, imperativo, ≤70 chars. Ej: `Leer el teléfono de site.ts en páginas y diálogo`.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Añadir whatsappDigits a site.ts

En `SITE_CONFIG` (site.ts), junto a `whatsapp`, añade un campo con los dígitos
puros (para construir enlaces `wa.me`/`api.whatsapp.com` con texto):

```ts
  whatsapp: 'https://wa.me/34623941891',
  whatsappDigits: '34623941891',
```

**Verify**: `grep -c "whatsappDigits" src/config/site.ts` → 1.

### Step 2: Sustituir en contacto/index.astro

Asegúrate de que el frontmatter importa la config (si no lo hace ya):
`import { SITE_CONFIG } from '~/config/site';`

- Línea ~30 (IconBox description): `description={SITE_CONFIG.telephone}`
- Línea ~31 (IconBox href): `href={`https://wa.me/${SITE_CONFIG.whatsappDigits}?text=${encodeURIComponent('Quiero más información')}`}`
- Línea ~61 (tel link): `<a href={`tel:${SITE_CONFIG.telephone.replace(/\s/g, '')}`}>{SITE_CONFIG.telephone.replace('+34 ', '')}</a>`
  (muestra "623 94 18 91"; el `href` queda `tel:+34623941891`.)

**Verify**: `grep -c "623941891\|623 94 18 91" src/pages/contacto/index.astro` → 0.

### Step 3: Sustituir en aprende-masaje-californiano/index.astro

Añade el import `import { SITE_CONFIG } from '~/config/site';` al frontmatter si
falta, y sustituye el `href` (~L29):

`href={`https://wa.me/${SITE_CONFIG.whatsappDigits}?text=${encodeURIComponent('Hola, quiero más info sobre las formaciones de masaje californiano')}`}`

**Verify**: `grep -c "623941891" src/pages/aprende-masaje-californiano/index.astro` → 0.

### Step 4: Sustituir el literal del catch en BookingDialog.astro

En el `<script>` de `BookingDialog.astro`, añade al principio (junto al
`import type …`):
`import { SITE_CONFIG } from '~/config/site';`

Y sustituye la línea del `catch` (~L432):

```ts
    const wa = `https://wa.me/${SITE_CONFIG.whatsappDigits}?text=` + encodeURIComponent('Hola, quiero reservar una sesión de masaje');
```

> Si el plan 005 ya se aplicó, el handler es `async` pero el `catch` y esta línea
> siguen existiendo igual; solo cambia el literal por la interpolación. No
> reintroduzcas un import estático del widget.

**Verify**: `grep -c "34623941891" src/components/booking/BookingDialog.astro` → 0.

### Step 5 (opcional): _dev/components.astro

Si quieres consistencia total, aplica el mismo patrón al IconBox de WhatsApp en
`src/pages/_dev/components.astro:147`. Es una página de desarrollo; puedes
omitirlo sin afectar producción.

### Step 6: Verificación

**Verify**: `npx astro check && npm run build` → exit 0.
`grep -rn "623941891\|623 94 18 91" src/` → solo deben quedar: `src/config/site.ts` (canónico), `src/lib/booking/config.ts` (default de entorno), `src/content/legal/*.md` (contenido), y opcionalmente `src/pages/_dev/components.astro` si saltaste el Step 5.

## Test plan

Sin tests unitarios. Comprobación manual en `npm run preview`:

1. `/contacto/` → el IconBox de WhatsApp abre `wa.me` con el mensaje; el `tel:`
   marca el número correcto; el número mostrado es legible.
2. `/aprende-masaje-californiano/` → el botón de WhatsApp abre el chat con el texto.
3. Abrir el diálogo de reservas forzando un fallo de init → el botón de WhatsApp
   del fallback apunta al número correcto.

## Done criteria

ALL must hold:

- [ ] `grep -c "whatsappDigits" src/config/site.ts` → 1
- [ ] `grep -rn "623941891\|623 94 18 91" src/` → solo en site.ts, lib/booking/config.ts, content/legal/*.md (+ _dev si se omitió Step 5)
- [ ] `npx astro check` exit 0
- [ ] `npm run build` exit 0
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 008 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- Los literales de "Current state" no coinciden (deriva).
- Importar `~/config/site` en el `<script>` cliente de BookingDialog provoca que
  `astro check` o el build se quejen de algo server-only en site.ts (no debería:
  son consts). Si pasa, reporta en vez de mover lógica.

## Maintenance notes

- A partir de ahora, cambiar el teléfono = editar `SITE_CONFIG` en `site.ts`
  (telephone + whatsapp + whatsappDigits) y, si aplica, el default de
  `PUBLIC_BOOKING_WHATSAPP` en `.env`/secret y el texto de los `.md` legales.
- Deferido a propósito: unificar también `config.ts` y los `.md` legales. El
  primero pertenece al subsistema de reservas (config por entorno); los segundos
  son copy legal. Acoplarlos a `site.ts` no compensa.
- Un revisor debe verificar que `SITE_CONFIG.telephone.replace(...)` produce el
  `href` `tel:` y el texto visibles correctos (probar el resultado, no asumir).
