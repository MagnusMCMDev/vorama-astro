/**
 * Funciones de renderizado HTML para cada paso del widget de reservas.
 * Puras: reciben estado y devuelven string HTML o nodo DOM.
 * Sin efectos secundarios ni acceso al DOM directamente.
 */

import type { BookingStep, BookingErrorCode, ServiceType } from './types.ts';
import type { MonthAvailability } from './availability.ts';
import { formatSlot } from './availability.ts';
import type { Slot } from './types.ts';
import servicesData from '../../content/booking/services.json';

// ── Catálogo ─────────────────────────────────────────────────────────────────

type SvcEntry = { id: string; name: string; durationMin: number; priceEur: number };
const SERVICES = servicesData as SvcEntry[];
export function getService(id: string) { return SERVICES.find((s) => s.id === id); }

/** Nombre legible por ServiceType */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  'californiano':  'Masaje Californiano',
  'cuatro-manos':  'Masaje Cuatro Manos',
  'para-dos':      'Masaje Para Dos',
};

/** Descripción breve de cada tipo */
const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  'californiano':  'Técnica de deslizamiento fluido, relajación profunda, un terapeuta.',
  'cuatro-manos':  'Sincronía de dos terapeutas trabajando a la vez, doble sensación.',
  'para-dos':      'Dos personas, cada una con su terapeuta, en sesión simultánea.',
};

/** Variantes (duración + precio) agrupadas por tipo de servicio */
export const SERVICE_TYPE_VARIANTS: Record<ServiceType, SvcEntry[]> = {
  'californiano':  SERVICES.filter((s) => s.id.startsWith('californiano-')),
  'cuatro-manos':  SERVICES.filter((s) => s.id.startsWith('cuatro-manos-')),
  'para-dos':      SERVICES.filter((s) => s.id.startsWith('para-dos-')),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

/** 0=dom→6 en lunes-primero (Mon=0..Sun=6) */
function mondayFirst(jsDay: number) { return (jsDay + 6) % 7; }

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG  = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── Paso 0: DurationPicker / ServiceHub ──────────────────────────────────────

const SERVICE_TYPE_ORDER: ServiceType[] = ['californiano', 'cuatro-manos', 'para-dos'];

/** Bloque de tarjetas de duración para un tipo concreto */
function renderTypeBlock(serviceType: ServiceType): string {
  const label    = SERVICE_TYPE_LABELS[serviceType];
  const desc     = SERVICE_TYPE_DESCRIPTIONS[serviceType];
  const variants = SERVICE_TYPE_VARIANTS[serviceType] ?? [];

  const cards = variants.map((v) => `
    <button type="button" class="bw-dur__card" data-bw-pick-duration="${esc(v.id)}">
      <span class="bw-dur__min">${v.durationMin} min</span>
      <span class="bw-dur__price">${v.priceEur}€</span>
    </button>`).join('');

  return `
    <div class="bw-hub__type">
      <p class="bw-hub__type-label">${esc(label)}</p>
      <p class="bw-dur__desc">${esc(desc)}</p>
      <div class="bw-dur__grid" role="group" aria-label="Elige la duración de ${esc(label)}">
        ${cards}
      </div>
    </div>`;
}

/**
 * Hub completo: muestra los 3 tipos de masaje con sus opciones de duración.
 * Usado cuando el botón no especifica serviceType (p.ej. botón "Reserva" del header).
 */
export function renderServiceHub(): string {
  const blocks = SERVICE_TYPE_ORDER.map(renderTypeBlock).join('<hr class="bw-hub__divider">');
  return `<div class="bw-hub">${blocks}</div>`;
}

/**
 * Selector de duración para un tipo de masaje concreto.
 * Usado cuando el botón ya especifica serviceType (p.ej. data-service-type="californiano").
 */
export function renderDurationPicker(serviceType: ServiceType): string {
  const label = SERVICE_TYPE_LABELS[serviceType];
  const desc  = SERVICE_TYPE_DESCRIPTIONS[serviceType];
  const variants = SERVICE_TYPE_VARIANTS[serviceType] ?? [];

  const cards = variants.map((v) => `
    <button type="button" class="bw-dur__card" data-bw-pick-duration="${esc(v.id)}">
      <span class="bw-dur__min">${v.durationMin} min</span>
      <span class="bw-dur__price">${v.priceEur}€</span>
    </button>`).join('');

  return `
    <div class="bw-dur">
      <p class="bw-svc-label">${esc(label)}</p>
      <p class="bw-dur__desc">${esc(desc)}</p>
      <div class="bw-dur__grid" role="group" aria-label="Elige la duración">
        ${cards}
      </div>
    </div>`;
}

// ── Paso 1: CalendarPicker ────────────────────────────────────────────────────

export interface CalendarRenderState {
  serviceId: string;
  durationMin: number;
  year: number;
  month0: number;
  selectedDate: string | null;
  availability: MonthAvailability | null;
  isLoading: boolean;
}

export function renderCalendar(s: CalendarRenderState): string {
  const svc = getService(s.serviceId);
  const svcLabel = svc ? `${svc.name} — ${svc.priceEur}€` : '';
  const monthLabel = `${MONTHS[s.month0]} ${s.year}`;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const daysInMonth = new Date(s.year, s.month0 + 1, 0).getDate();
  const firstWeekday = mondayFirst(new Date(s.year, s.month0, 1).getDay());

  // Celdas
  let cells = '';
  // Celdas vacías iniciales
  for (let i = 0; i < firstWeekday; i++) {
    cells += '<td role="gridcell" aria-disabled="true" class="bw-cal__cell bw-cal__cell--empty"></td>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${s.year}-${pad2(s.month0 + 1)}-${pad2(d)}`;
    const hasSlots = s.availability?.days.has(key) ?? false;
    const isToday = key === todayKey;
    const isSelected = key === s.selectedDate;
    const disabled = !hasSlots;
    const classes = [
      'bw-cal__cell',
      disabled ? 'bw-cal__cell--disabled' : 'bw-cal__cell--available',
      isToday ? 'bw-cal__cell--today' : '',
      isSelected ? 'bw-cal__cell--selected' : '',
    ].filter(Boolean).join(' ');
    const weekdayIdx = mondayFirst(new Date(s.year, s.month0, d).getDay());
    const ariaLabel = `${d} de ${MONTHS[s.month0]}, ${WEEKDAYS_LONG[weekdayIdx]}${disabled ? ', no disponible' : ''}`;
    if (disabled) {
      cells += `<td role="gridcell" aria-disabled="true" class="${classes}" data-date="${key}" tabindex="-1"><span aria-label="${ariaLabel}">${d}</span></td>`;
    } else {
      cells += `<td role="gridcell" class="${classes}" data-date="${key}" tabindex="${isSelected ? '0' : '-1'}"><button type="button" class="bw-cal__btn" data-date="${key}" aria-label="${ariaLabel}" aria-pressed="${isSelected}">${d}</button></td>`;
    }
  }

  // Completar última semana
  const totalCells = firstWeekday + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    for (let i = remainder; i < 7; i++) {
      cells += '<td role="gridcell" aria-disabled="true" class="bw-cal__cell bw-cal__cell--empty"></td>';
    }
  }

  // Agrupar en filas de 7
  const allCells = cells;
  // Parse rows
  const cellArr = allCells.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
  let rows = '';
  for (let i = 0; i < cellArr.length; i += 7) {
    rows += `<tr role="row">${cellArr.slice(i, i + 7).join('')}</tr>`;
  }

  const headerRow = WEEKDAYS_SHORT.map((d, i) =>
    `<th scope="col" abbr="${WEEKDAYS_LONG[i]}">${d}</th>`
  ).join('');

  const loadingClass = s.isLoading ? ' bw-cal--loading' : '';

  return `
    <div class="bw-svc-label">${esc(svcLabel)}</div>
    <div class="bw-cal${loadingClass}" role="group" aria-label="Selecciona una fecha">
      <div class="bw-cal__nav">
        <button type="button" class="bw-cal__nav-btn" data-cal-prev aria-label="Mes anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="bw-cal__month" aria-live="polite" aria-atomic="true">${monthLabel}</span>
        <button type="button" class="bw-cal__nav-btn" data-cal-next aria-label="Mes siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      ${s.isLoading ? '<div class="bw-loading" aria-live="polite"><span class="sr-only">Cargando disponibilidad…</span><div class="bw-spinner"></div></div>' : ''}
      <table class="bw-cal__grid" role="grid" aria-label="${monthLabel}">
        <thead><tr role="row">${headerRow}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Paso 2: TimeSlotList ──────────────────────────────────────────────────────

export function renderSlots(slots: Slot[], selectedSlot: Slot | null): string {
  if (!slots.length) return '<p class="bw-empty">No hay horarios disponibles para este día.</p>';
  const items = slots.map((slot) => {
    const { time } = formatSlot(slot.startISO);
    const isSelected = slot.startISO === selectedSlot?.startISO;
    return `<li role="option" aria-selected="${isSelected}" class="bw-slot${isSelected ? ' bw-slot--selected' : ''}">
      <button type="button" class="bw-slot__btn" data-slot-iso="${esc(slot.startISO)}" data-slot-end="${esc(slot.endISO)}">${time}</button>
    </li>`;
  }).join('');
  return `<ul role="listbox" class="bw-slots" aria-label="Horarios disponibles">${items}</ul>`;
}

// ── Paso 3: BookingForm ───────────────────────────────────────────────────────

export interface FormState {
  name: string; email: string; phone: string; notes: string;
  errors: Partial<Record<'name'|'email'|'phone'|'notes'|'consent', string>>;
  consent: boolean;
}

export function renderForm(slot: Slot, form: FormState): string {
  const { date, time } = formatSlot(slot.startISO);
  const svc = getService(slot.serviceId);
  const e = (f: keyof typeof form.errors) => form.errors[f]
    ? `<span class="bw-field__error" id="err-${f}" role="alert">${esc(form.errors[f]!)}</span>`
    : '';

  return `
    <div class="bw-slot-recap">
      <span class="bw-slot-recap__date">${esc(date)}</span>
      <span class="bw-slot-recap__time">${esc(time)}</span>
      ${svc ? `<span class="bw-slot-recap__svc">${esc(svc.name)}</span>` : ''}
    </div>
    <form class="bw-form" novalidate>
      <input type="text" name="botcheck" class="bw-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="bw-field">
        <label class="bw-field__label" for="bw-name">Nombre <span aria-hidden="true">*</span></label>
        <input class="bw-field__input${form.errors.name ? ' bw-field__input--error' : ''}" type="text"
          id="bw-name" name="name" autocomplete="name" required
          value="${esc(form.name)}"
          aria-required="true" aria-describedby="${form.errors.name ? 'err-name' : ''}">
        ${e('name')}
      </div>
      <div class="bw-field">
        <label class="bw-field__label" for="bw-email">Email <span aria-hidden="true">*</span></label>
        <input class="bw-field__input${form.errors.email ? ' bw-field__input--error' : ''}" type="email"
          id="bw-email" name="email" autocomplete="email" required
          value="${esc(form.email)}"
          aria-required="true" aria-describedby="${form.errors.email ? 'err-email' : ''}">
        ${e('email')}
      </div>
      <div class="bw-field">
        <label class="bw-field__label" for="bw-phone">Teléfono <span aria-hidden="true">*</span></label>
        <input class="bw-field__input${form.errors.phone ? ' bw-field__input--error' : ''}" type="tel"
          id="bw-phone" name="phone" autocomplete="tel" required
          value="${esc(form.phone)}"
          aria-required="true" aria-describedby="${form.errors.phone ? 'err-phone' : ''}">
        ${e('phone')}
      </div>
      <div class="bw-field">
        <label class="bw-field__label" for="bw-notes">Si procede, indique algún detalle para preparar la sesión <span class="bw-field__optional">(opcional)</span></label>
        <textarea class="bw-field__input bw-field__textarea" id="bw-notes" name="notes"
          rows="3" maxlength="500"
          placeholder="Ej: zona de tensión, lesión reciente, preferencia de presión…"
          aria-describedby="${form.errors.notes ? 'err-notes' : ''}">${esc(form.notes)}</textarea>
        ${e('notes')}
      </div>
      <div class="bw-field bw-field--check">
        <label class="bw-field__check-label">
          <input type="checkbox" class="bw-field__checkbox${form.errors.consent ? ' bw-field__input--error' : ''}"
            name="consentRgpd" required aria-required="true"
            aria-describedby="${form.errors.consent ? 'err-consent' : ''}"
            ${form.consent ? 'checked' : ''}>
          <span>He leído y acepto la <a href="/legal/privacidad/" target="_blank" rel="noopener" class="bw-link">política de privacidad</a></span>
        </label>
        ${e('consent')}
      </div>
      <div class="bw-form__actions">
        <button type="button" class="bw-btn bw-btn--ghost" data-bw-back>← Cambiar fecha</button>
        <button type="submit" class="bw-btn bw-btn--primary">Continuar →</button>
      </div>
    </form>`;
}

// ── Paso 4: Summary ───────────────────────────────────────────────────────────

export function renderSummary(slot: Slot, form: FormState, isSubmitting: boolean): string {
  const { date, time } = formatSlot(slot.startISO);
  const svc = getService(slot.serviceId);
  return `
    <div class="bw-summary">
      <h3 class="bw-summary__title">Confirma tu solicitud</h3>
      <dl class="bw-summary__list">
        <div class="bw-summary__row"><dt>Servicio</dt><dd>${esc(svc?.name ?? '')}</dd></div>
        <div class="bw-summary__row"><dt>Precio</dt><dd>${svc?.priceEur ?? ''}€ (pago en consulta)</dd></div>
        <div class="bw-summary__row"><dt>Fecha</dt><dd>${esc(date)}</dd></div>
        <div class="bw-summary__row"><dt>Hora</dt><dd>${esc(time)}</dd></div>
        <div class="bw-summary__row"><dt>Nombre</dt><dd>${esc(form.name)}</dd></div>
        <div class="bw-summary__row"><dt>Email</dt><dd>${esc(form.email)}</dd></div>
        <div class="bw-summary__row"><dt>Teléfono</dt><dd>${esc(form.phone)}</dd></div>
        ${form.notes ? `<div class="bw-summary__row"><dt>Notas</dt><dd>${esc(form.notes)}</dd></div>` : ''}
      </dl>
      <p class="bw-summary__notice">
        Tras enviar, <strong>Miguel te contactará por WhatsApp</strong> para confirmar la cita y coordinar el pago en metálico.
      </p>
      <div class="bw-form__actions">
        <button type="button" class="bw-btn bw-btn--ghost" data-bw-back>← Atrás</button>
        <button type="button" class="bw-btn bw-btn--primary" data-bw-submit ${isSubmitting ? 'disabled aria-busy="true"' : ''}>
          ${isSubmitting ? '<span class="bw-spinner bw-spinner--sm"></span> Enviando…' : 'Confirmar solicitud'}
        </button>
      </div>
    </div>`;
}

// ── Paso 5a: Success ──────────────────────────────────────────────────────────

export function renderSuccess(): string {
  return `
    <div class="bw-end bw-end--success">
      <svg class="bw-end__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16 9.5"/></svg>
      <h3 class="bw-end__title">¡Solicitud recibida!</h3>
      <p class="bw-end__text">Miguel te contactará por <strong>WhatsApp</strong> en breve para confirmar tu reserva.</p>
    </div>`;
}

// ── Paso 5b: Error ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  GCAL_DOWN:    'No hemos podido comprobar la disponibilidad. Inténtalo de nuevo o escríbenos por WhatsApp.',
  SUBMIT_FAILED:'No hemos podido enviar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.',
  OFFLINE:      'Parece que no hay conexión a internet. Comprueba tu red o escríbenos por WhatsApp.',
  INVALID_SLOT: 'Ese horario ya no está disponible. Por favor, elige otra hora.',
  RATE_LIMIT:   'Solicitud ya enviada, espera un momento antes de intentarlo de nuevo.',
};

export function renderError(code: string, whatsapp: string): string {
  const msg = ERROR_MESSAGES[code] ?? ERROR_MESSAGES['SUBMIT_FAILED'];
  const waHref = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero reservar una sesión de masaje')}`;
  return `
    <div class="bw-end bw-end--error">
      <svg class="bw-end__icon bw-end__icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3 class="bw-end__title">Algo ha ido mal</h3>
      <p class="bw-end__text">${esc(msg)}</p>
      <div class="bw-form__actions bw-form__actions--center">
        <button type="button" class="bw-btn bw-btn--ghost" data-bw-retry>Reintentar</button>
        <a href="${waHref}" target="_blank" rel="noopener" class="bw-btn bw-btn--wa">WhatsApp</a>
      </div>
    </div>`;
}
