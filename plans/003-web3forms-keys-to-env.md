# Plan 003: Mover las access keys de Web3Forms a variables de entorno y endurecer el doble-submit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b37c88..HEAD -- src/components/interactive/ContactForm.astro .env.example .github/workflows/deploy.yml`
> Si algún archivo in-scope cambió, compara los extractos de "Current state"
> con el código vivo antes de continuar; si no coinciden, trátalo como STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (introduce dependencia de 2 secrets nuevos: si no se configuran, los formularios dejan de enviar)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `5b37c88`, 2026-06-13

## Why this matters

Las access keys de Web3Forms de los formularios de **contacto** y **regala
masaje** están hardcodeadas en `ContactForm.astro` y commiteadas en un repo de
GitHub público. Aclaración honesta de alcance: estas claves acaban igualmente
en el bundle del cliente (es un servicio form-to-email sin backend), así que
sacarlas del código **no las oculta** — la protección real contra abuso es el
honeypot de Web3Forms. El valor de este cambio es de **higiene**, no de secreto:
(1) rotar una clave comprometida pasa a ser cambiar un secret + redeploy, sin
tocar código; (2) deja de quedar grabada en el historial de git como "config";
(3) **unifica el patrón** con el sistema de reservas, que ya lee
`PUBLIC_WEB3FORMS_KEY` de entorno vía `config.ts`. Tener dos convenciones para
lo mismo es deuda. De paso se cierra una pequeña ventana de doble-envío en el
formulario.

Si el operador valora más "cero fricción de despliegue" que esta higiene, es
razonable saltarse este plan — está aislado y no bloquea a ningún otro.

## Current state

- `src/components/interactive/ContactForm.astro:12-17` — claves hardcodeadas en el frontmatter:

```ts
// Claves Web3Forms por variante
const ACCESS_KEYS: Record<string, string> = {
  contacto: '79f5b132-...',   // valor real en el archivo
  regala:   'fe240b7c-...',
};
const accessKey = ACCESS_KEYS[variant];
```

  (No reproduzcas los valores completos en commits ni en el índice; el archivo
  ya los contiene.) El valor se inyecta en `data-access-key={accessKey}` (línea ~29)
  y el script cliente lo lee con `form.dataset.accessKey` (línea ~649).

- `src/lib/booking/config.ts:33` — el patrón a imitar (clave de reservas ya en entorno):

```ts
export const WEB3FORMS_KEY = requireEnv('PUBLIC_WEB3FORMS_KEY');
```

- `.env.example` — documenta ya `PUBLIC_WEB3FORMS_KEY` (línea ~24) para reservas; faltan las dos de los formularios.
- `.github/workflows/deploy.yml:43-46` — el step Build ya pasa 3 secrets `PUBLIC_*`:

```yaml
        env:
          PUBLIC_GCAL_API_KEY: ${{ secrets.PUBLIC_GCAL_API_KEY }}
          PUBLIC_GCAL_CALENDAR_ID: ${{ secrets.PUBLIC_GCAL_CALENDAR_ID }}
          PUBLIC_WEB3FORMS_KEY: ${{ secrets.PUBLIC_WEB3FORMS_KEY }}
```

- `ContactForm.astro:699-781` — handler de submit (async). Tras `e.preventDefault()` valida y luego `setState('sending')` (que oculta el form). Entre el clic y `setState` hay una ventana en la que un segundo clic re-dispara el submit. No hay guarda de "ya enviando".

- Astro expone variables `PUBLIC_*` en cliente y en frontmatter vía `import.meta.env.PUBLIC_*` (inlinadas en build).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx astro check`  | 0 errors |
| Build (con env) | `npm run build` | exit 0 (requiere las nuevas vars en `.env`) |

## Scope

**In scope**:
- `src/components/interactive/ContactForm.astro`
- `.env.example`
- `.github/workflows/deploy.yml`
- `plans/README.md`

**Out of scope**:
- `src/lib/booking/config.ts` y `submit.ts` — la clave de reservas ya está bien; no la toques.
- Crear o editar un `.env` real con valores verdaderos — eso lo hace el operador (ver STOP / nota). NO escribas claves reales en ningún archivo versionado salvo donde ya estaban.

## Git workflow

- Branch: `advisor/003-web3forms-env`.
- Commits en español, imperativo, ≤70 chars. Ej: `Leer claves Web3Forms de entorno en ContactForm`.
- NO push ni PR salvo instrucción.

## Steps

### Step 1: Leer las claves de entorno en el frontmatter

En `ContactForm.astro`, sustituye el bloque `ACCESS_KEYS` (líneas 12-17) por
lectura de entorno con validación en build:

```ts
// Claves Web3Forms por variante — desde entorno (PUBLIC_*, visibles en cliente).
// Hardcodearlas obligaría a un cambio de código + redeploy para rotarlas.
const ACCESS_KEYS: Record<string, string | undefined> = {
  contacto: import.meta.env.PUBLIC_WEB3FORMS_KEY_CONTACTO,
  regala:   import.meta.env.PUBLIC_WEB3FORMS_KEY_REGALA,
};
const accessKey = ACCESS_KEYS[variant];
if (!accessKey) {
  throw new Error(
    `[ContactForm] Falta la clave Web3Forms para la variante "${variant}". ` +
    `Define PUBLIC_WEB3FORMS_KEY_${variant.toUpperCase()} en .env o en los secrets de GitHub Actions.`
  );
}
```

(Lanzar en build replica el comportamiento de `requireEnv` de reservas: si la
clave falta, el build falla rápido en vez de desplegar un formulario roto.)

**Verify**: `grep -n "79f5b132\|fe240b7c" src/components/interactive/ContactForm.astro` → 0 matches (las claves ya no están en el código).

### Step 2: Documentar las nuevas variables en .env.example

En `.env.example`, en la sección Web3Forms (tras `PUBLIC_WEB3FORMS_KEY=`), añade:

```
# Access key del formulario de CONTACTO (página /contacto/).
PUBLIC_WEB3FORMS_KEY_CONTACTO=

# Access key del formulario de REGALA MASAJE (página /regala-masaje/).
PUBLIC_WEB3FORMS_KEY_REGALA=
```

**Verify**: `grep -c "PUBLIC_WEB3FORMS_KEY_" .env.example` → 2.

### Step 3: Pasar los secrets en el workflow de CI

En `.github/workflows/deploy.yml`, en el bloque `env:` del step Build, añade
dos líneas bajo `PUBLIC_WEB3FORMS_KEY`:

```yaml
          PUBLIC_WEB3FORMS_KEY_CONTACTO: ${{ secrets.PUBLIC_WEB3FORMS_KEY_CONTACTO }}
          PUBLIC_WEB3FORMS_KEY_REGALA: ${{ secrets.PUBLIC_WEB3FORMS_KEY_REGALA }}
```

**Verify**: `grep -c "PUBLIC_WEB3FORMS_KEY_" .github/workflows/deploy.yml` → 2.

### Step 4: Guarda de doble-envío en el script del formulario

En `ContactForm.astro`, dentro del handler `form.addEventListener('submit', …)`
(empieza en la línea ~699), justo después de `e.preventDefault();` añade:

```ts
      if (form.dataset.submitting === 'true') return;
```

Y justo antes de `setState('sending');` (tras pasar todas las validaciones,
línea ~740) añade:

```ts
      form.dataset.submitting = 'true';
```

Finalmente, libera la guarda en los dos finales del envío para permitir
reintentos: en la rama de error del `try` (donde hoy se hace `setState('fail')`,
~774 y ~778) añade `form.dataset.submitting = '';` antes de cada `setState('fail')`,
y en el handler del botón "Intentar de nuevo" (`data-retry-btn`, ~695-697) añade
`form.dataset.submitting = '';` antes de `setState('form')`.

**Verify**: `grep -c "dataset.submitting" src/components/interactive/ContactForm.astro` → 5 (1 guarda + 1 set + 3 release: 2 en los fail del fetch + 1 en el botón "Intentar de nuevo").

### Step 5: Verificación de build

Crea/usa un `.env` LOCAL (no versionado) con valores dummy para las 5 vars
PUBLIC_ (las 3 de reservas + las 2 nuevas) y ejecuta el build.

**Verify**: `npx astro check && npm run build` → exit 0. Si no tienes `.env`, ver STOP conditions.

## Test plan

Sin tests automatizados (formulario `.astro` con script inline, sin harness DOM
en este repo — la extracción a módulo testeable está deliberadamente fuera de
alcance y registrada como residual). Verificación manual mínima que el operador
debe hacer tras desplegar con los secrets configurados:

1. `/contacto/` → enviar el formulario → llega email a la cuenta de contacto.
2. `/regala-masaje/` → seleccionar masaje + duración → enviar → llega email a la cuenta de regala.
3. Doble clic rápido en "Enviar" → un solo email (no dos).

## Done criteria

ALL must hold:

- [ ] `grep -rn "79f5b132\|fe240b7c" src/` → 0 matches
- [ ] `.env.example` contiene `PUBLIC_WEB3FORMS_KEY_CONTACTO` y `PUBLIC_WEB3FORMS_KEY_REGALA`
- [ ] `deploy.yml` pasa ambos secrets en el step Build
- [ ] `npx astro check` exit 0
- [ ] `npm run build` exit 0 con un `.env` que define las 5 vars PUBLIC_
- [ ] `git status` sin archivos fuera del Scope
- [ ] Fila 003 de `plans/README.md` actualizada

## STOP conditions

Stop and report si:

- Los extractos no coinciden con el código vivo (deriva).
- `npm run build` falla por las nuevas vars y NO tienes forma de crear un `.env`
  local: NO inventes valores en archivos versionados. Reporta que el build
  necesita `.env` con `PUBLIC_WEB3FORMS_KEY_CONTACTO` y `_REGALA` (más las 3 de
  reservas) y deja el código aplicado; el operador completará la verificación.
- **Acción requerida del operador (no la hagas tú):** dar de alta en GitHub →
  Settings → Secrets los dos secrets nuevos ANTES de desplegar, o el deploy
  publicará formularios que no envían. Anótalo en tu reporte final.

## Maintenance notes

- Las claves siguen siendo públicas (acaban en el bundle). Si en el futuro se
  necesita ocultarlas de verdad, habría que introducir un endpoint server-side
  (cambiaría `output: 'static'`) — fuera del alcance actual del proyecto.
- Si se añade una tercera variante de formulario, replica el patrón:
  `PUBLIC_WEB3FORMS_KEY_<VARIANTE>` + secret + línea en deploy.yml.
- Un revisor debe verificar que la guarda `submitting` se libera en TODOS los
  caminos de fallo (si no, un envío fallido deja el formulario bloqueado para
  reintentar).
