/**
 * Tipos de dominio del módulo de reservas.
 * Solo tipos, sin lógica. Importados desde schemas.ts (inferidos de Zod)
 * y desde los componentes booking.
 */

// ── Servicio ──────────────────────────────────────────────────────────────────

/** Identificadores contractuales de servicio. Cambiar uno es un breaking change. */
export type ServiceId =
  | 'californiano-90'
  | 'californiano-120'
  | 'cuatro-manos-60'
  | 'cuatro-manos-90'
  | 'para-dos-60'
  | 'para-dos-90';

/**
 * Tipo de masaje (sin duración). Un botón en la página corresponde a un ServiceType.
 * La duración se elige dentro del widget como primer paso.
 */
export type ServiceType = 'californiano' | 'cuatro-manos' | 'para-dos';

export interface Service {
  id: ServiceId;
  name: string;
  durationMin: number;
  priceEur: number;
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

/** Día de la semana: 0 = domingo, 1 = lunes, …, 6 = sábado */
export type WeekdayKey = '0' | '1' | '2' | '3' | '4' | '5' | '6';

/** Franja horaria expresada en HH:mm (24h). */
export interface TimeRange {
  start: string; // 'HH:mm'
  end: string;   // 'HH:mm'
}

/** Regla semanal de disponibilidad para un servicio. */
export interface AvailabilityRule {
  serviceId: ServiceId;
  weekly: Record<WeekdayKey, TimeRange[]>;
}

// ── Slot ─────────────────────────────────────────────────────────────────────

/** Hueco de tiempo concreto disponible para reservar. */
export interface Slot {
  startISO: string; // ISO 8601 con offset, ej: '2026-05-12T16:30:00+02:00'
  endISO: string;
  serviceId: ServiceId;
}

// ── Reserva (transitoria) ─────────────────────────────────────────────────────

export interface Customer {
  name: string;
  email: string;
  phone: string;
  notes?: string;
  consentRgpd: true;
}

/** Payload completo que se envía a Web3Forms. */
export interface BookingRequest {
  serviceId: ServiceId;
  startISO: string;
  customer: Customer;
  /** Honeypot: debe llegar vacío. Si contiene algo, es un bot. */
  hp_website: string;
}

// ── Estado del widget ─────────────────────────────────────────────────────────

/**
 * Pasos del widget.
 * Flujo directo:  calendar → form → summary → success|error
 * Flujo hub:      duration → calendar → form → summary → success|error
 */
export type BookingStep = 'duration' | 'calendar' | 'form' | 'summary' | 'success' | 'error';

/**
 * Opciones de montaje del widget.
 *
 * - `direct`: el botón ya sabe qué servicio y duración. Va directo al calendario.
 *   Uso: botones en páginas de servicio (data-service-id + data-duration-min).
 *
 * - `hub`: muestra primero el selector de duración con todos los servicios disponibles.
 *   Uso: botón "Reserva" del header, CTAs genéricos.
 */
export type MountOptions =
  | { mode: 'direct'; serviceId: ServiceId; durationMin: number }
  | { mode: 'hub'; serviceType?: ServiceType };

// ── Errores ───────────────────────────────────────────────────────────────────

export type BookingErrorCode =
  | 'GCAL_DOWN'     // Google Calendar no responde o da error
  | 'SUBMIT_FAILED' // Web3Forms no responde o da error
  | 'OFFLINE'       // Sin conexión a internet
  | 'INVALID_SLOT'; // El slot ya no está disponible al enviar
