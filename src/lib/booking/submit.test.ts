import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitBooking } from './submit.ts';
import type { BookingRequest, Service } from './types.ts';

const service: Service = {
  id: 'californiano-90', name: 'Masaje californiano', durationMin: 90, priceEur: 60,
};

const request: BookingRequest = {
  serviceId: 'californiano-90',
  startISO: '2026-10-05T18:00:00+02:00',
  customer: { name: 'Ana Prueba', email: 'ana@example.com', phone: '600000000', health: 'no', consentRgpd: true },
  hp_website: '',
};

function okFetch() {
  return vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitBooking — almacenamiento de sesión', () => {
  it('envía la reserva aunque el navegador bloquee sessionStorage', async () => {
    const blocked = {
      getItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
      setItem: () => { throw new DOMException('bloqueado', 'SecurityError'); },
    };
    const fetchMock = okFetch();
    vi.stubGlobal('sessionStorage', blocked);
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitBooking(request, service)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mantiene el rate-limit de 1 minuto cuando sessionStorage funciona', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    vi.stubGlobal('fetch', okFetch());

    await submitBooking(request, service);
    await expect(submitBooking(request, service)).rejects.toThrow('RATE_LIMIT');
  });
});
