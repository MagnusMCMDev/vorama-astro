// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./gcal.ts', () => ({ fetchBusy: vi.fn() }));
vi.mock('./submit.ts', () => ({ submitBooking: vi.fn().mockResolvedValue({ ok: true }) }));

import { fetchBusy } from './gcal.ts';
import { submitBooking } from './submit.ts';
import { mountWidget } from './widget-state.ts';

const DIRECT = { mode: 'direct', serviceId: 'californiano-90', durationMin: 90 } as const;

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function settle() { await tick(); await tick(); }

let container: HTMLElement;

beforeEach(() => {
  // Solo se falsea la fecha (junio 2026, con huecos libres); los temporizadores siguen siendo reales.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-01T08:00:00Z') });
  vi.mocked(fetchBusy).mockReset();
  vi.mocked(submitBooking).mockClear();
  document.body.innerHTML = '<div id="bw-mount"></div>';
  container = document.getElementById('bw-mount')!;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('widget de reservas — recuperación de errores', () => {
  it('«Reintentar» vuelve a pedir la disponibilidad tras un fallo de Google Calendar', async () => {
    vi.mocked(fetchBusy).mockRejectedValueOnce(new Error('GCAL_DOWN')).mockResolvedValueOnce([]);
    mountWidget(container, DIRECT);
    await settle();
    expect(container.querySelector('.bw-end--error')).not.toBeNull();

    container.querySelector<HTMLButtonElement>('[data-bw-retry]')!.click();
    await settle();

    expect(fetchBusy).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('.bw-cal__btn').length).toBeGreaterThan(0);
  });

  it('avisa cuando el mes no tiene huecos (agenda bloqueada o completa)', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([{ start: '2026-05-31T22:00:00Z', end: '2026-07-01T00:00:00Z' }]);
    mountWidget(container, DIRECT);
    await settle();

    expect(container.querySelectorAll('.bw-cal__btn').length).toBe(0);
    const msg = container.querySelector('.bw-empty--month');
    expect(msg?.textContent).toContain('junio 2026');
    expect(msg?.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });
});

describe('widget de reservas — teclado y lectores de pantalla', () => {
  it('mantiene el foco en el día elegido', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();

    const day = container.querySelector<HTMLButtonElement>('.bw-cal__btn')!;
    const date = day.dataset.date;
    day.focus();
    day.click();

    const active = document.activeElement as HTMLElement;
    expect(active.dataset.date).toBe(date);
    expect(active.getAttribute('aria-pressed')).toBe('true');
  });

  it('mantiene el foco en «Mes siguiente» al cambiar de mes', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();

    const next = container.querySelector<HTMLButtonElement>('[data-cal-next]')!;
    next.focus();
    next.click();
    await settle();

    expect((document.activeElement as HTMLElement).hasAttribute('data-cal-next')).toBe(true);
  });

  it('la rejilla del calendario es una sola parada de tabulación', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();

    const tabbable = [...container.querySelectorAll('.bw-cal__btn')].filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
    expect(container.querySelectorAll('.bw-cal__grid td[tabindex]').length).toBe(0);
  });

  it('los horarios son botones con aria-pressed, sin listbox/option', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();
    container.querySelector<HTMLButtonElement>('.bw-cal__btn')!.click();

    expect(container.querySelectorAll('.bw-slots[role="listbox"], .bw-slots [role="option"]').length).toBe(0);
    const slots = container.querySelectorAll('.bw-slot__btn');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('anuncia el día elegido y no repite el anuncio del paso anterior', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, { mode: 'hub' });
    container.querySelector<HTMLButtonElement>('[data-bw-pick-duration="californiano-90"]')!.click();
    await settle();
    await tick(150);
    expect(container.querySelector('.sr-only[aria-live="polite"]')!.textContent).toContain('90 minutos seleccionados');

    container.querySelector<HTMLButtonElement>('.bw-cal__btn')!.click();
    await tick(150);
    expect(container.querySelector('.sr-only[aria-live="polite"]')!.textContent).toMatch(/^martes, 2 de junio: \d+ horarios disponibles$/);
  });

  it('al pasar al formulario, el foco va al campo Nombre (no al honeypot oculto)', async () => {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();
    container.querySelector<HTMLButtonElement>('.bw-cal__btn')!.click();
    container.querySelector<HTMLButtonElement>('.bw-slot__btn')!.click();
    container.querySelector<HTMLButtonElement>('[data-bw-to-form]')!.click();
    await tick(50); // deja correr el requestAnimationFrame de goToStep

    expect((document.activeElement as HTMLInputElement).name).toBe('name');
  });
});

describe('widget de reservas — pregunta de salud', () => {
  async function goToForm() {
    vi.mocked(fetchBusy).mockResolvedValue([]);
    mountWidget(container, DIRECT);
    await settle();
    container.querySelector<HTMLButtonElement>('.bw-cal__btn')!.click();
    container.querySelector<HTMLButtonElement>('.bw-slot__btn')!.click();
    container.querySelector<HTMLButtonElement>('[data-bw-to-form]')!.click();
    await tick(50);
  }

  function fillContact() {
    const set = (name: string, value: string) => {
      container.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value;
    };
    set('name', 'Ana Prueba');
    set('email', 'ana@example.com');
    set('phone', '600000000');
    container.querySelector<HTMLInputElement>('[name="consentRgpd"]')!.checked = true;
  }

  function answerHealth(value: 'no' | 'yes') {
    const radio = container.querySelector<HTMLInputElement>(`[name="health"][value="${value}"]`)!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }

  const submitForm = () =>
    container.querySelector<HTMLFormElement>('.bw-form')!.dispatchEvent(new Event('submit', { cancelable: true }));

  it('la pregunta de salud es obligatoria y el foco va a ella', async () => {
    await goToForm();
    fillContact();
    submitForm();

    expect(container.querySelector('#err-health')?.textContent).toContain('lesión o problema de salud');
    expect((document.activeElement as HTMLInputElement).name).toBe('health');
    expect(container.querySelector('.bw-summary')).toBeNull();
  });

  it('con «Sí» muestra el detalle y exige detalle y consentimiento explícito', async () => {
    await goToForm();
    fillContact();
    answerHealth('yes');
    expect(container.querySelector<HTMLElement>('[data-health-details]')!.hidden).toBe(false);

    submitForm();

    expect(container.querySelector('#err-healthNotes')).not.toBeNull();
    expect(container.querySelector('#err-healthConsent')).not.toBeNull();
    expect(container.querySelector('.bw-summary')).toBeNull();
  });

  it('con «Sí», detalle y consentimiento, lo muestra en el resumen y lo envía', async () => {
    await goToForm();
    fillContact();
    answerHealth('yes');
    container.querySelector<HTMLTextAreaElement>('[name="healthNotes"]')!.value = 'Ataque de gota en el pie derecho';
    container.querySelector<HTMLInputElement>('[name="healthConsent"]')!.checked = true;
    submitForm();

    expect(container.querySelector('.bw-summary')?.textContent).toContain('Ataque de gota en el pie derecho');
    container.querySelector<HTMLButtonElement>('[data-bw-submit]')!.click();
    await settle();

    expect(submitBooking).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitBooking).mock.calls[0]![0].customer).toMatchObject({
      health: 'yes',
      healthNotes: 'Ataque de gota en el pie derecho',
      healthConsent: true,
    });
  });

  it('con «No» no envía datos de salud', async () => {
    await goToForm();
    fillContact();
    answerHealth('no');
    submitForm();

    expect(container.querySelector('.bw-summary')?.textContent).toContain('Nada que indicar');
    container.querySelector<HTMLButtonElement>('[data-bw-submit]')!.click();
    await settle();

    const customer = vi.mocked(submitBooking).mock.calls[0]![0].customer;
    expect(customer.health).toBe('no');
    expect(customer.healthNotes).toBeUndefined();
  });
});
