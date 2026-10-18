'use server'

import { createAdminClient, hasAdminClient } from '@/lib/supabase/admin'
import { fieldErrorsFrom } from '@/lib/validation/auth'
import {
  NEWSLETTER_HONEYPOT_FIELD,
  NEWSLETTER_MIN_FILL_SECONDS,
  newsletterSchema,
} from '@/lib/validation/newsletter'

/**
 * Newsletter signup Server Action.
 *
 * WHY THE SERVICE-ROLE CLIENT
 *
 * `newsletter_subscribers` is revoked from `anon` and `authenticated` entirely
 * (migrations 010 and 013), so there is no RLS route in. That is correct: the
 * table holds a list of real people's email addresses and a record of what they
 * consented to. It must never be readable by a client, and a public INSERT
 * privilege would be the wrong shape anyway — it would let anyone who discovered
 * the endpoint enumerate addresses by inserting and reading back.
 *
 * So the write happens server-side with full validation, exactly as role
 * assignment does (see the comment in migration 010).
 *
 * LIFECYCLE, WHICH IS THE INTERESTING PART
 *
 * `email` has a UNIQUE constraint, so a naive insert fails on the second signup
 * from the same person — the most common case there is. The states are handled
 * explicitly rather than by collapsing them into one error:
 *
 *   pending / subscribed → already on the list; say so, change nothing
 *   unsubscribed        → a genuine re-subscription; reinstate and restamp consent
 *   bounced             → do NOT silently reinstate; tell the visitor plainly
 *
 * Reinstating a bounced address is the case worth being careful about. An address
 * that hard-bounced once is likely to hard-bounce again, and quietly re-adding it
 * damages the sender reputation of every address on the list.
 */
export type NewsletterResult =
  | { ok: true; message: string }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      /**
       * Echoed back so the form can restore what was typed. React clears a
       * `<form action>` once the action resolves, which would otherwise wipe the
       * address a visitor mistyped. Safe to reflect because React escapes
       * attribute values.
       */
      values?: { email?: string }
    }

/** Anti-spam, identical in shape to the contact form's checks. */
function spamVerdict(formData: FormData): string | null {
  const honeypot = formData.get(NEWSLETTER_HONEYPOT_FIELD)
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return 'That submission looked automated and was not accepted.'
  }

  const renderedAt = formData.get('renderedAt')
  if (typeof renderedAt === 'string' && renderedAt.trim() !== '') {
    const elapsed = Date.now() - Date.parse(renderedAt)
    if (Number.isFinite(elapsed) && elapsed < NEWSLETTER_MIN_FILL_SECONDS * 1000) {
      return 'That was submitted too quickly. Please try again.'
    }
  }

  return null
}

export async function subscribeToNewsletter(
  _prev: NewsletterResult | null,
  formData: FormData,
): Promise<NewsletterResult> {
  const spam = spamVerdict(formData)
  if (spam) return { ok: false, message: spam }

  const parsed = newsletterSchema.safeParse({
    email: formData.get('email'),
    [NEWSLETTER_HONEYPOT_FIELD]: formData.get(NEWSLETTER_HONEYPOT_FIELD),
  })

  if (!parsed.success) {
    const raw = formData.get('email')
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
      ...(typeof raw === 'string' && raw.length > 0
        ? { values: { email: raw.slice(0, 320) } }
        : {}),
    }
  }

  if (!hasAdminClient()) {
    console.error(
      '[newsletter] SUPABASE_SERVICE_ROLE_KEY is not configured, so the ' +
        'signup could not be stored.',
    )
    return {
      ok: false,
      message:
        'Signing up is unavailable right now. Please try again later.',
    }
  }

  const admin = createAdminClient()
  const email = parsed.data.email
  const now = new Date().toISOString()

  const { data: existing, error: lookupError } = await admin
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[newsletter] lookup failed:', lookupError.message)
    return {
      ok: false,
      message: 'Your signup could not be saved. Please try again.',
    }
  }

  if (existing) {
    const status = String(existing.status)

    if (status === 'bounced') {
      // Deliberately not reinstated. See the note above.
      return {
        ok: true,
        message:
          'That address previously failed to receive our email and cannot be re-added automatically. Please use a different address.',
      }
    }

    if (status === 'pending' || status === 'subscribed') {
      return {
        ok: true,
        message: 'That address is already on our list — nothing more to do.',
      }
    }

    // unsubscribed → a real re-subscription. Consent is restamped, because the
    // old consent record no longer describes what the visitor just did.
    const { error: reinstateError } = await admin
      .from('newsletter_subscribers')
      .update({
        status: 'pending',
        consent_given_at: now,
        unsubscribed_at: null,
      })
      .eq('id', existing.id)

    if (reinstateError) {
      console.error('[newsletter] reinstate failed:', reinstateError.message)
      return {
        ok: false,
        message: 'Your signup could not be saved. Please try again.',
      }
    }

    return { ok: true, message: THANK_YOU }
  }

  /*
   * `source` records that the signup came from the public form rather than an
   * import. `ip_hash` is deliberately left null: no IP is available to the
   * Server Action without collecting it, and the column is documented as
   * "salted hash only", so writing a raw address there would violate its own
   * contract.
   */
  const { error } = await admin.from('newsletter_subscribers').insert({
    email,
    status: 'pending',
    consent_given_at: now,
    source: 'footer_form',
    ip_hash: null,
  })

  if (error) {
    console.error('[newsletter] insert failed:', error.message)
    return {
      ok: false,
      message: 'Your signup could not be saved. Please try again.',
    }
  }

  return { ok: true, message: THANK_YOU }
}

/**
 * The success copy.
 *
 * It deliberately does NOT promise an email. No mail provider is configured —
 * `SMTP_HOST` and friends are empty — so no confirmation or welcome message can
 * be sent, and `status` stays `pending` because nothing has confirmed it.
 * Promising "check your inbox" would be a promise the system cannot keep, and
 * `AGENTS.md` §2.5 forbids presenting that as finished work.
 *
 * The surrounding UI states the same thing in plain words, so the visitor is told
 * what they are actually signing up for.
 */
const THANK_YOU =
  'Your address has been recorded. We are not sending email yet — this list is how we will notify you when we do.'