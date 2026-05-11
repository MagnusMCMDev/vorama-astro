/**
 * Constantes de configuración del módulo de reservas.
 * Derivadas de variables de entorno PUBLIC_* (disponibles en cliente y en build).
 * Lanza error fatal en build si falta alguna clave obligatoria.
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `[booking/config] Variable de entorno obligatoria no encontrada: ${key}. ` +
      `Asegúrate de que está definida en .env o en los secrets de GitHub Actions.`
    );
  }
  return value as string;
}

function optionalEnvInt(key: string, defaultValue: number): number {
  const raw = import.meta.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw as string, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function optionalEnvStr(key: string, defaultValue: string): string {
  return (import.meta.env[key] as string | undefined) ?? defaultValue;
}

// ── Claves de API (obligatorias) ──────────────────────────────────────────────

export const GCAL_API_KEY      = requireEnv('PUBLIC_GCAL_API_KEY');
export const GCAL_CALENDAR_ID  = requireEnv('PUBLIC_GCAL_CALENDAR_ID');
export const WEB3FORMS_KEY     = requireEnv('PUBLIC_WEB3FORMS_KEY');

// ── Parámetros de negocio (opcionales, con defaults) ─────────────────────────

/** Minutos de margen antes y después de cada reserva (bloquea esos huecos). */
export const BUFFER_MIN         = optionalEnvInt('PUBLIC_BOOKING_BUFFER_MIN', 20);

/** Antelación mínima en horas para poder reservar desde ahora. */
export const MIN_ADVANCE_HOURS  = optionalEnvInt('PUBLIC_BOOKING_MIN_ADVANCE_HOURS', 24);

/** Máximo días vista en el calendario (el widget no muestra más allá). */
export const MAX_DAYS_AHEAD     = optionalEnvInt('PUBLIC_BOOKING_MAX_DAYS_AHEAD', 60);

/** Paso entre slots candidatos (minutos). */
export const SLOT_STEP_MIN      = optionalEnvInt('PUBLIC_BOOKING_SLOT_STEP_MIN', 15);

/** Zona horaria usada para mostrar fechas/horas al usuario. */
export const TIMEZONE           = optionalEnvStr('PUBLIC_BOOKING_TIMEZONE', 'Europe/Madrid');

/** Teléfono WhatsApp para el CTA de fallback en errores. */
export const WHATSAPP_NUMBER    = optionalEnvStr('PUBLIC_BOOKING_WHATSAPP', '+34623941891');

// ── URLs externas ─────────────────────────────────────────────────────────────

export const GCAL_FREEBUSY_URL  = 'https://www.googleapis.com/calendar/v3/freeBusy';
export const WEB3FORMS_URL      = 'https://api.web3forms.com/submit';

/** TTL en milisegundos de la caché de disponibilidad en sessionStorage. */
export const FREEBUSY_CACHE_TTL_MS = 60_000; // 60 segundos
