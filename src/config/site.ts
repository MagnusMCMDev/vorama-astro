// ============================================================
// site.ts — Single source of truth de datos del negocio
// Usado en JSON-LD, Header, Footer y SEO.
// Cambiar aquí si cambia el nombre, teléfono, dirección, etc.
// ============================================================

export const SITE_NAME = 'Voramà Terapias';
export const SITE_TAGLINE = 'Masaje Californiano en Barcelona';

// URL del sitio definitivo (producción)
export const SITE_URL = 'https://vorama.es';

export const SITE_CONFIG = {
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  url: SITE_URL,
  description:
    'Centro de masaje californiano en Barcelona. Sesiones individuales, a cuatro manos, en pareja y para eventos corporativos.',
  telephone: '+34 623 94 18 91',
  whatsapp: 'https://wa.me/34623941891',
  whatsappDigits: '34623941891',
  email: '', // sin email público — contacto solo por WA/formulario
  address: {
    street: 'Carrer de Sant Antoni Maria Claret, 51, local 3 Despacho 3',
    locality: 'Barcelona',
    region: 'Cataluña',
    postalCode: '08025',
    country: 'ES',
  },
  geo: {
    latitude: 41.4095,
    longitude: 2.1754,
  },
  /**
   * Horario de atención publicado en los datos estructurados.
   * Debe coincidir con src/content/booking/availability-rules.json (0=domingo … 6=sábado).
   */
  openingHours: [
    { days: ['Saturday', 'Sunday'], opens: '09:00', closes: '21:00' },
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '18:00', closes: '21:00' },
  ],
  social: {
    instagram: 'https://www.instagram.com/vorama.terapias/',
    facebook: 'https://www.facebook.com/vorama.terapias',
  },
  googleBusiness: {
    rating: 4.9,
    count: 80,
  },
} as const;
