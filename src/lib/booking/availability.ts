/**
 * Generación de slots de disponibilidad.
 * Lee las reglas semanales del JSON en repo y filtra con freebusy.
 * C2: freebusy devuelve vacío (todos los slots de regla están libres).
 * C3: se conecta gcal.ts para freebusy real.
 */

import type { ServiceId, Slot, TimeRange } from './types.ts';
import { BUFFER_MIN, MIN_ADVANCE_HOURS, MAX_DAYS_AHEAD, SLOT_STEP_MIN } from './config.ts';
import rulesData from '../../content/booking/availability-rules.json';

// ── Helpers de tiempo ────────────────────────────────────────────────────────

/**
 * Devuelve el offset en minutos de la zona Europe/Madrid para una fecha dada.
 * Positivo = adelantado respecto a UTC (+60 en invierno, +120 en verano).
 */
function getMadridOffsetMin(year: number, month1: number, day: number): number {
  const utcNoon = Date.UTC(year, month1 - 1, day, 12, 0, 0);
  const d = new Date(utcNoon);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const madridLocalMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), 0);
  return (madridLocalMs - utcNoon) / 60_000;
}

/**
 * Construye un ISO 8601 con offset explícito para un slot en Europe/Madrid.
 * Ejemplo: 2026-05-12T16:30:00+02:00
 */
function buildISO(year: number, month0: number, day: number, hhmm: string): string {
  const offsetMin = getMadridOffsetMin(year, month0 + 1, day);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  const [h, m] = hhmm.split(':');
  return [
    `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    `T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00${sign}${oh}:${om}`,
  ].join('');
}

/** Convierte 'HH:mm' a minutos desde medianoche. */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Añade minutos a 'HH:mm' y devuelve 'HH:mm'. */
function addMin(hhmm: string, mins: number): string {
  const total = toMin(hhmm) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Devuelve true si [aStart,aEnd) solapa con [bStart,bEnd) incluyendo buffer. */
function overlaps(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
  buffer: number,
): boolean {
  return aStart < bEnd + buffer && aEnd > bStart - buffer;
}

// ── Carga de reglas ──────────────────────────────────────────────────────────

type RuleEntry = { serviceId: string; weekly: Record<string, TimeRange[]> };
const rulesMap = new Map<string, RuleEntry>(
  (rulesData as RuleEntry[]).map((r) => [r.serviceId, r]),
);

function getRangesForDay(serviceId: string, weekday: number): TimeRange[] {
  const rule = rulesMap.get(serviceId);
  if (!rule) return [];
  return rule.weekly[String(weekday) as keyof typeof rule.weekly] ?? [];
}

// ── API pública ──────────────────────────────────────────────────────────────

/** Resultado de consulta de disponibilidad por mes. */
export interface MonthAvailability {
  /** YYYY-MM-DD → slots libres */
  days: Map<string, Slot[]>;
}

/**
 * Devuelve los slots disponibles para un servicio en un mes concreto.
 * @param serviceId - ID del servicio (ej: 'californiano-90')
 * @param durationMin - Duración en minutos
 * @param year - Año (ej: 2026)
 * @param month0 - Mes 0-indexado (0 = enero, 11 = diciembre)
 * @param busy - Franjas ocupadas (de GCal). En C2 se pasa [].
 */
export function getMonthAvailability(
  serviceId: ServiceId,
  durationMin: number,
  year: number,
  month0: number,
  busy: TimeRange[] = [],
): MonthAvailability {
  const now = Date.now();
  const minAdvanceMs = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
  const maxFutureMs = MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const result = new Map<string, Slot[]>();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, month0, day).getDay(); // 0=dom..6=sab
    const ranges = getRangesForDay(serviceId, weekday);
    if (!ranges.length) continue;

    const freeSlots: Slot[] = [];

    for (const range of ranges) {
      let cursor = range.start;
      while (true) {
        const slotEndHHmm = addMin(cursor, durationMin);
        if (toMin(slotEndHHmm) > toMin(range.end)) break;

        const startISO = buildISO(year, month0, day, cursor);
        const endISO = buildISO(year, month0, day, slotEndHHmm);
        const startMs = new Date(startISO).getTime();
        const endMs = new Date(endISO).getTime();

        // Filtrar pasado + margen mínimo
        if (startMs < now + minAdvanceMs) {
          cursor = addMin(cursor, SLOT_STEP_MIN);
          continue;
        }

        // Filtrar demasiado futuro
        if (startMs > now + maxFutureMs) break;

        // Filtrar conflictos con freebusy + buffer
        const startMinOfDay = toMin(cursor);
        const endMinOfDay = toMin(slotEndHHmm);
        const blocked = busy.some((b) => {
          const bStart = toMin(new Date(b.start).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
          }));
          const bEnd = toMin(new Date(b.end).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
          }));
          return overlaps(startMinOfDay, endMinOfDay, bStart, bEnd, BUFFER_MIN);
        });

        if (!blocked) {
          freeSlots.push({ startISO, endISO, serviceId });
        }

        cursor = addMin(cursor, SLOT_STEP_MIN);
      }
    }

    if (freeSlots.length) result.set(dateKey, freeSlots);
  }

  return { days: result };
}

/**
 * Formatea un ISO string para mostrarlo al usuario en Europe/Madrid.
 * Devuelve ej: { date: 'lunes, 12 de mayo de 2026', time: '16:30' }
 */
export function formatSlot(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return { date, time };
}
