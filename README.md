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
