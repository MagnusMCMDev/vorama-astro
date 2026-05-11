/**
 * Wrapper de Google Calendar FreeBusy API.
 * Sólo lee libre/ocupado — nunca detalles de eventos.
 * Incluye caché en sessionStorage con TTL de 60 s por (calendarioId, mes).
 */

import { GCAL_API_KEY, GCAL_CALENDAR_ID, GCAL_FREEBUSY_URL, FREEBUSY_CACHE_TTL_MS } from './config.ts';

// ── Tipos de la respuesta GCal ────────────────────────────────────────────────

interface BusyInterval {
  start: string; // ISO 8601
  end:   string;
}

interface FreeBusyResponse {
  calendars: Record<string, { busy: BusyInterval[]; errors?: unknown[] }>;
}

// ── Caché sessionStorage ──────────────────────────────────────────────────────

interface CacheEntry {
  ts:   number;          // timestamp de la petición
  busy: BusyInterval[];  // intervalos ocupados
}

function cacheKey(year: number, month0: number): string {
  return `booking:freebusy:${year}-${String(month0 + 1).padStart(2, '0')}`;
}

function readCache(year: number, month0: number): BusyInterval[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(year, month0));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > FREEBUSY_CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(year, month0));
      return null;
    }
    return entry.busy;
  } catch {
    return null;
  }
}

function writeCache(year: number, month0: number, busy: BusyInterval[]): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), busy };
    sessionStorage.setItem(cacheKey(year, month0), JSON.stringify(entry));
  } catch {
    // sessionStorage lleno o no disponible — ignorar, no es crítico
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve los intervalos ocupados del calendario de Miguel para el mes indicado.
 * Usa caché de 60 s en sessionStorage para reducir peticiones.
 *
 * En desarrollo local (import.meta.env.DEV) omite la llamada y devuelve array vacío,
 * ya que la API key tiene restricción de HTTP referrer que bloquea localhost.
 *
 * @param year   Año (ej. 2026)
 * @param month0 Mes 0-indexado (0 = enero … 11 = diciembre)
 * @throws Error con código 'GCAL_DOWN' | 'OFFLINE' si no se puede obtener la info
 */
export async function fetchBusy(year: number, month0: number): Promise<BusyInterval[]> {
  // En dev: la API key rechaza peticiones sin referrer de producción → mock vacío
  if (import.meta.env.DEV) {
    console.info('[gcal] DEV mode — freebusy mock vacío (todos los slots libres)');
    return [];
  }

  // 1. Caché
  const cached = readCache(year, month0);
  if (cached) return cached;

  // 2. Rango del mes completo en UTC — suficiente para filtrar slots con offset Madrid
  const timeMin = new Date(Date.UTC(year, month0, 1)).toISOString();
  const timeMax = new Date(Date.UTC(year, month0 + 1, 1)).toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${GCAL_FREEBUSY_URL}?key=${GCAL_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: GCAL_CALENDAR_ID }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // 403 → API key inválida / restricción de dominio no configurada
      // 404 → calendar ID incorrecto
      console.error('[gcal] HTTP error', res.status, res.statusText);
      throw new Error('GCAL_DOWN');
    }

    const json: FreeBusyResponse = await res.json();
    const calData = json.calendars?.[GCAL_CALENDAR_ID];

    if (!calData) {
      console.error('[gcal] Calendar ID not found in response', GCAL_CALENDAR_ID);
      throw new Error('GCAL_DOWN');
    }

    if (calData.errors?.length) {
      console.error('[gcal] Calendar errors', calData.errors);
      throw new Error('GCAL_DOWN');
    }

    const busy = calData.busy ?? [];
    writeCache(year, month0, busy);
    return busy;

  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && (err.message === 'GCAL_DOWN' || err.message === 'OFFLINE')) {
      throw err;
    }
    // AbortError (timeout) o NetworkError (sin conexión)
    if (!navigator.onLine) throw new Error('OFFLINE');
    throw new Error('GCAL_DOWN');
  }
}
