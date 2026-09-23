import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitBooking } from './submit.ts';
import type { BookingRequest, Service } from './types.ts';

const service: Service = {
  id: 'californiano-90', name: 'Masaje californiano', durationMin: 90, priceEur: 60,
};

const base: BookingRequest = {
  serviceId: 'californiano-90',
  startISO: '2026-10-05T18:00:00+02:00',
  customer: { name: 'Ana Prueba', email: 'ana@example.com', phone: '600000000', health: 'no', consentRgpd: true },
  hp_website: '',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // sessionStorage propio por test: el rate-limit de 1 minuto no debe cruzarse entre tests.
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
  fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sentPayload = () => JSON.parse(fetchMock.mock.calls[0]![1].body);

describe('reserva — datos de salud en el email', () => {
  it('sin problemas de salud: lo dice y no marca el asunto', async () => {
    await submitBooking(base, service);
    const payload = sentPayload();
    expect(payload.subject).not.toContain('revisar salud');
    expect(payload.message).toContain('Salud: nada que indicar.');
  });

  it('con un problema de salud: marca el asunto e incluye el detalle y el consentimiento', async () => {
    await submitBooking({
      ...base,
      customer: { ...base.customer, health: 'yes', healthNotes: 'Ataque de gota', healthConsent: true },
    }, service);
    const payload = sentPayload();
    expect(payload.subject).toContain('⚠ revisar salud');
    expect(payload.message).toContain('Detalle: Ataque de gota');
    expect(payload.message).toContain('Consentimiento explícito (datos de salud): sí.');
  });

  it('rechaza «Sí» sin consentimiento explícito y no envía nada', async () => {
    await expect(submitBooking({
      ...base,
      customer: { ...base.customer, health: 'yes', healthNotes: 'Ataque de gota' },
    }, service)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
