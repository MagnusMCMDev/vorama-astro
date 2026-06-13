# Component Inventory — Voramà Astro

> Inventario de los componentes a crear, su API y dónde se usan.
> Última revisión: 2026-05-08.

## Convención

- **Path** del archivo en `src/components/<grupo>/<Nombre>.astro`.
- **Props** tipadas con interface TypeScript.
- **Usado en** indica las páginas que lo consumirán.
- **Notas** = decisiones de diseño no obvias.

## Resumen

3 grupos, 16 componentes:

- **Layout** (4): Header, Footer, WhatsAppFloating, SEO.
- **Sections** (8): Section, HeroBanner, PriceCard, CardCTA, IconBox, AccordionFAQ, Reviews, ImageCarousel.
- **Interactive** (3): Dialog, LegalDialog, ContactForm.  · **Booking**: BookingDialog (`src/components/booking/`) + librería `src/lib/booking/*.ts`.

---

# Grupo: Layout

## `SEO.astro`

> **Obsoleto:** no existe un `SEO.astro`. La lógica SEO está inline en `src/layouts/BaseLayout.astro` (cabecera `<head>`, props `title`/`description`/`canonical`/`ogImage`/`jsonLd`).

**Path:** `src/components/layout/SEO.astro`.

**Función:** centraliza todo el `<head>` SEO. Único punto de verdad para meta, OG, Twitter, JSON-LD, favicon.

**Props:**
```ts
interface Props {
  title: string;                  // sin sufijo " — Voramà Terapias", se añade aquí
  description: string;            // < 160 chars
  canonical?: string;             // default: Astro.url.toString()
  ogImage?: ImageMetadata;        // default: og-default.webp
  noindex?: boolean;              // default: false
  jsonLd?: object[];              // schemas extra (Service, FAQPage)
}
```

**Salida** (resumen):
- `<title>{title} — Voramà Terapias</title>`
- `<meta name="description">`
- `<link rel="canonical">`
- `<meta name="robots">` (con `noindex,nofollow` si aplica)
- OG completo (type, site_name, locale, title, description, url, image)
- Twitter Card (summary_large_image)
- Favicon set (5 declaraciones + manifest + theme-color)
- `<meta name="referrer">`
- 1 `<script type="application/ld+json">` con LocalBusiness compact
- N adicionales para cada `jsonLd[i]`

**Usado en:** todas las páginas (vía BaseLayout).

**Notas:**
- LocalBusiness se genera con `buildLocalBusinessJsonLd()` de `~/utils/seo.ts` leyendo `SITE_CONFIG`.
- `ogImage` debe ser absoluta en el `<meta>`. Astro `Image` no se usa aquí — se pasa la URL final.

---

## `Header.astro`

**Path:** `src/components/layout/Header.astro`.

**Función:** cabecera principal del sitio. Logo + navegación primaria + secundaria + CTA "Reserva".

**Props:** ninguna (lee menú desde un array constante o desde `SITE_CONFIG.menu`).

**Estructura:**
- `<header>` semántico con `role="banner"` implícito.
- Logo SVG (link a /).
- `<nav aria-label="Principal">` con menú primario (5-6 items).
- `<nav aria-label="Secundaria">` con menú secundario (3-4 items, en algunas variantes).
- Botón CTA "Reserva" (abre BookingDialog).
- Variante mobile: drawer con `<details>` o JS mínimo.

**Comportamiento:**
- Sticky on scroll: `IntersectionObserver` con sentinel; cuando sentinel sale del viewport, añade clase `.is-stuck`.
- Mobile menu: toggle con `aria-expanded`. Cierra al clicar enlace.
- `prefers-reduced-motion`: deshabilita transiciones.

**Usado en:** BaseLayout (en todas las páginas).

**Notas:**
- Antes en WP: ~250 líneas de wrapper Astra anidado. Aquí: ~80 líneas estimadas.
- Mantener clases descriptivas (`.site-header`, `.site-header__nav`).

---

## `Footer.astro`

**Path:** `src/components/layout/Footer.astro`.

**Función:** footer institucional con info de contacto, ubicaciones, redes y enlaces legales.

**Props:** ninguna (lee `SITE_CONFIG`).

**Estructura:**
- `<footer>` semántico.
- 4 columnas (grid responsive):
  1. Logo + slogan corto.
  2. Ubicación (dirección + enlace mapa).
  3. Contacto (teléfono + email + WhatsApp).
  4. Redes sociales (Instagram + IconBox).
- Línea inferior: copyright + 3 links legales (que disparan LegalDialog).

**Usado en:** BaseLayout.

**Notas:**
- Los 3 links legales son `<button data-open="privacidad">` (no `<a>` con `javascript:void(0)`). El JS de Dialog escucha `[data-open]`.

---

## `WhatsAppFloating.astro`

**Path:** `src/components/layout/WhatsAppFloating.astro`.

**Función:** botón flotante con icono WhatsApp en bottom-right, ocupa todas las páginas.

**Props:** ninguna.

**Estructura:**
- `<a href="https://wa.me/{telephone}" target="_blank" rel="noopener" aria-label="Abrir chat WhatsApp">`.
- Icono SVG inline (no imagen externa).
- Fixed bottom-right con z-index alto.
- Animación pulse opcional con `prefers-reduced-motion: no-preference`.

**Usado en:** BaseLayout.

**Notas:**
- En el WP estático actual era un widget Elementor pesado (`elementor-widget-contact-buttons-var-5`). Aquí ~30 líneas.

---

# Grupo: Sections

## `Section.astro`

**Path:** `src/components/sections/Section.astro`.

**Función:** wrapper estándar para secciones de página, con padding y backgrounds consistentes.

**Props:**
```ts
interface Props {
  variant?: 'default' | 'muted' | 'dark' | 'accent';
  padding?: 'sm' | 'md' | 'lg' | 'xl';   // default: 'lg'
  id?: string;                            // para anclas
  ariaLabel?: string;
}
```

**Estructura:**
```astro
<section class:list={[`section section--${variant}`, `section--p-${padding}`]} id={id} aria-label={ariaLabel}>
  <div class="section__inner">
    <slot />
  </div>
</section>
```

**Usado en:** la mayoría de páginas para envolver bloques.

**Notas:**
- `.section__inner` con `max-width: var(--vrm-bp-desktop)` y `margin-inline: auto`.

---

## `HeroBanner.astro`

**Path:** `src/components/sections/HeroBanner.astro`.

**Función:** hero principal de cada landing. Imagen + título + lead + CTA.

**Props:**
```ts
interface Props {
  kicker?: string;            // texto pequeño antes del h1 ("Bienvenido a Voramà")
  title: string;              // h1
  lead?: string;
  cta?: { label: string; href: string };
  image: ImageMetadata;
  imageAlt: string;
  variant?: 'cover' | 'split';   // default: 'cover'
}
```

**Variantes:**
- `cover`: imagen full-bleed con overlay, texto centrado encima (home).
- `split`: 50/50 imagen + texto (sobre-mi, servicios).

**Comportamiento:**
- Hero image siempre con `loading="eager"` + `fetchpriority="high"`.
- BaseLayout añade `<link rel="preload">` para esta imagen automáticamente si la página declara su `lcpImage`.

**Usado en:** home + las 4 landings de servicio + sobre-mi + sobre-masaje + faqs + regala-masaje + contacto + aprende.

**Notas:**
- 1 `<h1>` por página, garantizado.
- Kicker es `<p class="hero-banner__kicker">`, NO `<h6>` (lección aprendida del WP).

---

## `PriceCard.astro`

**Path:** `src/components/sections/PriceCard.astro`.

**Función:** tarjeta de precio para tabla de servicios.

**Props:**
```ts
interface Props {
  title: string;
  price: string;            // "65€"
  duration: string;         // "75 min"
  bullets: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}
```

**Estructura:**
```astro
<article class:list={['price-card', highlighted && 'price-card--featured']}>
  <header>
    <h3>{title}</h3>
    <p class="price-card__duration">{duration}</p>
  </header>
  <p class="price-card__price">{price}</p>
  <ul>
    {bullets.map(b => <li>{b}</li>)}
  </ul>
  <a class="btn" href={cta.href}>{cta.label}</a>
</article>
```

**Usado en:** servicios-masaje-californiano (tabla `Oferta-Masaje`), masajes individuales.

---

## `CardCTA.astro`

**Path:** `src/components/sections/CardCTA.astro`.

**Función:** card con imagen de fondo + título + botón. Patrón "card-skin cover" del WP.

**Props:**
```ts
interface Props {
  title: string;
  cta: { label: string; href: string };
  image: ImageMetadata;
  imageAlt: string;
}
```

**Estructura:**
```astro
<article class="card-cta">
  <Image src={image} alt={imageAlt} class="card-cta__bg" />
  <div class="card-cta__overlay">
    <h3>{title}</h3>
    <a class="btn btn--ghost" href={cta.href}>{cta.label}</a>
  </div>
</article>
```

**Usado en:** home (3 cards de masaje), masaje-relajante / cuatro-manos / dos.

**Notas:**
- `text-shadow` o `linear-gradient` overlay para contraste sobre la imagen.

---

## `IconBox.astro`

**Path:** `src/components/sections/IconBox.astro`.

**Función:** icono SVG + título + descripción. Para grids de beneficios o info de contacto.

**Props:**
```ts
interface Props {
  icon: 'whatsapp' | 'mail' | 'instagram' | 'location' | 'clock' | 'check' | 'star';
  title: string;
  description?: string;
  href?: string;             // hace toda la card clickable si está
}
```

**Estructura:**
- Si `href`: el wrapper es `<a>`. Si no: `<div>` con foco no necesario.
- Icono SVG inline (definido en `src/assets/icons/<name>.svg` o sprite).

**Usado en:** sobre-masaje (beneficios), masaje-relajante / dos / cuatro / eventos (beneficios), contacto (canales).

---

## `AccordionFAQ.astro`

**Path:** `src/components/sections/AccordionFAQ.astro`.

**Función:** acordeón de FAQs. `<details>/<summary>` nativo, sin JS.

**Props:**
```ts
interface Props {
  items: { question: string; answer: string }[];
}
```

**Estructura:**
```astro
<div class="accordion-faq">
  {items.map(item => (
    <details class="accordion-faq__item">
      <summary>{item.question}</summary>
      <div class="accordion-faq__answer">{item.answer}</div>
    </details>
  ))}
</div>
```

**Usado en:** /faqs/.

**Notas:**
- Si se decide solo uno abierto a la vez, JS mínimo (~10 LoC).

---

## `Reviews.astro`

**Path:** `src/components/sections/Reviews.astro`.

**Función:** bloque de reseñas Google con 5 visibles + "ver más".

**Props:**
```ts
interface Props {
  variant?: 'bubble' | 'fill';        // estilo visual
  initialCount?: number;               // default: 5
}
```

**Datos:** lee de `getCollection('reviews')` directamente.

**Comportamiento:**
- Renderiza todas las reseñas pero oculta las que están más allá de `initialCount`.
- Botón "ver más" muestra el resto. JS mínimo (`hidden` toggle).

**Usado en:** home, regala-masaje.

**Notas:**
- Avatares opcional (URL `gstatic` o `googleusercontent` — verificar disponibilidad).
- Tipografía de reseñas: `font-style: italic` para citas.

---

## `ImageCarousel.astro`

**Path:** `src/components/sections/ImageCarousel.astro`.

**Función:** carrusel de imágenes con scroll-snap CSS. Sin librería externa, sin Swiper.

**Props:**
```ts
interface Props {
  images: { src: ImageMetadata; alt: string }[];
  autoplay?: boolean;       // default: false
  showDots?: boolean;       // default: true
}
```

**Estructura:**
```astro
<div class="carousel" role="region" aria-label="Galería">
  <div class="carousel__track">
    {images.map((img, i) => (
      <figure class="carousel__slide">
        <Image src={img.src} alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} />
      </figure>
    ))}
  </div>
  {showDots && <ol class="carousel__dots">...</ol>}
</div>
```

**Comportamiento:**
- `scroll-snap-type: x mandatory` en track, `scroll-snap-align: start` en slides.
- Dots con `<a href="#slide-1">` (anchors al ID del slide). 0 JS necesario.
- Autoplay opcional con JS mínimo.

**Usado en:** masaje-relajante, cuatro-manos, dos, eventos-negocios.

**Notas:**
- Si Safari iOS da problemas con scroll-snap, fallback con flex + JS swipe.

---

# Grupo: Interactive

## `Dialog.astro`

**Path:** `src/components/interactive/Dialog.astro`.

**Función:** componente base para modales. Usa `<dialog>` nativo.

**Props:**
```ts
interface Props {
  id: string;                  // único, lo abren botones con `data-open={id}`
  ariaLabel: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Slot:** contenido del modal.

**Comportamiento JS** (en BaseLayout o en este componente):
```js
document.querySelectorAll('[data-open]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.open)?.showModal();
  });
});
```

**Usado en:** base de LegalDialog y BookingDialog.

**Notas:**
- Cierre con tecla Escape (nativo de `<dialog>`).
- Cerrar al clic fuera: JS opcional (~10 LoC).
- Foco se gestiona automáticamente por el browser.

---

## `LegalDialog.astro`

**Path:** `src/components/interactive/LegalDialog.astro`.

**Función:** modal de contenido legal. Carga el .md correspondiente de la collection.

**Props:**
```ts
interface Props {
  slug: 'privacidad' | 'cookies' | 'aviso-legal';
}
```

**Datos:**
```ts
const entry = await getEntry('legal', slug);
const { Content } = await entry.render();
```

**Estructura:**
```astro
<Dialog id={`dialog-${slug}`} ariaLabel={entry.data.title}>
  <h2>{entry.data.title}</h2>
  <Content />
</Dialog>
```

**Usado en:** BaseLayout (3 instancias: privacidad, cookies, aviso-legal).

---

## `CalendlyDialog.astro`

> **Eliminado.** Calendly se sustituyó por el sistema de reservas propio (BookingDialog + `src/lib/booking/`). Mantenido aquí solo como referencia histórica.

**Path:** `src/components/interactive/CalendlyDialog.astro`.

**Función:** modal de Calendly. Carga el script `widget.js` solo cuando se abre.

**Props:** ninguna.

**Comportamiento:**
- Botones que disparan: `<button data-open="calendly">`.
- Al primer abrir, inyecta `<script src="https://assets.calendly.com/assets/external/widget.js" async>` y monta el iframe en el dialog body.
- Aperturas siguientes: el script ya está, solo abre el dialog.

**Estructura:**
```astro
<Dialog id="calendly" ariaLabel="Reserva tu sesión">
  <div id="calendly-mount"></div>
</Dialog>

<script>
  // lazy script + Calendly.initInlineWidget en abrir
</script>
```

**Usado en:** BaseLayout (única instancia).

**Notas:**
- Mantener el flow actual del WP estático. Ningún cambio funcional para el usuario.

---

## `ContactForm.astro`

**Path:** `src/components/interactive/ContactForm.astro`.

**Función:** formulario que al submit abre WhatsApp con mensaje pre-rellenado.

**Props:**
```ts
interface Props {
  variant: 'contacto' | 'regala';   // distintos campos
}
```

**Estructura:** `<form action="https://wa.me/{telephone}" method="GET" target="_blank">` con campos según variante. Botón submit "Enviar por WhatsApp".

**JS interceptor:**
```js
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(form);
  const message = composeMessage(data, variant);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(message)}`, '_blank');
});
```

**Validación:** HTML5 nativa (`required`, `type="email"`, etc.). Sin librería de validación.

**Usado en:** /contacto/, /regala-masaje/.

**Notas:**
- Mantiene el patrón actual del WP estático (decisión M1 del proyecto anterior).
- Si JS falla, el `action` fallback abre WhatsApp con todos los campos en el query string.

---

# Componentes que **NO** se crean

Decisiones explícitas para evitar abstracción prematura:

- **`Heading.astro`** — uso `<h1>`, `<h2>`, etc. directamente con CSS.
- **`Button.astro`** — uso `<a class="btn">` o `<button class="btn">` directamente.
- **`Image.astro`** wrapper — uso `<Image>` de `astro:assets` directamente.
- **`MapEmbed.astro`** — solo se usa en /contacto/ (2 instancias). Se inlinea en la página.
- **`HeaderMobile.astro`** separado — el Header desktop incluye la variante mobile responsive.

Si alguno aparece duplicado en 3+ sitios durante B5/B7, **se extrae entonces**, no antes.

---

# Tracking de progreso

Tabla maestra (se mantiene actualizada durante B4–B6):

| Componente | Estado | Notas |
|---|---|---|
| SEO | ⏳ pendiente B2 | |
| BaseLayout | ⏳ pendiente B2 | |
| Header | ⏳ pendiente B4 | |
| Footer | ⏳ pendiente B4 | |
| WhatsAppFloating | ⏳ pendiente B4 | |
| Section | ⏳ pendiente B5 | |
| HeroBanner | ⏳ pendiente B5 | |
| PriceCard | ⏳ pendiente B5 | |
| CardCTA | ⏳ pendiente B5 | |
| IconBox | ⏳ pendiente B5 | |
| AccordionFAQ | ⏳ pendiente B5 | |
| Reviews | ⏳ pendiente B5 | |
| ImageCarousel | ⏳ pendiente B5 | |
| Dialog | ⏳ pendiente B6 | |
| LegalDialog | ⏳ pendiente B6 | |
| BookingDialog | ✅ hecho (reemplaza Calendly) | |
| ContactForm | ⏳ pendiente B6 | |
