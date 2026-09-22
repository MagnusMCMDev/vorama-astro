// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./gcal.ts', () => ({ fetchBusy: vi.fn() }));

import { fetchBusy } from './gcal.ts';
import { mountWidget } from './widget-state.ts';

const DIRECT = { mode: 'direct', serviceId: 'californiano-90', durationMin: 90 } as const;

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function settle() { await tick(); await tick(); }

let container: HTMLElement;

beforeEach(() => {
  // Solo se falsea la fecha (junio 2026, con huecos libres); los temporizadores siguen siendo reales.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-01T08:00:00Z') });
  vi.mocked(fetchBusy).mockReset();
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
