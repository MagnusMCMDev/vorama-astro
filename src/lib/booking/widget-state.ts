/**
 * Gestión de estado y lógica del widget de reservas.
 * Orquesta los pasos: calendar → form → summary → success/error.
 * Se monta sobre un elemento contenedor inyectado por BookingDialog.astro.
 */

import type { ServiceId, ServiceType, BookingStep, Slot, MountOptions } from './types.ts';
import type { FormState } from './widget-render.ts';
import {
  renderServiceHub, renderDurationPicker,
  renderCalendar, renderSlots, renderForm,
  renderSummary, renderSuccess, renderError, renderEmptyMonth,
  getService,
} from './widget-render.ts';
import { getMonthAvailability, type MonthAvailability } from './availability.ts';
import { fetchBusy } from './gcal.ts';
import { submitBooking } from './submit.ts';
import { WHATSAPP_NUMBER } from './config.ts';

// ── Estado ────────────────────────────────────────────────────────────────────

interface WidgetState {
  /**
   * Tipo de masaje. Null cuando el hub muestra los 3 tipos a la vez
   * (botón del header sin data-service-type). Se fija al elegir una opción.
   */
  serviceType: ServiceType | null;
  /** Servicio concreto (tipo + duración), se fija tras el paso 'duration'. */
  serviceId: ServiceId | null;
  durationMin: number | null;
  step: BookingStep;
  year: number;
  month0: number;
  availability: MonthAvailability | null;
  isLoadingCal: boolean;
  selectedDate: string | null;
  slotsForDate: Slot[];
  selectedSlot: Slot | null;
  form: FormState;
  isSubmitting: boolean;
  errorCode: string | null;
}

function emptyForm(): FormState {
  return { name: '', email: '', phone: '', notes: '', errors: {}, consent: false };
}

// ── Validación de formulario ──────────────────────────────────────────────────

function validateForm(form: FormState): boolean {
  const errors: FormState['errors'] = {};
  if (!form.name.trim() || form.name.trim().length < 2)
    errors.name = 'Indica tu nombre (mínimo 2 caracteres)';
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'Indica un email válido';
  if (!form.phone.trim() || form.phone.replace(/\D/g,'').length < 7)
    errors.phone = 'Indica un número de teléfono válido';
  if (!form.consent)
    errors.consent = 'Debes aceptar la política de privacidad';
  form.errors = errors;
  return Object.keys(errors).length === 0;
}

// ── Foco estable entre renders ────────────────────────────────────────────────

/**
 * Selector del elemento enfocado que sigue existiendo tras re-renderizar el paso
 * (día, horario o flechas de mes). Así el foco no cae al <body> en cada selección.
 */
function focusSelectorFor(el: Element | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.matches('.bw-cal__btn') && el.dataset.date) return `.bw-cal__btn[data-date="${el.dataset.date}"]`;
  if (el.matches('.bw-slot__btn') && el.dataset.slotIso) return `.bw-slot__btn[data-slot-iso="${el.dataset.slotIso}"]`;
  if (el.matches('[data-cal-prev]')) return '[data-cal-prev]';
  if (el.matches('[data-cal-next]')) return '[data-cal-next]';
  return null;
}

// ── Montaje del widget ────────────────────────────────────────────────────────

/**
 * Monta el widget de reservas en el contenedor dado.
 *
 * Modo `direct`: el botón ya fija el servicio y la duración → arranca en el calendario.
 * Modo `hub`:    muestra primero el selector de duración → arranca en 'duration'.
 */
export function mountWidget(container: HTMLElement, options: MountOptions): void {
  const now = new Date();

  // Determinar estado inicial según el modo
  const isDirect = options.mode === 'direct';
  // null → hub completo (3 tipos); string → tipo concreto o derivado del serviceId
  const initServiceType: ServiceType | null = isDirect
    ? (options.serviceId.split('-').slice(0, -1).join('-') as ServiceType)
    : (options.serviceType ?? null);

  const state: WidgetState = {
    serviceType: initServiceType,
    serviceId:   isDirect ? options.serviceId   : null,
    durationMin: isDirect ? options.durationMin : null,
    step:        isDirect ? 'calendar'          : 'duration',
    year: now.getFullYear(),
    month0: now.getMonth(),
    availability: null,
    isLoadingCal: false,
    selectedDate: null,
    slotsForDate: [],
    selectedSlot: null,
    form: emptyForm(),
    isSubmitting: false,
    errorCode: null,
  };

  // Token monótono: cada carga de disponibilidad incrementa el contador.
  // Una respuesta cuyo token ya no es el último se descarta (el usuario
  // navegó a otro mes mientras la petición estaba en vuelo).
  let loadToken = 0;

  // Estructura fija: la región aria-live vive FUERA del contenido que se re-renderiza,
  // para que los anuncios ni se pierdan ni se repitan en cada render.
  container.innerHTML = '<div class="sr-only" aria-live="polite" data-bw-live></div><div class="bw-content" data-bw-content></div>';
  const liveEl = container.querySelector<HTMLElement>('[data-bw-live]')!;
  const contentEl = container.querySelector<HTMLElement>('[data-bw-content]')!;

  function render() {
    let html = '';
    const active = document.activeElement;
    const restoreFocus = active && contentEl.contains(active) ? focusSelectorFor(active) : null;

    if (state.step === 'duration') {
      // Hub completo (header) vs picker de tipo concreto
      html = state.serviceType
        ? renderDurationPicker(state.serviceType)
        : renderServiceHub();
    } else if (state.step === 'calendar') {
      html = renderCalendar({
        serviceId: state.serviceId!,
        durationMin: state.durationMin!,
        year: state.year,
        month0: state.month0,
        selectedDate: state.selectedDate,
        availability: state.availability,
        isLoading: state.isLoadingCal,
      });
      // En modo hub: botón "← Cambiar duración" encima del calendario
      if (!isDirect) {
        html = `<div class="bw-form__actions" style="margin-bottom:var(--vrm-space-sm)">
          <button type="button" class="bw-btn bw-btn--ghost" data-bw-back>← Cambiar duración</button>
        </div>` + html;
      }
      if (!state.isLoadingCal && state.availability && state.availability.days.size === 0) {
        html += renderEmptyMonth(state.year, state.month0, WHATSAPP_NUMBER);
      }
      if (state.selectedDate && state.slotsForDate.length) {
        html += `<div class="bw-slots-section">${renderSlots(state.slotsForDate, state.selectedSlot)}</div>`;
        if (state.selectedSlot) {
          html += `<div class="bw-form__actions bw-form__actions--right"><button type="button" class="bw-btn bw-btn--primary" data-bw-to-form>Continuar →</button></div>`;
        }
      }
    } else if (state.step === 'form') {
      html = renderForm(state.selectedSlot!, state.form);
    } else if (state.step === 'summary') {
      html = renderSummary(state.selectedSlot!, state.form, state.isSubmitting);
    } else if (state.step === 'success') {
      html = renderSuccess();
    } else if (state.step === 'error') {
      html = renderError(state.errorCode ?? 'SUBMIT_FAILED', WHATSAPP_NUMBER);
    }

    contentEl.innerHTML = html;

    attachListeners();
    if (restoreFocus) contentEl.querySelector<HTMLElement>(restoreFocus)?.focus();
  }

  function announce(msg: string) {
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = msg; }, 50);
  }

  async function loadAvailability() {
    if (!state.serviceId || !state.durationMin) return;
    const token = ++loadToken;
    const reqYear = state.year;
    const reqMonth0 = state.month0;
    state.isLoadingCal = true;
    state.availability = null;
    render();

    try {
      const busy = await fetchBusy(reqYear, reqMonth0);
      if (token !== loadToken) return; // respuesta obsoleta → descartar
      const avail = getMonthAvailability(state.serviceId, state.durationMin, reqYear, reqMonth0, busy);
      state.availability = avail;
      state.isLoadingCal = false;
      if (state.selectedDate && !avail.days.has(state.selectedDate)) {
        state.selectedDate = null;
        state.selectedSlot = null;
        state.slotsForDate = [];
      }
    } catch (err) {
      if (token !== loadToken) return; // error de una petición ya superada
      const code = err instanceof Error ? err.message : 'GCAL_DOWN';
      state.isLoadingCal = false;
      state.errorCode = code;
      goToStep('error', 'No se pudo cargar la disponibilidad');
      return;
    }

    render();
  }

  function goToStep(step: BookingStep, announceMsg = '') {
    state.step = step;
    render();
    if (announceMsg) announce(announceMsg);
    // Foco al primer elemento interactivo del nuevo paso
    requestAnimationFrame(() => {
      const first = contentEl.querySelector<HTMLElement>('button:not([disabled]), a, input, textarea');
      first?.focus();
    });
  }

  function attachListeners() {
    // ── Selección de duración ─────────────────────────────────────────────────
    container.querySelectorAll<HTMLButtonElement>('[data-bw-pick-duration]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const svcId = btn.dataset.bwPickDuration as ServiceId;
        const svc = getService(svcId);
        if (!svc) return;
        state.serviceId   = svcId;
        state.durationMin = svc.durationMin;
        // Derivar serviceType del id (ej. "cuatro-manos-60" → "cuatro-manos")
        state.serviceType = svcId.split('-').slice(0, -1).join('-') as ServiceType;
        // Resetear selección de calendario al cambiar duración
        state.availability = null;
        state.selectedDate = null;
        state.slotsForDate = [];
        state.selectedSlot = null;
        goToStep('calendar', `${svc.durationMin} minutos seleccionados. Elige una fecha.`);
        loadAvailability();
      });
    });

    // ── Navegación de calendario ──────────────────────────────────────────────
    container.querySelector('[data-cal-prev]')?.addEventListener('click', () => {
      let m = state.month0 - 1;
      let y = state.year;
      if (m < 0) { m = 11; y--; }
      state.month0 = m;
      state.year = y;
      state.selectedDate = null;
      state.slotsForDate = [];
      state.selectedSlot = null;
      loadAvailability();
    });
    container.querySelector('[data-cal-next]')?.addEventListener('click', () => {
      let m = state.month0 + 1;
      let y = state.year;
      if (m > 11) { m = 0; y++; }
      state.month0 = m;
      state.year = y;
      state.selectedDate = null;
      state.slotsForDate = [];
      state.selectedSlot = null;
      loadAvailability();
    });

    // ── Selección de día ──────────────────────────────────────────────────────
    container.querySelectorAll<HTMLButtonElement>('.bw-cal__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const date = btn.dataset.date!;
        state.selectedDate = date;
        state.slotsForDate = state.availability?.days.get(date) ?? [];
        state.selectedSlot = null;
        render();
        announce(`Día ${date} seleccionado, ${state.slotsForDate.length} horarios disponibles`);
        // Scroll suave a slots
        setTimeout(() => container.querySelector('.bw-slots-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      });
    });

    // ── Navegación teclado calendario ─────────────────────────────────────────
    container.querySelector('.bw-cal__grid')?.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      const focused = container.querySelector<HTMLButtonElement>('.bw-cal__btn:focus');
      if (!focused) return;
      const date = new Date(focused.dataset.date + 'T12:00:00');
      let delta = 0;
      if (ev.key === 'ArrowRight') delta = 1;
      else if (ev.key === 'ArrowLeft') delta = -1;
      else if (ev.key === 'ArrowDown') delta = 7;
      else if (ev.key === 'ArrowUp') delta = -7;
      else return;
      ev.preventDefault();
      // Salta los días sin huecos en la dirección pulsada, sin salir del mes.
      let target: HTMLButtonElement | null = null;
      for (let i = 0; i < 31 && !target; i++) {
        date.setDate(date.getDate() + delta);
        if (date.getMonth() !== state.month0) break;
        const newKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        target = container.querySelector<HTMLButtonElement>(`.bw-cal__btn[data-date="${newKey}"]`);
      }
      if (target) {
        focused.tabIndex = -1;
        target.tabIndex = 0;
        target.focus();
      }
    });

    // ── Selección de slot ─────────────────────────────────────────────────────
    container.querySelectorAll<HTMLButtonElement>('.bw-slot__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedSlot = {
          startISO: btn.dataset.slotIso!,
          endISO: btn.dataset.slotEnd!,
          serviceId: state.serviceId!,
        };
        render();
      });
    });

    // ── Slots: navegación teclado ─────────────────────────────────────────────
    container.querySelector('.bw-slots')?.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      const items = [...container.querySelectorAll<HTMLButtonElement>('.bw-slot__btn')];
      const idx = items.findIndex((b) => b === document.activeElement);
      if (idx < 0) return;
      let next = idx;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') next = Math.min(idx + 1, items.length - 1);
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') next = Math.max(idx - 1, 0);
      else return;
      ev.preventDefault();
      items[idx]!.tabIndex = -1;
      items[next]!.tabIndex = 0;
      items[next]!.focus();
    });

    // ── Continuar a formulario ────────────────────────────────────────────────
    container.querySelector('[data-bw-to-form]')?.addEventListener('click', () => {
      goToStep('form', 'Formulario de datos personales');
    });

    // ── Formulario: inputs ────────────────────────────────────────────────────
    const form = container.querySelector<HTMLFormElement>('.bw-form');
    if (form) {
      form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea').forEach((inp) => {
        inp.addEventListener('input', () => {
          const n = inp.name as keyof FormState;
          if (n === 'name' || n === 'email' || n === 'phone' || n === 'notes') {
            (state.form as any)[n] = inp.value;
          }
        });
      });
      const checkbox = form.querySelector<HTMLInputElement>('[name="consentRgpd"]');
      checkbox?.addEventListener('change', () => { state.form.consent = checkbox.checked; });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Leer valores actuales del DOM
        ['name','email','phone','notes'].forEach((f) => {
          const el = form.querySelector<HTMLInputElement>(`[name="${f}"]`);
          if (el) (state.form as any)[f] = el.value;
        });
        state.form.consent = (form.querySelector<HTMLInputElement>('[name="consentRgpd"]'))?.checked ?? false;
        if (validateForm(state.form)) goToStep('summary', 'Resumen de tu reserva');
        else {
          render();
          contentEl.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        }
      });
    }

    // ── Botón Atrás ───────────────────────────────────────────────────────────
    container.querySelector('[data-bw-back]')?.addEventListener('click', () => {
      if (state.step === 'calendar') {
        // Solo volver al hub si el widget arrancó en modo hub (serviceId era null al inicio)
        if (!isDirect) goToStep('duration', 'Selecciona la duración');
        // En modo directo no hay paso anterior al calendario
      } else if (state.step === 'form') {
        goToStep('calendar', 'Selecciona fecha y hora');
      } else if (state.step === 'summary') {
        goToStep('form', 'Formulario de datos');
      }
    });

    // ── Submit ────────────────────────────────────────────────────────────────
    container.querySelector('[data-bw-submit]')?.addEventListener('click', async () => {
      if (state.isSubmitting || !state.selectedSlot || !state.serviceId) return;
      const svc = getService(state.serviceId);
      if (!svc) return;
      state.isSubmitting = true;
      render();
      try {
        const hp = (container.querySelector<HTMLInputElement>('[name="botcheck"]'))?.value ?? '';
        await submitBooking({
          serviceId: state.serviceId,
          startISO: state.selectedSlot.startISO,
          customer: {
            name: state.form.name,
            email: state.form.email,
            phone: state.form.phone,
            notes: state.form.notes || undefined,
            consentRgpd: true,
          },
          hp_website: hp,
        }, svc as any);
        goToStep('success', '¡Solicitud enviada correctamente!');
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : 'SUBMIT_FAILED';
        state.errorCode = code;
        state.isSubmitting = false;
        goToStep('error', 'Ha ocurrido un error');
      }
    });

    // ── Reintentar desde error ────────────────────────────────────────────────
    container.querySelector('[data-bw-retry]')?.addEventListener('click', () => {
      state.errorCode = null;
      if (state.selectedSlot) {
        goToStep('summary', 'Reintentar');
      } else {
        // El error vino de cargar la disponibilidad: hay que volver a pedirla.
        goToStep('calendar', 'Cargando de nuevo la disponibilidad');
        loadAvailability();
      }
    });
  }

  // Arranque
  if (isDirect) {
    // Modo directo: ya tenemos servicio y duración, ir al calendario
    loadAvailability();
  } else {
    // Modo hub: mostrar selector de duración
    render();
  }
}
