# Plan 013: Arreglar los fallos de accesibilidad (contraste, honeypot, tarjetas de reserva, carrusel, menú y mensajes del formulario)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bdbb94..HEAD -- src/styles/theme.css src/components/interactive/ContactForm.astro src/components/sections/ReservaCard.astro src/components/layout/Header.astro src/components/sections/ImageCarousel.astro`
> Cambio esperado según el orden recomendado: el plan 011 modifica `ContactForm.astro` (solo el enlace de
> privacidad, hacia la línea 210). Cualquier otro cambio en estos archivos: compara con "Current state" y,
> si no coincide, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (un token de color global se oscurece ligeramente, y se añade un botón al carrusel: cambios
  visuales pequeños y deliberados)
- **Depends on**: none (recomendado después de 011, que también toca `ContactForm.astro`)
- **Category**: accessibility
- **Planned at**: commit `8bdbb94`, 2026-09-22

## Why this matters

**Automático** — Lighthouse 13.5 sobre las **12 páginas** de producción (móvil, 2026-09-22): Accesibilidad
92–96 en todas (SEO y buenas prácticas, 100 en todas). Solo fallan tres auditorías:

1. **Contraste insuficiente en las 12 páginas** (`color-contrast`, WCAG 1.4.3). **Todos** los casos del sitio
   vienen de un único token, `--vrm-color-text-muted: #7f7c76`: 3,82:1 sobre el crema `#f6f5f4` del pie
   (lema, títulos de columnas, copyright y enlaces legales, en las 12 páginas y en la nota del formulario),
   4,16:1 sobre blanco (reseñas de la portada) y 3,29:1 sobre el verde `#d9e8e5` (botones de mapa de
   `/contacto/`). El mínimo AA para texto normal es 4,5:1.
2. **Campo sin etiqueta** (`label`, WCAG 1.3.1/4.1.2) en `/contacto/` y `/regala-masaje/`: el honeypot
   anti-spam está fuera de pantalla pero sigue en el árbol de accesibilidad, así que un lector de pantalla
   anuncia una casilla sin nombre (y quien la marque sin querer verá su mensaje descartado como spam por
   Web3Forms).
3. **El nombre accesible de las tarjetas de reserva no contiene su texto visible**
   (`label-content-name-mismatch`, WCAG 2.5.3) en las 3 páginas de servicio: se ve "Sesión de 90 minutos ·
   60€", pero el botón se llama "Reservar sesión de 90 minutos".

**Revisión manual** (código + navegador) — tres fallos que Lighthouse no detecta:

4. **El carrusel no se puede pausar** (WCAG 2.2.2, nivel **A**). Pasa de imagen cada 5 s sin fin en las 3
   páginas de servicio y en eventos; el propio código dice "Pausar SOLO cuando la pestaña no es visible"
   (`ImageCarousel.astro:230`). Solo quien tiene activado "reducir movimiento" se libra.
5. **Menú de escritorio con ARIA engañoso**: los enlaces con submenú llevan `aria-haspopup="true"` y
   `aria-expanded="false"` fijos (`Header.astro:90-91`). Ningún script los cambia y el submenú se abre por
   CSS (`:hover`/`:focus-within`), así que el lector anuncia "contraído, menú emergente" aunque esté abierto,
   y trata un enlace como botón de menú.
6. **Los mensajes de éxito y error del formulario de contacto no reciben el foco**: el script hace
   `successEl.focus()` / `failEl.focus()`, pero son `<div>` sin `tabindex`, así que `focus()` no hace nada. Al
   enviar, el formulario se oculta con el foco dentro y este cae al `<body>`: quien usa teclado o lector de
   pantalla no se entera de si el mensaje se envió (el de error ni siquiera es región `aria-live`).

## Current state

**Plan probado**: los Steps 2-7 se aplicaron tal cual en un clon del repo (sobre 010, 016 y 011): el
script de contraste da 3 × `OK`, `astro check` 0/0/0, tests en verde, build de 16 páginas y todas las
comprobaciones de los Steps con el resultado indicado.

- `src/styles/theme.css:19`:

```css
  --vrm-color-text-muted:    #7f7c76; /* secundario, meta, hints */
```

  Fondos del sitio (`theme.css:23-25`): `--vrm-color-bg: #ffffff`, `--vrm-color-bg-alt: #f6f5f4`,
  `--vrm-color-bg-subtle: #d9e8e5`. El token se usa en 10 archivos (pie, reseñas, widget de reservas,
  formularios, cabecera, `PriceCard`, `MapEmbed`, `Dialog`), **siempre sobre esos tres fondos claros**:
  ninguna página usa `<Section variant="dark">`. Contraste del valor propuesto `#676460`: **5,88** (blanco),
  **5,40** (crema), **4,66** (verde). No hay `#7f7c76` escrito a mano en ningún otro archivo.

- `src/components/interactive/ContactForm.astro:42-43` (honeypot):

```astro
    <!-- Honeypot anti-spam (Web3Forms lo detecta nativamente) -->
    <input type="checkbox" name="botcheck" class="contact-form__botcheck" tabindex="-1" autocomplete="off" />
```

  y su CSS (`ContactForm.astro:333-340`; `tabindex: -1;` no es una propiedad CSS, es una línea inválida):

```css
  /* Ocultar honeypot */
  .contact-form__botcheck {
    position: absolute;
    left: -9999px;
    opacity: 0;
    pointer-events: none;
    tabindex: -1;
  }
```

  El JS del formulario sigue leyendo el campo (`form.querySelector('[name="botcheck"]')?.checked`): debe
  seguir en el DOM. Patrón a imitar, el honeypot del widget (`widget-render.ts:243` + `BookingDialog.astro:258`):
  `<input type="text" name="botcheck" class="bw-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">`
  con `.bw-honeypot { display: none !important; }`.

- `ContactForm.astro:259` y `:284` (mensajes tras enviar):

```astro
  <div class="cf-feedback cf-feedback--success" id={`${id}-success`} hidden aria-live="polite">
  …
  <div class="cf-feedback cf-feedback--error" id={`${id}-fail`} hidden>
```

  y en el `<script>`: `if (state === 'success') successEl?.focus(); if (state === 'fail') failEl?.focus();`

- `src/components/sections/ReservaCard.astro` (props en líneas 6-17, botón en 21-41):

```astro
  /** Si se proporciona, se usa como aria-label del botón. */
  ariaLabel?: string;
}

const { image, imageAlt, duration, price, serviceId, durationMin, ariaLabel } = Astro.props;
---

<button
  type="button"
  class="reserva-card"
  data-dialog="booking"
  data-service-id={serviceId}
  data-duration-min={durationMin}
  aria-label={ariaLabel ?? `Reservar sesión de ${duration}`}
>
  …
  <span class="reserva-card__title">Sesión de {duration}</span>
  <span class="reserva-card__price">{price}</span>
</button>
```

  Ninguna página pasa `ariaLabel`. Se usa 6 veces (2 por página de servicio) con `duration="90 minutos"`,
  `price="60€"`, etc.

- `src/components/layout/Header.astro:87-93` (enlace padre del menú de escritorio):

```astro
                <a
                  href={`${b}${item.href}`}
                  class="site-header__nav-link"
                  aria-haspopup="true"
                  aria-expanded="false"
                  aria-current={isParentActive(item) ? 'page' : undefined}
                >
```

  El submenú se muestra con `.has-dropdown:hover` / `.has-dropdown:focus-within` (`Header.astro:384-393`) y
  sus enlaces son alcanzables con Tab: solo sobra el ARIA.

- `src/components/sections/ImageCarousel.astro` — props `autoplayMs = 5000` (línea 18); flechas en 49-62;
  estilos de flecha en 105-151 (patrón de "botón de cristal" a imitar); script en 171-241 con
  `startAutoplay` (salta si `prefers-reduced-motion`), `stopAutoplay`, flechas que **no** pausan y
  `visibilitychange`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run check` | `0 errors` |
| Tests | `npm test` | todos pasan |
| Build | `npm run build` | `Complete!` |
| Preview | `npm run preview` | sirve `dist/` en http://localhost:4321/ |

`npm run build` necesita `.env`: en un worktree nuevo crea uno con `PUBLIC_GCAL_API_KEY`,
`PUBLIC_GCAL_CALENDAR_ID`, `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_WEB3FORMS_KEY_CONTACTO`,
`PUBLIC_WEB3FORMS_KEY_REGALA`, todas `=dummy`. Está en `.gitignore`: **nunca lo commitees**.

## Scope

**In scope**:
- `src/styles/theme.css` (solo la línea del token `--vrm-color-text-muted`)
- `src/components/interactive/ContactForm.astro` (el `<input … botcheck>`, la regla `.contact-form__botcheck` y los dos `<div class="cf-feedback …">` de éxito y error)
- `src/components/sections/ReservaCard.astro`
- `src/components/layout/Header.astro` (solo los dos atributos del enlace padre del menú de escritorio)
- `src/components/sections/ImageCarousel.astro`
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- Otros colores o tokens (`--vrm-color-primary-light` de los estados hover no lo evalúa Lighthouse y no entra aquí).
- `widget-render.ts` / `BookingDialog.astro`: su honeypot ya es correcto (y el widget es del plan 016).
- Las páginas que usan `ReservaCard` o `ImageCarousel` (no hace falta cambiarlas).
- El menú móvil de `Header.astro` (sus `aria-expanded` sí los actualiza el script).
- Cualquier regla CSS que use el token: se corrige cambiando **solo** el valor del token.

## Git workflow

- Branch: `advisor/013-a11y`.
- Un commit por arreglo (6). Español, imperativo, ≤70 caracteres. Ejemplo: `Oscurecer texto secundario para cumplir contraste AA`.
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Línea base

`npm ci`, `.env` ficticio, `npm run build`.

**Verify**: `grep -l "7f7c76" dist/_astro/*.css | wc -l` → `≥1` (el color actual está en el CSS generado).

### Step 2: Oscurecer el token de texto secundario

En `theme.css:19`, cambia `#7f7c76` por `#676460` (deja el comentario igual).

**Verify** — el contraste cumple AA sobre los tres fondos:

```
node -e "const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};const cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};const m=require('fs').readFileSync('src/styles/theme.css','utf8').match(/--vrm-color-text-muted:\s*(#[0-9a-fA-F]{6})/)[1];for(const bg of ['#ffffff','#f6f5f4','#d9e8e5'])console.log(m,bg,cr(m,bg).toFixed(2),cr(m,bg)>=4.5?'OK':'FAIL')"
```

→ tres líneas terminadas en `OK` (5.88, 5.40, 4.66) · `grep -rn "7f7c76" src` → sin resultados.

### Step 3: Sacar el honeypot del árbol de accesibilidad

1. En `ContactForm.astro`, añade `aria-hidden="true"` al input:

```astro
    <input type="checkbox" name="botcheck" class="contact-form__botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" />
```

2. Sustituye la regla `.contact-form__botcheck` completa (incluida la línea inválida `tabindex: -1;`) por:

```css
  /* Ocultar honeypot (fuera también del árbol de accesibilidad) */
  .contact-form__botcheck {
    display: none;
  }
```

**Verify**: `grep -c 'name="botcheck".*aria-hidden="true"' src/components/interactive/ContactForm.astro` → `1` ·
`grep -n "tabindex: -1" src/components/interactive/ContactForm.astro` → sin resultados ·
`npm run build` → OK · `grep -o 'name="botcheck"[^>]*aria-hidden="true"' dist/contacto/index.html | wc -l` → `1`.

### Step 4: Que el nombre de las tarjetas de reserva contenga su texto visible

En `ReservaCard.astro`:

1. Borra la prop `ariaLabel` (el comentario JSDoc y la línea `ariaLabel?: string;`) y quítala de la desestructuración:

```ts
const { image, imageAlt, duration, price, serviceId, durationMin } = Astro.props;
```

2. Cambia el atributo del botón por:

```astro
  aria-label={`Reservar sesión de ${duration}, ${price}`}
```

   (El texto visible es "Sesión de {duration}" + "{price}"; el nombre accesible pasa a contenerlo entero.
   No toques el `alt` de la imagen.)

**Verify**: `npm run check` → 0 errors · `npm run build` → OK ·
`grep -o 'aria-label="Reservar sesión de [^"]*"' dist/masaje-californiano-relajante/index.html` →
tres líneas: `aria-label="Reservar sesión de masaje"` (el botón "Reserva" de la cabecera, que ya cumple y no
se toca), `aria-label="Reservar sesión de 90 minutos, 60€"` y `aria-label="Reservar sesión de 120 minutos, 80€"`.

### Step 5: Quitar el ARIA de menú del enlace padre del escritorio

En `Header.astro`, en el `<a class="site-header__nav-link">` de los elementos con submenú (el que tiene
`aria-haspopup`), borra estas dos líneas y deja todo lo demás:

```astro
                  aria-haspopup="true"
                  aria-expanded="false"
```

**Verify**: `grep -c "aria-haspopup" src/components/layout/Header.astro` → `0` · `npm run build` → OK ·
`grep -c "aria-haspopup" dist/index.html` → `0` · el menú móvil sigue teniendo sus `aria-expanded`:
`grep -c 'aria-expanded' src/components/layout/Header.astro` → `≥2`.

### Step 6: Que los mensajes del formulario reciban el foco

En `ContactForm.astro`, añade `tabindex="-1"` a los dos contenedores de resultado:

```astro
  <div class="cf-feedback cf-feedback--success" id={`${id}-success`} hidden aria-live="polite" tabindex="-1">
```
```astro
  <div class="cf-feedback cf-feedback--error" id={`${id}-fail`} hidden tabindex="-1">
```

(El script ya llama a `focus()` sobre ellos; con `tabindex="-1"` empieza a funcionar. No se añade `outline`
ni se toca el script.)

**Verify**: `grep -c 'cf-feedback--success".*tabindex="-1"\|cf-feedback--error".*tabindex="-1"' src/components/interactive/ContactForm.astro` → `2`.

### Step 7: Botón de pausa en el carrusel (WCAG 2.2.2)

En `ImageCarousel.astro`:

1. **Marcado** — dentro del fragmento `{images.length > 1 && ( <> … </> )}`, justo después del botón
   `carousel__arrow--next` y antes de `</>`, añade:

```astro
      {autoplayMs > 0 && (
        <button type="button" class="carousel__toggle" data-carousel-toggle data-state="playing" aria-label="Pausar el pase automático de imágenes">
          <svg class="carousel__icon carousel__icon--pause" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>
          </svg>
          <svg class="carousel__icon carousel__icon--play" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      )}
```

2. **Estilos** — después de la regla `.carousel__arrow:active { … }`:

```css
  /* ── Pausa / reanudar (WCAG 2.2.2) ───────────────────────── */
  .carousel__toggle {
    position: absolute;
    right: var(--vrm-space-md);
    bottom: var(--vrm-space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background-color: rgb(255 255 255 / 0.4);
    color: #fff;
    border: 1px solid rgb(255 255 255 / 0.4);
    border-radius: 50%;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
    cursor: pointer;
    z-index: 2;
    -webkit-backdrop-filter: blur(8px) saturate(1.4);
    backdrop-filter: blur(8px) saturate(1.4);

    &:hover,
    &:focus-visible {
      background-color: rgb(255 255 255 / 0.85);
      color: var(--vrm-color-primary);
      outline: none;
    }
  }

  .carousel__toggle[data-state="playing"] .carousel__icon--play,
  .carousel__toggle[data-state="paused"] .carousel__icon--pause {
    display: none;
  }
```

3. **Script** — en el tipo `Carousel`, añade dos campos tras `timer: number | null;`:

```ts
    /** Pausado por el usuario (botón) o por preferir movimiento reducido. */
    paused: boolean;
    toggle: HTMLButtonElement | null;
```

   En `setup()`, sustituye `return { el, track, slides, autoplayMs, timer: null };` por:

```ts
    const paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toggle = el.querySelector<HTMLButtonElement>('[data-carousel-toggle]');
    return { el, track, slides, autoplayMs, timer: null, paused, toggle };
```

   En `startAutoplay()`, sustituye estas tres líneas:

```ts
    if (c.autoplayMs <= 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
```

   por:

```ts
    if (c.autoplayMs <= 0 || c.paused) return;
```

   Y dentro del `forEach` final, sustituye el bloque que empieza por el comentario
   `// Pausar SOLO cuando la pestaña no es visible` (hasta `startAutoplay(c);` incluido) por:

```ts
    // Botón de pausa: el usuario detiene o reanuda el pase automático.
    const syncToggle = () => {
      if (!c.toggle) return;
      c.toggle.dataset.state = c.paused ? 'paused' : 'playing';
      c.toggle.setAttribute('aria-label', c.paused
        ? 'Reanudar el pase automático de imágenes'
        : 'Pausar el pase automático de imágenes');
    };
    c.toggle?.addEventListener('click', () => {
      c.paused = !c.paused;
      if (c.paused) stopAutoplay(c);
      else startAutoplay(c);
      syncToggle();
    });
    syncToggle();

    // Mientras el ratón o el foco están dentro, no se mueve (se reanuda al salir si no está pausado).
    el.addEventListener('mouseenter', () => stopAutoplay(c));
    el.addEventListener('mouseleave', () => startAutoplay(c));
    el.addEventListener('focusin', () => stopAutoplay(c));
    el.addEventListener('focusout', (e) => {
      if (!el.contains(e.relatedTarget as Node | null)) startAutoplay(c);
    });

    // Pestaña oculta: parar (ahorro de recursos); al volver, reanudar si no está pausado.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay(c);
      else startAutoplay(c);
    });

    startAutoplay(c);
```

**Verify**: `npm run check` → 0 errors · `npm run build` → OK ·
`grep -o '<button[^>]*data-carousel-toggle' dist/masaje-californiano-relajante/index.html | wc -l` → `1` ·
`grep -c "Pausar SOLO cuando" src/components/sections/ImageCarousel.astro` → `0`.

Prueba manual (`npm run preview`, `/masaje-californiano-relajante/`): el carrusel avanza solo; al pasar el
ratón por encima se detiene; el botón de abajo a la derecha lo pausa (icono de "play") y lo reanuda; con
Tab hasta las flechas, no se mueve mientras el foco está dentro.

### Step 8: Verificación final (y Lighthouse si hay Chrome)

**Verify**: `npm run check` → 0 errors · `npm test` → pasa · `npm run build` → OK.

Opcional, si la máquina tiene Chrome: con `npm run preview` en marcha,

```
npx -y lighthouse http://localhost:4321/contacto/ --only-categories=accessibility --chrome-flags="--headless=new" --output=json --output-path=./lh-a11y.json --quiet
node -e "const r=require('./lh-a11y.json');console.log(Math.round(r.categories.accessibility.score*100),['color-contrast','label','label-content-name-mismatch'].map(k=>k+':'+r.audits[k].score).join(' '))"
```

→ `100 color-contrast:1 label:1 label-content-name-mismatch:null` (o `:1`). Repite con
`/masaje-californiano-relajante/` (esperado `label-content-name-mismatch:1`). **Borra `lh-a11y.json`
después**: no se commitea.

## Test plan

Sin tests unitarios (CSS, atributos y un script inline de componente). La red de seguridad son las
comprobaciones de cada paso, las pruebas manuales del Step 7 y, si hay Chrome, Lighthouse. Comprobación
visual con `npm run preview`: el pie y las reseñas tienen el gris un poco más oscuro (esperado); el
formulario de `/contacto/` se ve igual y envía; al enviar con teclado, el foco queda en el mensaje de
resultado.

## Done criteria

- [ ] `theme.css`: `--vrm-color-text-muted: #676460`; el script del Step 2 imprime 3 × `OK`
- [ ] `grep -rn "7f7c76" src` → sin resultados
- [ ] Honeypot con `aria-hidden="true"` y `display: none`; sin la línea `tabindex: -1;` en el CSS
- [ ] `ReservaCard` sin prop `ariaLabel`; `aria-label` = `Reservar sesión de {duration}, {price}`
- [ ] Sin `aria-haspopup` en `Header.astro`
- [ ] Mensajes de éxito y error del formulario con `tabindex="-1"`
- [ ] Carrusel con botón de pausa, pausa al pasar el ratón o el foco, y respeta "reducir movimiento"
- [ ] `npm run check` 0 errors · `npm test` pasa · `npm run build` OK
- [ ] `git status` sin cambios fuera del Scope (y sin `.env` ni `lh-a11y.json`)
- [ ] Fila 013 de `plans/README.md` actualizada

## STOP conditions

Para y reporta si:

- Encuentras algún uso de `--vrm-color-text-muted` sobre un fondo oscuro (`variant="dark"`, fondos
  `--vrm-color-primary`, imágenes): oscurecer el token empeoraría ahí el contraste.
- Tras el Step 3 el formulario deja de enviarse en `npm run preview` (el JS depende de `[name="botcheck"]`).
- Tras el Step 5 el submenú de escritorio deja de abrirse con el ratón o con Tab (no debería: se abre por CSS).
- Lighthouse (si lo ejecutas) sigue marcando `color-contrast` con un color distinto de `#676460`:
  es otro token y queda fuera de este plan; repórtalo.

## Maintenance notes

- Regla para el futuro: cualquier texto sobre `--vrm-color-bg-subtle` (`#d9e8e5`) queda justo por
  encima de 4,5:1 con el nuevo gris (4,66). No aclarar más el token ni usarlo en texto de menos de 12px.
- Si algún día se usa `<Section variant="dark">`, el texto secundario ahí debe usar otro token (claro).
- Nuevos botones con `aria-label`: el nombre debe **contener** el texto visible (WCAG 2.5.3).
- Cualquier contenido que se mueva solo más de 5 s (carruseles, marquesinas, vídeo en bucle) necesita un
  control de pausa visible.
- Revisor: comparar a ojo el pie antes/después (el cambio de gris es intencionado) y probar el carrusel con
  teclado.
