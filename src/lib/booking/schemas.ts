/**
 * Zod schemas del módulo de reservas — compatible con Zod v4 (bundleado en Astro 6).
 * Usados tanto en build-time (validar JSON de content collections)
 * como en runtime (validar formulario antes de enviar).
 */

import { z } from 'zod';

// ── Servicio ──────────────────────────────────────────────────────────────────

export const ServiceIdSchema = z.enum([
  'californiano-90',
  'californiano-120',
  'cuatro-manos-60',
  'cuatro-manos-90',
  'para-dos-60',
  'para-dos-90',
]);

export const ServiceSchema = z.object({
  id:          ServiceIdSchema,
  name:        z.string().min(1),
  durationMin: z.number().int().positive(),
  priceEur:    z.number().int().nonnegative(),
});

export type Service = z.infer<typeof ServiceSchema>;

// ── Disponibilidad ────────────────────────────────────────────────────────────

const HHmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeRangeSchema = z.object({
  start: z.string().regex(HHmmRegex, 'Formato HH:mm requerido'),
  end:   z.string().regex(HHmmRegex, 'Formato HH:mm requerido'),
});

export const WeekdayKeySchema = z.enum(['0', '1', '2', '3', '4', '5', '6']);

export const AvailabilityRuleSchema = z.object({
  serviceId: ServiceIdSchema,
  weekly:    z.record(WeekdayKeySchema, z.array(TimeRangeSchema)),
});

export type AvailabilityRule = z.infer<typeof AvailabilityRuleSchema>;

// ── Cliente / Solicitud ───────────────────────────────────────────────────────

// ISO 8601 con offset obligatorio: 2026-05-12T16:30:00+02:00
const isoWithOffsetRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/;

export const CustomerSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre es demasiado largo'),
  email: z
    .string()
    .min(1, 'Indica tu email')
    .email('El email no es válido'),
  phone: z
    .string()
    .min(7, 'Teléfono no válido')
    .max(20, 'Teléfono demasiado largo'),
  notes: z
    .string()
    .max(500, 'Las notas no pueden superar 500 caracteres')
    .optional(),
  consentRgpd: z
    .boolean()
    .refine((v) => v === true, { message: 'Debes aceptar la política de privacidad' }),
});

export type Customer = z.infer<typeof CustomerSchema>;

export const BookingRequestSchema = z.object({
  serviceId:  ServiceIdSchema,
  startISO:   z.string().regex(isoWithOffsetRegex, 'Fecha/hora inválida'),
  customer:   CustomerSchema,
  /** Honeypot: debe llegar vacío. Si contiene algo, es un bot. */
  hp_website: z.literal(''),
});

export type BookingRequest = z.infer<typeof BookingRequestSchema>;
