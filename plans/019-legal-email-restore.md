# Plan 019: Volver a poner el email de contacto en los textos legales (petición del titular)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f2e3515..HEAD -- src/content/legal`
> Debe salir **vacío**. Si no, compara las anclas de texto de "Current state" con los ficheros; si no están, STOP.

## Status

- **Priority**: P0 (petición expresa del titular, 2026-09-23)
- **Effort**: S
- **Risk**: LOW (solo texto de dos `.md`)
- **Depends on**: 018 (en producción)
- **Category**: legal
- **Planned at**: commit `9184fda`, 2026-09-23

## Why this matters

El plan 018 quitó de `/politica-de-privacidad/` y `/aviso-legal/` el NIF, la dirección personal y el email del
titular. El titular ha pedido (2026-09-23) **mantener también el email**. Es el email del negocio,
`vorama.terapias@gmail.com`, que ya es público en `/contacto/`, y la LSSI (art. 10.1.a) pide un email de
contacto en el aviso legal.

El NIF y la dirección personal **siguen fuera**: no los vuelvas a poner.

## Current state

- `src/content/legal/aviso-legal.md` (front matter `lastUpdated: "2026-09-23"`):
  - Línea 10: `La titularidad de este sitio web, vorama.es, (en adelante, Sitio Web) la ostenta: **Miguel Cerdá Martínez**, cuyos datos de contacto son:`
  - Línea 12: `**Teléfono y WhatsApp:** 623 941 891`
  - Línea 14: `## II. TÉRMINOS Y CONDICIONES GENERALES DE USO`
- `src/content/legal/privacidad.md` (front matter `lastUpdated: "2026-09-23"`):
  - Línea 21: `El responsable del tratamiento … (en adelante, Responsable del tratamiento). Puede contactar con él en:`
  - Línea 23: `**Teléfono y WhatsApp:** 623 941 891`
  - Línea 25: `### Registro de Datos de Carácter Personal`
  - Línea 83 (párrafo de derechos): `Para ejercitar sus derechos, el Usuario podrá dirigirse al Responsable del tratamiento, con la referencia **«RGPD-vorama.es»**, a través del formulario de contacto del Sitio Web o por teléfono o WhatsApp en el 623 941 891.`
- Hoy el email no aparece en ningún `.md` de `src/content/legal/` y, fuera de ellos, solo en `src/pages/contacto/index.astro`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | `22 passed` |
| Build | `npm run build` | `Complete!` (16 páginas) |

`.env` ficticio (5 claves `PUBLIC_*` = `dummy`); **nunca se commitea**.

## Scope

**In scope**: `src/content/legal/privacidad.md` y `src/content/legal/aviso-legal.md`, solo las líneas indicadas.

**Out of scope**: el resto de los textos legales (los reescribe el plan 012); `src/pages/contacto/index.astro`;
cualquier otro fichero; `plans/`.

## Git workflow

- Branch: `advisor/019-legal-email`. Un commit: `Volver a poner el email en los textos legales`.
- Sin push ni PR.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: `grep -c "vorama.terapias@gmail.com" src/content/legal/privacidad.md src/content/legal/aviso-legal.md`
→ `0` en cada uno · `grep -c "vorama.terapias@gmail.com" dist/aviso-legal/index.html` → `0`.

### Step 2: `aviso-legal.md`

Justo después de la línea `**Teléfono y WhatsApp:** 623 941 891`, añade una línea en blanco y esta línea, de
modo que el bloque quede así (una línea en blanco entre las dos):

```md
**Teléfono y WhatsApp:** 623 941 891

**Email:** vorama.terapias@gmail.com
```

### Step 3: `privacidad.md`

1. En "### Identidad del responsable del tratamiento de los datos personales", haz lo mismo: tras
   `**Teléfono y WhatsApp:** 623 941 891`, una línea en blanco y `**Email:** vorama.terapias@gmail.com`.
2. Sustituye **todo** el párrafo de derechos (el que empieza por `Para ejercitar sus derechos`) por:

```md
Para ejercitar sus derechos, el Usuario podrá dirigirse al Responsable del tratamiento, con la referencia **«RGPD-vorama.es»**, a través del formulario de contacto del Sitio Web, por email a vorama.terapias@gmail.com o por teléfono o WhatsApp en el 623 941 891.
```

### Step 4: Fecha

`lastUpdated` = fecha de ejecución en `"YYYY-MM-DD"` en los dos ficheros. Si ejecutas el plan el 2026-09-23, ya
vale `"2026-09-23"`: déjalo igual.

### Step 5: Verificación

**Verify**:
- `grep -c "vorama.terapias@gmail.com" src/content/legal/privacidad.md` → `2` · `grep -c "vorama.terapias@gmail.com" src/content/legal/aviso-legal.md` → `1`
- `grep -rn "NIF\|Dirección\|Correo electrónico:\|Email de contacto" src/content/legal/` → **sin resultados** (no vuelven el NIF ni la dirección)
- `grep -c "623 941 891" src/content/legal/privacidad.md` → `2` · `grep -c "623 941 891" src/content/legal/aviso-legal.md` → `1`
- `npm run check` → 0 errors · `npm test` → 22 passed · `npm run build` → 16 páginas
- `grep -c "vorama.terapias@gmail.com" dist/aviso-legal/index.html dist/politica-de-privacidad/index.html` → `1` y `2` (cuenta líneas: cada párrafo del Markdown sale en su propia línea, y el email se enlaza solo como `mailto:`)
- `git diff --stat` → solo los dos `.md`

## Done criteria

- [ ] Identidad = nombre + teléfono + email en los dos `.md`; derechos por formulario, email o teléfono/WhatsApp
- [ ] Sin NIF ni dirección en `src/content/legal/`
- [ ] check/test/build en verde; un commit; `.env` sin commitear

## STOP conditions

- Las anclas de texto no coinciden con los ficheros (por ejemplo, porque el plan 012 ya se ha aplicado y ha
  cambiado `privacidad.md`: en ese caso reporta en lugar de adaptar).

## Maintenance notes

- La LSSI (art. 10.1) pide además un domicilio (vale el del local, ya público en `/contacto/`) y el NIF. El
  titular decide si los añade.
- El plan 012 (texto de privacidad) cita la retirada del consentimiento: con este plan, debe mencionar también
  el email (su Step 3e).
