import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'zod';

// ── services ─────────────────────────────────────────────────
// 5 archivos Markdown en src/content/services/*.md
const servicesCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: ({ image }) =>
    z.object({
      slug: z.string(),
      title: z.string(),
      shortDescription: z.string().max(160),
      duration: z.string(),
      price: z.string(),
      heroImage: image(),
      heroAlt: z.string(),
      benefits: z.array(z.string()),
      order: z.number().int().positive(),
      schemaServiceType: z.string(),
      cta: z.object({
        label: z.string(),
        href: z.string(),
      }),
    }),
});

// ── faqs ─────────────────────────────────────────────────────
// Array JSON en src/content/faqs/faqs.json
// Cada item tiene campo id requerido por Astro 5/6 file() loader.
const faqsCollection = defineCollection({
  loader: file('./src/content/faqs/faqs.json'),
  schema: z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string(),
    order: z.number().int().positive(),
    group: z.enum(['californiano', 'pareja', 'cuatro-manos', 'regala']),
  }),
});

// ── reviews ──────────────────────────────────────────────────
// Array JSON en src/content/reviews/reviews.json
const reviewsCollection = defineCollection({
  loader: file('./src/content/reviews/reviews.json'),
  schema: z.object({
    id: z.string(),
    author: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rating: z.number().int().min(1).max(5),
    text: z.string(),
    source: z.enum(['google']),
  }),
});

// ── legal ────────────────────────────────────────────────────
// 3 Markdown: privacidad.md, cookies.md, aviso-legal.md
const legalCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const collections = {
  services: servicesCollection,
  faqs: faqsCollection,
  reviews: reviewsCollection,
  legal: legalCollection,
};
