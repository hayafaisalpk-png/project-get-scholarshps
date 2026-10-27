import { z } from 'zod'

import { fieldErrorsFrom } from '@/lib/validation/auth'

/**
 * Scholarship input validation.
 *
 * These rules deliberately mirror the CHECK constraints in
 * `supabase/migrations/20260101000007_scholarships.sql`. Duplicating them here
 * is not redundancy for its own sake: the database remains the authority and
 * will reject anything that slips through, but catching the same conditions at
 * the edge lets the editor see "Application link must use HTTPS" next to the
 * field instead of a raw Postgres error.
 *
 * Money is handled as integer minor units (cents). Floating point is never used
 * for currency, in the database or here.
 */

export const SCHOLARSHIP_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'expired',
  'archived',
] as const
export type ScholarshipStatus = (typeof SCHOLARSHIP_STATUSES)[number]

export const VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'disputed',
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** Optional trimmed text: blank input becomes null, never "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)

/**
 * Application links must use HTTPS.
 *
 * Mirrors `scholarships_application_url_https`. An `http://` application link
 * would send an applicant's credentials in clear text, so this is enforced
 * rather than warned about.
 *
 * Blank input becomes null, but only BEFORE validation: a plain `.url()` on the
 * raw string would reject `''` outright, which would make an empty field mean
 * "invalid" instead of "not provided yet".
 */
const httpsUrl = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .superRefine((value, ctx) => {
    if (value === null) return

    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid URL, including https://',
      })
      return
    }

    if (parsed.protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        message: 'Application links must use HTTPS.',
      })
    }
  })

/**
 * Optional ISO date.
 *
 * Blank becomes null BEFORE the format check, for the same reason as the URL
 * field above: an empty date input means "not set", not "malformed".
 */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Use the date format YYYY-MM-DD.',
  })

/**
 * Parse a currency string into integer cents without floating point.
 *
 * `toCents('1234.56')` → `123456`. Rejects more than two decimal places rather
 * than silently rounding, so an editor is never told an award is $1,234.56 when
 * they typed $1,234.567.
 */
export function toCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null

  const raw = value.trim().replace(/[, ]/g, '')
  if (raw === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return Number.NaN

  const [whole, fraction = ''] = raw.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Render integer cents back to a decimal string for the edit form. */
export function fromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => {
      if (v === '') return null
      const cents = toCents(v)
      // NaN is preserved so `.refine` below can report it meaningfully.
      return cents
    })
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || !Number.isNaN(v), {
      message: `${label} must be an amount such as 12500 or 12500.50.`,
    })
    .refine((v) => v === null || v === undefined || v >= 0, {
      message: `${label} cannot be negative.`,
    })

/* -------------------------------------------------------------------------- */
/* Slug                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * URL slug.
 *
 * `extensions.citext` makes uniqueness case-insensitive, so the slug is
 * lowercased on the way in. Two records differing only in case would otherwise
 * pass application-level checks and collide at the database.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'The URL slug must be at least 3 characters.')
  .max(200, 'The URL slug must be 200 characters or fewer.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens only.',
  )

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

export const scholarshipSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'A title is required.')
      .max(300, 'The title must be 300 characters or fewer.'),
    slug: slugSchema,
    sponsor_name: z
      .string()
      .trim()
      .min(1, 'A sponsor or provider name is required.')
      .max(300, 'The sponsor name must be 300 characters or fewer.'),

    institution_logo_url: optionalText(2000),
    institution_country: optionalText(100),

    summary: optionalText(400),
    description: optionalText(8000),
    eligibility_requirements: optionalText(4000),
    application_instructions: optionalText(4000),
    internal_notes: optionalText(4000),
    renewal_details: optionalText(1000),

    /** Newline or comma separated in the form; stored as text[]. */
    required_documents: z.string().trim().max(4000).optional().default(''),

    award_amount_min: moneyField('Minimum award'),
    award_amount_max: moneyField('Maximum award'),
    award_amount_text: optionalText(120),
    award_currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code such as USD.')
      .default('USD'),
    number_of_awards: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
        message: 'Enter a whole number greater than zero.',
      }),
    award_per_year: z.boolean().optional().default(false),
    application_fee: moneyField('Application fee'),
    is_renewable: z.boolean().optional().default(false),
    max_renewals: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
        message: 'Enter a whole number of zero or more.',
      }),

    opens_at: optionalDate,
    deadline: optionalDate,
    is_rolling: z.boolean().optional().default(false),

    application_url: httpsUrl,

    status: z.enum(SCHOLARSHIP_STATUSES).optional().default('draft'),
    verification_status: z
      .enum(VERIFICATION_STATUSES)
      .optional()
      .default('unverified'),

    featured: z.boolean().optional().default(false),
    noindex: z.boolean().optional().default(false),

    seo_title: optionalText(300),
    seo_description: optionalText(500),

    // Taxonomy assignment: arrays of UUIDs.
    category_ids: z.array(z.string().uuid()).optional().default([]),
    education_level_ids: z.array(z.string().uuid()).optional().default([]),
    field_ids: z.array(z.string().uuid()).optional().default([]),
    location_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .superRefine((value, ctx) => {
    const min = value.award_amount_min ?? null
    const max = value.award_amount_max ?? null

    // Mirrors scholarships_amount_range_valid.
    if (
      min !== null &&
      max !== null &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      max < min
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['award_amount_max'],
        message: 'The maximum award cannot be lower than the minimum.',
      })
    }

    // Mirrors scholarships_deadline_consistent.
    if (value.is_rolling && value.deadline) {
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message:
          'A rolling scholarship has no fixed deadline. Clear the deadline or turn off rolling applications.',
      })
    }

    if (value.opens_at && value.deadline && value.deadline < value.opens_at) {
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'The deadline cannot fall before the opening date.',
      })
    }

    /*
     * Mirrors scholarships_published_complete and
     * scholarships_verified_to_publish.
     *
     * Checking at the edge means the editor learns what is missing before the
     * database refuses the write, which is otherwise a confusing failure at the
     * moment they press Publish.
     */
    if (value.status === 'published') {
      if (!value.application_url) {
        ctx.addIssue({
          code: 'custom',
          path: ['application_url'],
          message:
            'A published scholarship needs an official application link.',
        })
      }

      if (
        value.verification_status === 'pending' ||
        value.verification_status === 'disputed'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['verification_status'],
          message:
            'Resolve the verification status before publishing. Mark it verified or explicitly unverified.',
        })
      }
    }
  })

export type ScholarshipInput = z.input<typeof scholarshipSchema>
export type ScholarshipRecord = z.output<typeof scholarshipSchema>

export { fieldErrorsFrom }

/** Split the required-documents textarea into a clean string[]. */
export function parseRequiredDocuments(input: string | null | undefined): string[] {
  if (!input) return []

  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50)
}

/** Build a slug from a title; the editor can still override it. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}