import { z } from 'zod'

/**
 * Contact and content-report input validation.
 *
 * Pure and framework-free so it can be unit tested directly, and imported by
 * both the Server Actions (which must validate) and the client forms (which
 * pre-validate). The server re-validates regardless: client validation is a
 * usability feature, never a security control.
 *
 * The two forms write to DIFFERENT tables on purpose:
 *
 *   contact  -> `contact_submissions`  (a message to a person)
 *   report   -> `content_reports`      (a correction against a specific record)
 *
 * Mixing them would mean every "this deadline is wrong" report queued in an
 * inbox that no one triages by record, and every correction buried in a mailbox
 * that has no resolve workflow. The report path is what the scholarship and
 * article pages link to, so it has to identify the record it is about.
 */

import { emailSchema, fieldErrorsFrom } from '@/lib/validation/auth'

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Honeypot field name.
 *
 * A real person never sees this input — it is hidden from sight and from
 * assistive technology, so leaving it empty is what a human does. Automated
 * submitters fill in every field they find, which is what this catches.
 */
export const HONEYPOT_FIELD = 'website'

/**
 * Minimum seconds between a form being served and being submitted.
 *
 * A human cannot read and answer a four-field message in under two seconds. This
 * rejects naive scripted submitters; it is not a rate limiter, and the comment
 * in the action says so.
 */
export const MIN_FILL_SECONDS = 2

/* -------------------------------------------------------------------------- */
/* Contact message                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Subject options.
 *
 * A closed vocabulary rather than free text: it makes messages triageable, which
 * is the entire point of storing them in a structured table. "Other" plus a
 * required message covers anything not listed.
 */
export const CONTACT_SUBJECTS = [
  'general',
  'correction',
  'question',
  'partnership',
  'feedback',
] as const

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]

export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  general: 'General enquiry',
  correction: 'Correcting something on the site',
  question: 'A question about using the site',
  partnership: 'Working together',
  feedback: 'Feedback or suggestion',
}

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(120, 'That name is too long.'),
  email: emailSchema,
  whatsapp_no: z
    .string()
    .trim()
    .max(30, 'That WhatsApp number is too long.')
    .refine(
      (value) => value === '' || /^(?=(?:\D*\d){7,20}\D*$)[+()\d\s-]+$/.test(value),
      'Enter a valid WhatsApp number or leave this field empty.',
    )
    .default(''),
  subject: z
    .string()
    .trim()
    .refine(
      (value): value is ContactSubject =>
        (CONTACT_SUBJECTS as readonly string[]).includes(value),
      'Choose a subject.',
    ),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least a sentence or two.')
    .max(5000, 'That message is too long.'),
  [HONEYPOT_FIELD]: z.string().max(0, 'Rejected.').optional().default(''),
})

export type ContactInput = z.infer<typeof contactSchema>

/* -------------------------------------------------------------------------- */
/* Content report                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Reason codes, mirroring the `public.report_reason` enum.
 *
 * Kept as a literal union and asserted against the enum at the insert site, so
 * adding a code here without adding it to the database fails the build rather
 * than failing at runtime for a visitor.
 */
export const REPORT_REASONS = [
  'incorrect_deadline',
  'incorrect_amount',
  'not_eligible',
  'no_longer_available',
  'broken_link',
  'duplicate',
  'other',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  incorrect_deadline: 'The deadline is wrong',
  incorrect_amount: 'The award amount is wrong',
  not_eligible: 'The eligibility criteria are wrong',
  no_longer_available: 'It is no longer available',
  broken_link: 'The application link is broken',
  duplicate: 'It is a duplicate of another record',
  other: 'Something else is wrong',
}

/** What a report can be filed against. */
export const REPORT_TARGETS = ['scholarship', 'article'] as const
export type ReportTarget = (typeof REPORT_TARGETS)[number]

export const reportSchema = z.object({
  target: z
    .string()
    .trim()
    .refine(
      (value): value is ReportTarget =>
        (REPORT_TARGETS as readonly string[]).includes(value),
      'Unknown record type.',
    ),
  reason: z
    .string()
    .trim()
    .refine(
      (value): value is ReportReason =>
        (REPORT_REASONS as readonly string[]).includes(value),
      'Choose what is wrong.',
    ),
  details: z
    .string()
    .trim()
    .max(2000, 'That description is too long.')
    .optional()
    .default(''),
  email: emailSchema.optional().or(z.literal('')),
  [HONEYPOT_FIELD]: z.string().max(0, 'Rejected.').optional().default(''),
})

export type ReportInput = z.infer<typeof reportSchema>

export { fieldErrorsFrom }
