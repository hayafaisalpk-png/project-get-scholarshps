import { z } from 'zod'

import { fieldErrorsFrom } from '@/lib/validation/auth'
import { faqItemsSchema } from '@/lib/validation/faq'

/**
 * Article input validation.
 *
 * Mirrors the CHECK constraints in
 * `supabase/migrations/20260101000008_articles.sql` so an editor sees a field
 * message instead of a raw Postgres error. The database remains the authority.
 *
 * Note the content field is validated as a STRING here and sanitised in the
 * action: sanitisation must not silently rewrite an editor's work during
 * validation and then report success for the rewritten version.
 */

export const ARTICLE_STATUSES = [
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived',
] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const REVIEW_DECISIONS = [
  'approved',
  'changes_requested',
  'rejected',
] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)

/** Slug; `citext` makes uniqueness case-insensitive, so it is lowercased. */
export const articleSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'The URL slug must be at least 3 characters.')
  .max(200, 'The URL slug must be 200 characters or fewer.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens only.',
  )

/** Canonical URL: absolute HTTPS, or empty to mean "none". */
const optionalHttpsUrl = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .superRefine((value, ctx) => {
    if (value === null) return
    try {
      if (new URL(value).protocol !== 'https:') {
        ctx.addIssue({ code: 'custom', message: 'Use an https:// URL.' })
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid URL.' })
    }
  })

/** `datetime-local` value (no timezone) from a form control. */
const optionalDateTime = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v),
    { message: 'Use the date and time format YYYY-MM-DDTHH:MM.' },
  )

export const articleSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'A title is required.')
      .max(300, 'The title must be 300 characters or fewer.'),
    slug: articleSlugSchema,
    excerpt: optionalText(600),

    /** Raw HTML from the editor. Sanitised in the action, not here. */
    content: z
      .string()
      .max(400_000, 'The article body is too large.')
      .default(''),

    status: z.enum(ARTICLE_STATUSES).optional().default('draft'),

    author_id: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.string().uuid().safeParse(v).success, {
        message: 'Choose an author from the list.',
      }),

    /** `datetime-local` string, converted to ISO before storage. */
    scheduled_for: optionalDateTime,

    /**
     * Featured image, chosen in the media picker.
     *
     * `null` is a valid answer — most articles have no image — and the value is
     * validated as a UUID here so a malformed id cannot reach the foreign key or
     * become a PostgREST filter.
     */
    featured_image_id: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.string().uuid().safeParse(v).success, {
        message: 'Choose an image from the library.',
      }),

    noindex: z.boolean().optional().default(false),
    allow_sitemap: z.boolean().optional().default(true),

    /**
     * The article's frequently-asked-questions block.
     *
     * Optional: an article with no FAQ is normal, and the JSON-LD builder
     * declines to emit a `FAQPage` node in that case rather than describing
     * questions that do not exist.
     */
    faq_items: faqItemsSchema.optional().default([]),

    seo_title: optionalText(300),
    seo_description: optionalText(500),
    canonical_url: optionalHttpsUrl,

    article_category_ids: z.array(z.string().uuid()).optional().default([]),
    article_tag_ids: z.array(z.string().uuid()).optional().default([]),
    scholarship_ids: z.array(z.string().uuid()).optional().default([]),

    change_note: z
      .string()
      .trim()
      .max(300)
      .optional()
      .default(''),
  })
  .superRefine((value, ctx) => {
    /*
     * Mirrors articles_published_complete.
     *
     * The check is on the RAW body deliberately. If the editor has written
     * something that sanitises away to nothing — a lone <script> tag, say —
     * then publishing it would produce an empty public page that still passed
     * this rule. The action sanitises first and re-checks against the result.
     */
    if (value.status === 'published') {
      if (value.content.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['content'],
          message: 'An article needs a body before it can be published.',
        })
      }
    }

    // Mirrors articles_scheduled_has_time.
    if (value.status === 'scheduled' && !value.scheduled_for) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduled_for'],
        message: 'Choose the date and time this article should be published.',
      })
    }

    // Mirrors articles_noindex_not_in_sitemap.
    if (value.noindex && value.allow_sitemap) {
      ctx.addIssue({
        code: 'custom',
        path: ['allow_sitemap'],
        message:
          'An article hidden from search engines cannot also be listed in the sitemap. Clear the sitemap setting.',
      })
    }
  })

export type ArticleInput = z.input<typeof articleSchema>
export type ArticleRecord = z.output<typeof articleSchema>

export { fieldErrorsFrom }

/**
 * Convert a `datetime-local` value to an ISO timestamp.
 *
 * The browser submits a LOCAL time with no offset. Appending `Z` would treat
 * that local time as UTC and shift it by the editor's offset, publishing at
 * the wrong moment. `Date` parses the value as local, then we serialise the
 * real instant.
 */
export function localDateTimeToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

/** ISO timestamp back to the `datetime-local` format a form control expects. */
export function isoToLocalDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  )
}

/** Build a slug from a title; the editor can still override it. */
export function slugifyArticle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

/** Strip HTML down to a short excerpt, cutting on a word boundary. */
export function excerptFromHtml(html: string, maxLength = 200): string {
  const plain = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= maxLength) return plain

  const cut = plain.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}