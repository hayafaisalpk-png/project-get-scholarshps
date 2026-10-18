import { z } from 'zod'

import { emailSchema } from '@/lib/validation/auth'

/**
 * Newsletter signup validation.
 *
 * Pure and framework-free so it is unit testable, and shared by the Server
 * Action and the client form. The server re-validates regardless.
 *
 * The shape mirrors `src/lib/validation/contact.ts` — a honeypot and a fill-time
 * stamp — because both forms are anonymous public writes into tables that no
 * client role may touch.
 */

/** Hidden from people, filled in by bots. See the note in `contact.ts`. */
export const NEWSLETTER_HONEYPOT_FIELD = 'website'

/** A person cannot meaningfully act on a checkbox in under two seconds. */
export const NEWSLETTER_MIN_FILL_SECONDS = 2

export const newsletterSchema = z.object({
  email: emailSchema,
  [NEWSLETTER_HONEYPOT_FIELD]: z.string().max(0, 'Rejected.').optional().default(''),
})

export type NewsletterInput = z.infer<typeof newsletterSchema>

/**
 * Lifecycle states mirrored from the `public.newsletter_status` enum.
 *
 * `pending` is the state a new signup actually lands in. It is NOT a temporary
 * "awaiting a confirmation email" state in the deployed configuration — no mail
 * provider is wired up — so the UI must not claim a confirmation email is coming.
 */
export const NEWSLETTER_STATUSES = [
  'pending',
  'subscribed',
  'unsubscribed',
  'bounced',
] as const

export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number]