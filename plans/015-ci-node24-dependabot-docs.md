# Plan 015: Poner al día el CI (Node 24, actions v7), añadir Dependabot y corregir la documentación obsoleta

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bdbb94..HEAD -- .github package.json README.md CLAUDE.md docs`
> Cambios esperados: el plan 010 sube dependencias en `package.json` y el 016 añade `happy-dom` a
> `devDependencies`. Cualquier otro cambio en estos archivos: compara con "Current state" y, si no coincide, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (YAML y documentación; el único riesgo real es dejar el deploy roto, y el Step 1 se
  verifica con el propio despliegue)
- **Depends on**: 010 (conviene que las dependencias ya estén al día antes de activar Dependabot)
- **Category**: dx / tooling / docs
- **Planned at**: commit `8bdbb94`, 2026-09-22 · **revisado** en `5f86a30`, 2026-09-23 (drift: solo `package.json`,
  por 010 y 016; `checkout` v7.0.1, `setup-node` v7.0.0, `upload-pages-artifact` v5.0.0 y `deploy-pages` v5.0.1
  siguen siendo las últimas; `main` sin protección ni rulesets)

## Why this matters

1. **El CI se quedó atrás**: usa Node **22** (fin de soporte 2027-04-30) y `actions/checkout@v5` y
   `actions/setup-node@v5`, cuando ambas van por **v7** (publicadas en julio de 2026). Node **24** es la LTS
   actual (soporte hasta 2028-04-30) y es la que declaran soportar Astro 7 y Vitest 5.
2. **No hay Dependabot**: por eso la vulnerabilidad crítica de `astro@6.4.6` (la que arregla el plan 010)
   llevaba meses en el repo sin que nadie recibiera un aviso. Un sitio que se despliega solo necesita que
   alguien avise cuando una dependencia se queda sin parches.
3. **El workflow usa `npx astro check`** en vez del script del repo (`npm run check`), así que cualquier
   cambio en el script no llega al CI; y **se despliega también cuando solo cambian `docs/` o `plans/`**,
   gastando minutos y publicando un build idéntico.
4. **La documentación miente sobre lo básico**: `CLAUDE.md:34` y `README.md:9,17` siguen diciendo
   `base: '/vorama-astro/'` y `http://localhost:4321/vorama-astro/`, cuando el sitio está en `base: '/'` y
   dominio propio desde la migración. Quien (o lo que) lea esas líneas construirá URLs equivocadas.
   `docs/architecture.md` §11 y `docs/booking/*` describen el staging de `github.io` como si fuera el destino.
5. **Instrucción operativa peligrosa**: `docs/booking/booking-system-spec.md:143` dice que la API key de
   Google se restrinja al referrer `https://magnusmcmdev.github.io/vorama-astro/*`. Esa key es pública
   (`PUBLIC_*`, visible en el navegador) y su única protección real son la restricción por referrer y la de
   API. Si alguien sigue el documento, la deja restringida a un dominio que ya no es el del sitio.
   **Comprobado en producción (2026-09-22)** con la key del bundle público, sin mostrarla:
   `freeBusy` responde 200 con referrer `https://vorama.es/`, 403 (`API_KEY_HTTP_REFERRER_BLOCKED`) con
   un dominio ajeno o sin referrer (bien), pero **sigue respondiendo 200 con el referrer antiguo
   `magnusmcmdev.github.io`**, que ya solo redirige a vorama.es. Esa entrada sobra y hay que quitarla
   (acción del operador, ver "Test plan"). Otra API de Google con la misma key → 403 `SERVICE_DISABLED`.

## Current state

**YAML validado**: el `deploy.yml` resultante del Step 1 y los `ci.yml` y `dependabot.yml` de los Steps 2 y
3 (sacados de este mismo archivo) validan contra los esquemas oficiales de SchemaStore
(`github-workflow.json` y `dependabot-2.0.json`) con `ajv`.

- `.github/workflows/deploy.yml` (52 líneas). Disparadores: `push` a `main` y `workflow_dispatch`;
  `permissions: contents read / pages write / id-token write`; `concurrency: group: pages, cancel-in-progress: true`.
  Job `build`:

```yaml
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type-check (astro check)
        run: npx astro check

      - name: Tests (vitest)
        run: npm test

      - name: Build
        run: npm run build
        env:
          PUBLIC_GCAL_API_KEY: ${{ secrets.PUBLIC_GCAL_API_KEY }}
          PUBLIC_GCAL_CALENDAR_ID: ${{ secrets.PUBLIC_GCAL_CALENDAR_ID }}
          PUBLIC_WEB3FORMS_KEY: ${{ secrets.PUBLIC_WEB3FORMS_KEY }}
          PUBLIC_WEB3FORMS_KEY_CONTACTO: ${{ secrets.PUBLIC_WEB3FORMS_KEY_CONTACTO }}
          PUBLIC_WEB3FORMS_KEY_REGALA: ${{ secrets.PUBLIC_WEB3FORMS_KEY_REGALA }}

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./dist
```

  Job `deploy`: `needs: build`, `environment: github-pages`, `actions/deploy-pages@v5`.
  **`upload-pages-artifact@v5` y `deploy-pages@v5` ya son las últimas** (v5.0.0 y v5.0.1): no se tocan.

- Últimas versiones publicadas (comprobado el 2026-09-22 con `gh api`): `actions/checkout` **v7.0.1**,
  `actions/setup-node` **v7.0.0**. Cambios rompedores revisados: `setup-node@v6` limitó el cacheo
  automático a npm (aquí `cache: 'npm'` es explícito, no afecta); `checkout@v6` guarda las credenciales en
  un fichero aparte y `v7` bloquea el checkout de PRs de fork en `pull_request_target`/`workflow_run` (aquí
  no se usan). Ninguno afecta a este workflow.

- `package.json`: `"engines": { "node": ">=22.12.0" }` y scripts `check: "astro check"`, `test: "vitest run"`.
  Vitest 5 (plan 010) soporta `^22.12 || ^24 || >=26`: el rango actual admite Node 23 y 25, donde no funciona.

- No existe `.github/dependabot.yml` (`ls .github` → solo `workflows/`).

- Documentación obsoleta (líneas exactas):
  - `CLAUDE.md:34`: `- \`output: 'static'\`, GitHub Pages, \`base: '/vorama-astro/'\`. No introducir`
  - `README.md:9`: `- **Hosting**: GitHub Pages. \`base: '/vorama-astro/'\`, \`output: 'static'\`.`
  - `README.md:17`: `npm run dev            # http://localhost:4321/vorama-astro/`
  - `docs/architecture.md:284-299`: sección "## 11. Hosting y deploy". Empieza así:

    ```md
    **GitHub Action** (`.github/workflows/deploy.yml`):
    - Trigger: push a `main`.
    - Build: `npm ci && npm run build`.
    - Deploy: a GitHub Pages del propio repo `vorama-astro`.
    ```

    y sigue con la URL de staging `https://magnusmcmdev.github.io/vorama-astro/` ("URL inicial (staging)") y el
    "Path a producción" (lista de 4 pasos) como algo pendiente.
  - `docs/architecture.md:38`: `vorama-astro/` es la carpeta raíz del repo en el árbol de carpetas de la sección 3.
    **Es correcta: no la toques.**
  - `docs/booking/architecture.md:164`: fila de tabla `| GH Pages base path (\`/vorama-astro/\`) | …`
  - `docs/booking/booking-system-spec.md:143`: `- Añadir referrer: \`https://magnusmcmdev.github.io/vorama-astro/*\` …`
  - `docs/migration-roadmap.md`: documento de la migración (líneas 14, 32, 38-39, 183, 235-256 hablan del
    staging). Es un **histórico**: no se reescribe, solo se marca como tal.
  - `src/pages/_dev/components.astro:5`: comentario `URL: /vorama-astro/_dev/components/`.
  - `.env.example:14` (plantilla de configuración, sin valores reales):
    `#   - HTTP referrer: https://magnusmcmdev.github.io/* (y el dominio final)` — la misma instrucción
    peligrosa que `booking-system-spec.md:143`.

- Estado real (para redactar la documentación): `astro.config.mjs` → `site: 'https://vorama.es'`,
  `base: '/'`, `trailingSlash: 'always'`; `public/CNAME` → `vorama.es`; el sitio está en producción.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | `31 passed` |
| Build | `npm run build` | `Complete!` |
| YAML válido | `npx -y js-yaml@4 .github/workflows/deploy.yml > /dev/null && echo OK` | `OK` |

## Scope

**In scope**:
- `.github/workflows/deploy.yml`
- `.github/workflows/ci.yml` (crear)
- `.github/dependabot.yml` (crear)
- `package.json` (solo el campo `engines`)
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/booking/architecture.md`,
  `docs/booking/booking-system-spec.md`, `docs/migration-roadmap.md` (solo un aviso), `src/pages/_dev/components.astro` (solo el comentario),
  `.env.example` (solo la línea 14)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- Las versiones de dependencias de `package.json` (eso es el plan 010).
- `upload-pages-artifact` y `deploy-pages` (ya están en la última v5).
- Los secrets del repo ni la configuración de GitHub Pages (son acciones del operador).
- El contenido histórico de `docs/migration-roadmap.md` (solo se le añade la nota de cabecera).
- Añadir linters o formateadores nuevos.

## Git workflow

- Branch: `advisor/015-ci-docs`.
- Commits: (1) CI; (2) Dependabot; (3) documentación. Español, imperativo, ≤70 caracteres.
- NO hagas push ni abras PR salvo que el operador lo pida (este plan solo se puede validar del todo
  cuando llega a `main`: ver "Test plan").

## Steps

### Step 1: Actualizar el workflow de despliegue

En `.github/workflows/deploy.yml`:

1. Disparador — no desplegar cuando solo cambian documentos:

```yaml
on:
  # Trigger on push to main
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - 'plans/**'
      - 'README.md'
      - 'CLAUDE.md'
  # Allow manual dispatch from the Actions tab
  workflow_dispatch:
```

   (**No** añadas `**/*.md` a la lista: los textos legales de `src/content/legal/*.md` sí son contenido del sitio.)

2. `uses: actions/checkout@v5` → `uses: actions/checkout@v7`
3. `uses: actions/setup-node@v5` → `uses: actions/setup-node@v7` y `node-version: '22'` → `node-version: '24'`
4. Paso de type-check:

```yaml
      - name: Type-check (astro check)
        run: npm run check
```

**Verify**: `npx -y js-yaml@4 .github/workflows/deploy.yml > /dev/null && echo OK` → `OK` ·
`grep -c "actions/checkout@v7\|actions/setup-node@v7\|node-version: '24'\|npm run check" .github/workflows/deploy.yml` → `4` ·
`grep -c "npx astro check\|@v5" .github/workflows/deploy.yml` → `3` (`upload-pages-artifact@v5`, `deploy-pages@v5` y el comentario de la línea 15, `# Permissions necessary for actions/deploy-pages@v5`).

### Step 2: CI en los pull requests

Crea `.github/workflows/ci.yml`:

```yaml
name: CI

# Verifica ramas y PRs (incluidos los de Dependabot) sin desplegar nada.
on:
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type-check (astro check)
        run: npm run check

      - name: Tests (vitest)
        run: npm test

      # Claves ficticias si no hay secrets (PRs de fork): el build solo necesita que existan.
      - name: Build
        run: npm run build
        env:
          PUBLIC_GCAL_API_KEY: ${{ secrets.PUBLIC_GCAL_API_KEY || 'dummy' }}
          PUBLIC_GCAL_CALENDAR_ID: ${{ secrets.PUBLIC_GCAL_CALENDAR_ID || 'dummy' }}
          PUBLIC_WEB3FORMS_KEY: ${{ secrets.PUBLIC_WEB3FORMS_KEY || 'dummy' }}
          PUBLIC_WEB3FORMS_KEY_CONTACTO: ${{ secrets.PUBLIC_WEB3FORMS_KEY_CONTACTO || 'dummy' }}
          PUBLIC_WEB3FORMS_KEY_REGALA: ${{ secrets.PUBLIC_WEB3FORMS_KEY_REGALA || 'dummy' }}
```

**Verify**: `npx -y js-yaml@4 .github/workflows/ci.yml > /dev/null && echo OK` → `OK`.

### Step 3: Activar Dependabot

Crea `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "06:00"
      timezone: Europe/Madrid
    open-pull-requests-limit: 5
    groups:
      astro:
        patterns:
          - "astro"
          - "@astrojs/*"
      tooling:
        patterns:
          - "vitest"
          - "typescript"
          - "happy-dom"
    ignore:
      # @astrojs/check declara peer typescript "^5 || ^6": un major de TS rompería `npm run check`.
      # Quitar este ignore cuando @astrojs/check admita TypeScript 7.
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
    commit-message:
      prefix: "deps"

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: monthly
    commit-message:
      prefix: "ci"
```

**Verify**: `npx -y js-yaml@4 .github/dependabot.yml > /dev/null && echo OK` → `OK`.

### Step 4: Ajustar `engines` a lo que realmente funciona

En `package.json`:

```json
  "engines": {
    "node": "^22.12.0 || ^24 || >=26"
  },
```

**Verify**: `node -p "require('./package.json').engines.node"` → `^22.12.0 || ^24 || >=26` ·
`npm ci` → sin avisos de `EBADENGINE`.

### Step 5: Corregir la documentación

1. `CLAUDE.md:34` →

```md
- `output: 'static'`, GitHub Pages con dominio propio (`vorama.es`), `base: '/'`. No introducir
```

2. `README.md:9` →

```md
- **Hosting**: GitHub Pages con dominio propio `https://vorama.es` (`base: '/'`, `output: 'static'`).
```

3. `README.md:17` →

```md
npm run dev            # http://localhost:4321/
```

4. `docs/architecture.md`, sección "## 11. Hosting y deploy":

   a. Sustituye el bloque `**GitHub Action** (…):` y sus 3 viñetas (Trigger, Build, Deploy) por:

```md
**GitHub Actions:**
- `deploy.yml`: en cada push a `main` (salvo si solo cambian `docs/`, `plans/`, `README.md` o `CLAUDE.md`) y a mano desde la pestaña Actions. Con Node 24 ejecuta `npm ci`, `npm run check`, `npm test` y `npm run build`, y publica en GitHub Pages.
- `ci.yml`: las mismas comprobaciones, sin desplegar, en cada pull request a `main` (incluidos los de Dependabot).
- `dependabot.yml`: pull requests semanales de dependencias npm (grupos `astro` y `tooling`) y mensuales de GitHub Actions.
```

   b. Sustituye las líneas de "URL inicial (staging)" y "Path a producción" (incluida la lista numerada de 4
   pasos) por:

```md
**URL de producción:** `https://vorama.es` (dominio propio en dondominio, DNS apuntando a GitHub Pages;
`public/CNAME` contiene el dominio y `astro.config.mjs` usa `site: 'https://vorama.es'` y `base: '/'`).

**Histórico:** el sitio estuvo publicado como *project page* en `https://magnusmcmdev.github.io/vorama-astro/`
con `base: '/vorama-astro/'` hasta la migración de dominio.
```

5. `docs/booking/architecture.md:164`: cambia la fila por

```md
| Dominio propio (`https://vorama.es`, `base: '/'`) | Tener en cuenta en URLs internas y en el referrer de la API key. |
```

6. `docs/booking/booking-system-spec.md:143`: cambia la línea por

```md
   - Añadir referrer: `https://vorama.es/*` (único dominio del sitio; retirar cualquier referrer antiguo de `github.io`).
```

7. `docs/migration-roadmap.md`: justo debajo del título (línea 1), inserta:

```md
> **Documento histórico.** Describe la migración de WordPress a Astro y el staging en
> `magnusmcmdev.github.io/vorama-astro/`. El sitio está en producción en https://vorama.es
> desde 2026-06 con `base: '/'`; las URLs de staging de este documento ya no son válidas.
```

8. `src/pages/_dev/components.astro:5`: `URL: /vorama-astro/_dev/components/` → `URL: /_dev/components/`
   (recuerda: esa página no se construye, es solo para `npm run dev`).

9. `.env.example:14`: cambia la línea por

```
#   - HTTP referrer: https://vorama.es/* (único dominio del sitio)
```

**Verify**:
- `grep -rn "vorama-astro/" README.md CLAUDE.md docs/booking src/pages/_dev` → sin resultados
- `grep -n "vorama-astro/" docs/architecture.md` → **exactamente 3 líneas**: la 38 (carpeta raíz del árbol, correcta)
  y las 2 líneas de la nota "Histórico" que acabas de escribir. (Las de `docs/migration-roadmap.md` se quedan:
  es un documento histórico.)
- `grep -rn "magnusmcmdev.github.io" .env.example docs/booking` → sin resultados
- `grep -c "GitHub Actions:\|ci.yml\|dependabot.yml" docs/architecture.md` → `≥3`
- `grep -c "vorama.es" README.md CLAUDE.md` → `≥1` en cada uno
- `grep -c "magnusmcmdev.github.io/vorama-astro" docs/booking/booking-system-spec.md` → `0`

### Step 6: Verificación local completa

**Verify**: `npm ci` → OK · `npm run check` → 0 errors · `npm test` → `31 passed` · `npm run build` → OK (16 páginas).

## Test plan

No hay tests automáticos para YAML de CI. La verificación real es el propio despliegue:

1. Tras el merge a `main`, la pestaña **Actions** debe mostrar el workflow "Deploy to GitHub Pages" en
   verde con Node 24 (el log del paso "Setup Node.js" lo dice).
2. `https://vorama.es/` sigue funcionando y sirve el build nuevo.
3. El primer PR que abra Dependabot debe disparar el workflow "CI" y quedar en verde.
4. Un commit que solo toque `docs/` o `plans/` **no** debe disparar el deploy.

**Acciones del operador (fuera del repo):**

- **Google Cloud Console → APIs y servicios → Credenciales → la API key de Calendar**: dejar en
  "Restricciones de aplicación → Referentes HTTP" únicamente `https://vorama.es/*` — **hoy sigue aceptando
  `magnusmcmdev.github.io`** (comprobado) — y en "Restricciones de API" solo la Google Calendar API.
  Comprobación después (sin mostrar la key): el widget de reservas de https://vorama.es sigue cargando el
  calendario.
- **Privacidad del calendario (decisión del titular)**: el widget consulta el calendario **principal de una
  cuenta de Gmail**, compartido en público como "solo disponible/ocupado". Cualquiera puede ver sus bloques
  ocupados (no los títulos) a cualquier hora. Si esa cuenta se usa también para asuntos personales,
  conviene crear un calendario secundario solo para citas y apuntar `PUBLIC_GCAL_CALENDAR_ID` a él.
- **GitHub → Settings → Secrets and variables → Actions**: confirmar que siguen los 5 secrets
  `PUBLIC_GCAL_API_KEY`, `PUBLIC_GCAL_CALENDAR_ID`, `PUBLIC_WEB3FORMS_KEY`,
  `PUBLIC_WEB3FORMS_KEY_CONTACTO`, `PUBLIC_WEB3FORMS_KEY_REGALA`.
- **GitHub → Settings → Pages**: origen "GitHub Actions" y dominio `vorama.es` con "Enforce HTTPS" activo.
- **GitHub → Settings → Advanced Security**: activar **Dependabot alerts** y **Dependabot security updates**
  (comprobado el 2026-09-23: las dos están desactivadas). `dependabot.yml` solo programa las actualizaciones
  de versión semanales; las alertas avisan de una vulnerabilidad el mismo día que se publica.

## Done criteria

- [ ] `deploy.yml` con `checkout@v7`, `setup-node@v7`, `node-version: '24'`, `npm run check` y `paths-ignore`
- [ ] `.github/workflows/ci.yml` y `.github/dependabot.yml` creados y con YAML válido
- [ ] `package.json` → `engines.node` = `^22.12.0 || ^24 || >=26`
- [ ] `grep -rn "vorama-astro/" README.md CLAUDE.md docs/booking src/pages/_dev` → sin resultados; en `docs/architecture.md`, solo las 3 líneas esperadas
- [ ] `.env.example` y `docs/booking` sin `magnusmcmdev.github.io`
- [ ] `npm run check` 0 errors · `npm test` 31 passed · `npm run build` OK
- [ ] `git status` sin cambios fuera del Scope
- [ ] Fila 015 de `plans/README.md` actualizada
- [ ] (Tras el merge) el despliegue queda en verde con Node 24

## STOP conditions

Para y reporta si:

- `npm ci` avisa de `EBADENGINE` con la versión de Node de la máquina.
- El repo tiene ramas protegidas o checks requeridos que el nombre nuevo del workflow ("CI") pudiera
  romper: avisa antes de mergear.
- Aparecen más referencias a `/vorama-astro/` fuera del Scope (p. ej. en `src/`): repórtalas, no las cambies
  por tu cuenta si afectan a rutas reales.

## Maintenance notes

- **Node 26 pasa a LTS el 2026-10-28**: en cuanto Astro y Vitest la declaren soportada, subir
  `node-version` a `'26'` y el rango de `engines`. No usar versiones impares (23, 25) en CI.
- **`ubuntu-latest` pasa a Ubuntu 26 a partir del 2026-10-19** (aviso en el log del deploy del 22-09). No
  requiere cambios; si ese día el build fallara por el runner (p. ej. binarios de `sharp`), fijar
  temporalmente `runs-on: ubuntu-24.04` en los dos workflows y abrir tarea para volver a `ubuntu-latest`.
- Dependabot abrirá PRs agrupados; el grupo `astro` puede incluir majors: leer siempre la guía de
  actualización de Astro antes de mergear uno.
- Quitar el `ignore` de TypeScript cuando `@astrojs/check` admita TS 7 en sus `peerDependencies`.
- Si algún día se migra el hosting (ver "Dirección" en `plans/README.md`), este workflow se sustituye;
  conservar los pasos de check/test como gate.
- Revisor: comprobar que `paths-ignore` no excluye nada que afecte al sitio y que el CI de PR no expone
  secrets a forks (usa el fallback `|| 'dummy'`).
