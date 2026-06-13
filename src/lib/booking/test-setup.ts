import { vi } from 'vitest';

// config.ts lee import.meta.env[clave] de forma DINÁMICA y lanza si falta.
// vi.stubEnv fija el valor en import.meta.env antes de que se importe config.ts.
// Valores dummy: ningún test debe tocar red.
vi.stubEnv('PUBLIC_GCAL_API_KEY', 'test-key');
vi.stubEnv('PUBLIC_GCAL_CALENDAR_ID', 'test-calendar');
vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'test-w3f');
