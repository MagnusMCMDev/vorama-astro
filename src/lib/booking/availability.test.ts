import { describe, it, expect } from 'vitest';
import { getMonthAvailability } from './availability.ts';

// Helpers
const NOW_JUNE = Date.parse('2026-06-01T00:00:00Z');

function dayList(res: ReturnType<typeof getMonthAvailability>) {
  return [...res.days.keys()].sort();
}

function times(res: ReturnType<typeof getMonthAvailability>, dateKey: string) {
  return (res.days.get(dateKey) ?? []).map((s) => s.startISO.slice(11, 16));
}

describe('getMonthAvailability', () => {
  describe('slots básicos', () => {
    it('1. lunes básico — 7 slots 18:00–19:30', () => {
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, [], NOW_JUNE);
      expect(times(res, '2026-06-08')).toEqual([
        '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30',
      ]);
    });

    it('2. domingo básico — 43 slots, primero 09:00, último 19:30, startISO con offset +02:00', () => {
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, [], NOW_JUNE);
      const slots = res.days.get('2026-06-07') ?? [];
      expect(slots.length).toBe(43);
      expect(times(res, '2026-06-07')[0]).toBe('09:00');
      expect(times(res, '2026-06-07').at(-1)).toBe('19:30');
      expect(slots[0].startISO).toBe('2026-06-07T09:00:00+02:00');
    });

    it('3. día sin franjas — cuatro-manos-60 no tiene miércoles pero sí domingo', () => {
      const res = getMonthAvailability('cuatro-manos-60', 60, 2026, 5, [], NOW_JUNE);
      expect(dayList(res)).not.toContain('2026-06-10'); // miércoles
      expect(dayList(res)).toContain('2026-06-07'); // domingo
    });
  });

  describe('regresiones históricas', () => {
    it('4. regresión (a) — evento de un día no bloquea otros días', () => {
      const busy = [{ start: '2026-06-08T18:15:00+02:00', end: '2026-06-08T19:30:00+02:00' }];
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, busy, NOW_JUNE);
      expect(dayList(res)).not.toContain('2026-06-08');
      expect(times(res, '2026-06-15')).toHaveLength(7);
    });

    it('5. regresión (b) — evento cruzando medianoche: solo 18:00 en jun-08, 7 slots en jun-09', () => {
      const busy = [{ start: '2026-06-08T20:00:00+02:00', end: '2026-06-09T01:00:00+02:00' }];
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, busy, NOW_JUNE);
      expect(times(res, '2026-06-08')).toEqual(['18:00']);
      expect(times(res, '2026-06-09')).toHaveLength(7);
    });

    it('6. regresión (c) — evento all-day multi-día UTC bloquea el mes entero', () => {
      const busy = [{ start: '2026-06-01T00:00:00Z', end: '2026-07-01T00:00:00Z' }];
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, busy, NOW_JUNE);
      expect(res.days.size).toBe(0);
    });
  });

  describe('buffer', () => {
    it('7. buffer posterior — 17:00 y 17:15 bloqueados, 17:30 libre', () => {
      // domingo 2026-06-07, busy 16:00–17:00+02:00
      const busy = [{ start: '2026-06-07T16:00:00+02:00', end: '2026-06-07T17:00:00+02:00' }];
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, busy, NOW_JUNE);
      const t = times(res, '2026-06-07');
      expect(t).not.toContain('17:00');
      expect(t).not.toContain('17:15');
      expect(t).toContain('17:30');
    });

    it('8. buffer anterior — 14:15 bloqueado, 14:00 libre', () => {
      const busy = [{ start: '2026-06-07T16:00:00+02:00', end: '2026-06-07T17:00:00+02:00' }];
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, busy, NOW_JUNE);
      const t = times(res, '2026-06-07');
      expect(t).not.toContain('14:15');
      expect(t).toContain('14:00');
    });
  });

  describe('filtros temporales', () => {
    it('9. MIN_ADVANCE_HOURS (24h) — 09:45 del día siguiente ausente, 10:00 presente', () => {
      const now = Date.parse('2026-06-13T10:00:00+02:00');
      // domingo 2026-06-14
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, [], now);
      const t = times(res, '2026-06-14');
      expect(t).not.toContain('09:45');
      expect(t).toContain('10:00');
    });

    it('10. MAX_DAYS_AHEAD (60d) — agosto completo fuera de ventana', () => {
      const res = getMonthAvailability('californiano-90', 90, 2026, 7, [], NOW_JUNE);
      expect(res.days.size).toBe(0);
    });

    it('14. mes pasado completo — mayo 2026 vacío', () => {
      const res = getMonthAvailability('californiano-90', 90, 2026, 4, [], NOW_JUNE);
      expect(res.days.size).toBe(0);
    });
  });

  describe('DST Europe/Madrid', () => {
    it('11. DST primavera — 29-mar (+02:00) vs 28-mar (+01:00)', () => {
      const now = Date.parse('2026-03-01T00:00:00Z');
      // mes (2026, 2) = marzo
      const res = getMonthAvailability('californiano-90', 90, 2026, 2, [], now);
      const slots29 = res.days.get('2026-03-29') ?? [];
      const slots28 = res.days.get('2026-03-28') ?? [];
      expect(slots29[0].startISO).toBe('2026-03-29T09:00:00+02:00');
      expect(slots28[0].startISO).toBe('2026-03-28T09:00:00+01:00');
    });

    it('12. DST otoño — 25-oct (+01:00) vs 24-oct (+02:00)', () => {
      const now = Date.parse('2026-10-01T00:00:00Z');
      // mes (2026, 9) = octubre
      const res = getMonthAvailability('californiano-90', 90, 2026, 9, [], now);
      const slots25 = res.days.get('2026-10-25') ?? [];
      const slots24 = res.days.get('2026-10-24') ?? [];
      expect(slots25[0].startISO.slice(-6)).toBe('+01:00');
      expect(slots24[0].startISO.slice(-6)).toBe('+02:00');
    });
  });

  describe('coherencia endISO', () => {
    it('13. slot 19:30 en lunes tiene endISO 21:00+02:00', () => {
      const res = getMonthAvailability('californiano-90', 90, 2026, 5, [], NOW_JUNE);
      const slots = res.days.get('2026-06-08') ?? [];
      const last = slots.at(-1)!;
      expect(last.startISO.slice(11, 16)).toBe('19:30');
      expect(last.endISO).toBe('2026-06-08T21:00:00+02:00');
    });
  });
});
