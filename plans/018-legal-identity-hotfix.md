# Plan 018: Quitar el NIF, la dirección personal y el email de los textos legales (petición del titular)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2f2eac9..HEAD -- src/content/legal`
> Debe salir **vacío**. Si no, compara las anclas de texto de "Current state" con los ficheros; si no están, STOP.

## Status

- **Priority**: P0 (petición expresa del titular, 2026-09-23)
- **Effort**: S
- **Risk**: LOW (solo texto de dos `.md`)
- **Depends on**: none (va antes que 017 y 012)
- **Category**: privacy
- **Planned at**: commit `d217252`, 2026-09-23

## Why this matters

Desde el plan 011, `/politica-de-privacidad/` y `/aviso-legal/` son páginas propias e indexables, y muestran el
**NIF y la dirección personal** del titular. El titular ha pedido quitarlos y dejar **solo su nombre y su
teléfono** como datos de identificación y contacto en los textos legales.

**Datos personales: regla estricta para este plan.** El ejecutor verá el NIF y la dirección en los ficheros,
pero **no debe copiarlos** en commits, mensajes, informes ni en ningún otro fichero. Este plan los nombra solo
por su posición y por anclas de texto que no los contienen.

## Current state

- `src/content/legal/privacidad.md`:
  - Front matter: `lastUpdated: "2024-11-06"`.
  - Línea 21: empieza por `El responsable del tratamiento de los datos personales recogidos en Voramà Terapias es:`
    y contiene el nombre del titular, `con NIF:` + el NIF y `(en adelante, Responsable del tratamiento). Sus datos de contacto son los siguientes:`.
  - Líneas 23-25: tres líneas de contacto que empiezan por `**Dirección:**`, `**Teléfono de contacto:**` y
    `**Email de contacto:**` (terminan en dos espacios, salto de línea de Markdown).
  - Línea 85: `Para ejercitar sus derechos, el Usuario podrá dirigirse por escrito al Responsable del tratamiento con la referencia **«RGPD-vorama.es»** a:`
  - Líneas 87-88: dos líneas que empiezan por `**Dirección postal:**` y `**Correo electrónico:**`.
- `src/content/legal/aviso-legal.md`:
  - Front matter: `lastUpdated: "2024-11-06"`.
  - Línea 10: empieza por `La titularidad de este sitio web, vorama.es, (en adelante, Sitio Web) la ostenta: **Miguel Cerdá Martínez**, con NIF:`
    y termina en `y cuyos datos de contacto son:`.
  - Líneas 12-14: tres líneas de contacto que empiezan por `**Dirección:**`, `**Teléfono de contacto:**` y
    `**Email de contacto:**`.
- El teléfono público del negocio (el que ya sale en toda la web) es `623 941 891`.
- `LegalContent.astro` (plan 011) pinta "Última actualización" a partir de `lastUpdated`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | 22 passed |
| Build | `npm run build` | `Complete!` (16 páginas) |

`.env` ficticio (5 claves `PUBLIC_*` = `dummy`); **nunca se commitea**.

## Scope

**In scope**: `src/content/legal/privacidad.md` y `src/content/legal/aviso-legal.md`, solo las líneas indicadas
y el `lastUpdated`.

**Out of scope**: el resto de los textos legales (los reescribe el plan 012); `src/pages/contacto/index.astro`
(su email de contacto se queda: es el canal público del negocio); cualquier otro fichero; `plans/`.

## Git workflow

- Branch: `advisor/018-legal-identity`. Un commit: `Quitar NIF, dirección y email de los textos legales`.
- Sin push ni PR.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: `grep -c "con NIF:" src/content/legal/privacidad.md src/content/legal/aviso-legal.md` → `1` en cada uno.

### Step 2: `privacidad.md`

1. Sustituye **toda** la línea 21 por:

```md
El responsable del tratamiento de los datos personales recogidos en Voramà Terapias es Miguel Cerdá Martínez (en adelante, Responsable del tratamiento). Puede contactar con él en:
```

2. Sustituye las **tres** líneas 23-25 (Dirección, Teléfono, Email) por esta única línea:

```md
**Teléfono y WhatsApp:** 623 941 891
```

3. Sustituye la línea 85 **y** las dos líneas 87-88 (y la línea en blanco entre ellas) por este único párrafo:

```md
Para ejercitar sus derechos, el Usuario podrá dirigirse al Responsable del tratamiento, con la referencia **«RGPD-vorama.es»**, a través del formulario de contacto del Sitio Web o por teléfono o WhatsApp en el 623 941 891.
```

4. Front matter: `lastUpdated: "2026-09-23"`.

### Step 3: `aviso-legal.md`

1. Sustituye **toda** la línea 10 por:

```md
La titularidad de este sitio web, vorama.es, (en adelante, Sitio Web) la ostenta: **Miguel Cerdá Martínez**, cuyos datos de contacto son:
```

2. Sustituye las **tres** líneas 12-14 por:

```md
**Teléfono y WhatsApp:** 623 941 891
```

3. Front matter: `lastUpdated: "2026-09-23"`.

### Step 4: Verificación

**Verify**:
- `grep -rn "NIF\|Dirección\|Correo electrónico:\|Email de contacto\|@gmail" src/content/legal/` → **sin resultados**
- `grep -c "623 941 891" src/content/legal/privacidad.md` → `2` · `grep -c "623 941 891" src/content/legal/aviso-legal.md` → `1`
- `npm run check` → 0 errors · `npm test` → 22 passed · `npm run build` → 16 páginas
- En el HTML construido tampoco quedan: `grep -c "con NIF\|@gmail" dist/politica-de-privacidad/index.html dist/aviso-legal/index.html` → `0` en ambos
- `grep -c "23 de septiembre de 2026" dist/aviso-legal/index.html` → `1` (fecha de "Última actualización")
- `git diff --stat` → solo los dos `.md`

## Done criteria

- [ ] Ninguno de los dos `.md` contiene NIF, dirección postal ni email
- [ ] Identidad = nombre + teléfono; derechos por formulario de contacto o teléfono/WhatsApp
- [ ] `lastUpdated` = `2026-09-23` en ambos
- [ ] check/test/build en verde; un commit; `.env` sin commitear
- [ ] El NIF y la dirección **no** aparecen en ningún commit message ni informe

## STOP conditions

- Las anclas de texto no coinciden con los ficheros.
- Aparece el NIF o la dirección en algún otro fichero versionado fuera de `src/content/legal/`: repórtalo (sin copiar el dato).

## Maintenance notes

- La LSSI (art. 10.1) pide en el aviso legal también un domicilio (vale el del local), un email y el NIF. El
  titular ha decidido publicar solo nombre y teléfono; si cambia de idea, basta con añadir la dirección del
  local y el email del negocio, que ya son públicos en `/contacto/`.
- **Historial de git reescrito el 2026-09-23** a petición del titular: en las versiones antiguas de los dos textos
  legales, el NIF y la dirección se sustituyeron por `[NIF eliminado]` y `[dirección eliminada]` (89 commits con
  contenido cambiado; autores, fechas y mensajes intactos; todos los identificadores de commit cambiaron y las
  referencias de `plans/` se actualizaron). Copia del historial original, fuera del repo:
  `C:\WebSites\_copias\vorama-astro-historial-original-2026-09-23.bundle`. GitHub puede seguir mostrando los
  commits antiguos a quien tenga su identificador hasta que su soporte los purgue.
- El plan 012 reescribe otras secciones de `privacidad.md`: sus anclas de texto no dependen de estas líneas.
