/**
 * Envío de solicitud de reserva a Web3Forms.
 * C2: stub que simula un envío exitoso tras 800 ms.
 * C3: se reemplaza por el POST real a api.web3forms.com.
 */

import type { BookingRequest, Service } from './types.ts';
import { BookingRequestSchema } from './schemas.ts';
import { WEB3FORMS_URL, WEB3FORMS_KEY } from './config.ts';

// ── Rate-limit simple en sessionStorage ──────────────────────────────────────

const RATE_KEY = 'booking:last-submit';
const RATE_WINDOW_MS = 60_000; // 1 minuto

function checkRateLimit(): void {
  const last = sessionStorage.getItem(RATE_KEY);
  if (last && Date.now() - Number(last) < RATE_WINDOW_MS) {
    throw new Error('RATE_LIMIT');
  }
}

function markSubmit(): void {
  sessionStorage.setItem(RATE_KEY, String(Date.now()));
}

// ── Formateo del email ────────────────────────────────────────────────────────

function formatEmailBody(request: BookingRequest, service: Service): string {
  const { startISO, customer } = request;
  const d = new Date(startISO);
  const fecha = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);

  const lines = [
    `Servicio: ${service.name} (${service.priceEur}€)`,
    `Fecha:    ${fecha}`,
    `Hora:     ${hora} (Europe/Madrid)`,
    '',
    'Cliente:',
    `  Nombre:    ${customer.name}`,
    `  Email:     ${customer.email}`,
    `  Teléfono:  ${customer.phone}`,
  ];
  if (customer.notes) lines.push(`  Notas:     ${customer.notes}`);
  lines.push('', 'Consentimiento RGPD: aceptado.', '', '— Enviado desde vorama.es');
  return lines.join('\n');
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function submitBooking(
  request: BookingRequest,
  service: Service,
): Promise<{ ok: true }> {
  // Validación Zod
  BookingRequestSchema.parse(request);

  // Honeypot
  if (request.hp_website !== '') throw new Error('BOT');

  // Rate-limit
  checkRateLimit();

  // Asunto y cuerpo del email
  const d = new Date(request.startISO);
  const hora = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
  const fecha = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);

  const payload = {
    access_key: WEB3FORMS_KEY,
    subject:    `[Voramà] Solicitud: ${service.name} — ${fecha} ${hora}`,
    from_name:  request.customer.name,
    replyto:    request.customer.email,
    botcheck:   '',
    message:    formatEmailBody(request, service),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(WEB3FORMS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      console.error('[booking/submit] Web3Forms error', json);
      throw new Error('SUBMIT_FAILED');
    }

    markSubmit();
    return { ok: true };

  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.message === 'SUBMIT_FAILED') throw err;
    if (!navigator.onLine) throw new Error('OFFLINE');
    throw new Error('SUBMIT_FAILED');
  }
}
