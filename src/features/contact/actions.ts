'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient, hasAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  HONEYPOT_FIELD,
  MIN_FILL_SECONDS,
  contactSchema,
  fieldErrorsFrom,
  reportSchema,
} from '@/lib/validation/contact'

/**
 * Public submission Server Actions: contact messages and content reports.
 *
 * ABUSE HANDLING — what these actions do and, just as importantly, what they do
 * not do.
 *
 * Present: Zod validation, length caps, a honeypot field, and a minimum
 * fill time. Together these reject the naive scripted submitters, which is most
 * of them.
 *
 * Absent: RATE LIMITING. `UPSTASH_REDIS_REST_URL` exists in the environment
 * schema but no Redis client is installed, and `AGENTS.md` §2.10 forbids adding
 * a dependency without justification. Until that is decided, this is a spam
 * *reduction*, not spam prevention: a determined bot that solves the honeypot
 * and waits two seconds can still submit. That is recorded as an open item in
 * `docs/CHANGELOG.md` rather than papered over.
 *
 * TWO DIFFERENT CLIENTS, ON PURPOSE
 *
 * `content_reports` has an anon INSERT policy and grant (migration 010), so the
 * report action uses the SESSION client and RLS constrains it: the row can only
 * be created with `status = 'open'` and `resolved_at is null`, which the action
 * does not even get to choose.
 *
 * `contact_submissions` is fully revoked from anon and authenticated (migrations
 * 010 and 013). There is no RLS route in, so this action uses the service-role
 * client — the same pattern as role assignment, which migration 010 documents.
 * Because that client bypasses RLS, the service-role key is never handed a
 * request body unchecked: every field is validated and bounded above first.
 */

/**
 * Values echoed back to the form when validation fails.
 *
 * React 19 resets the fields of a `<form action={serverAction}>` once the
 * action resolves — that behaviour is what stops a successful submission from
 * reappearing in the form. It is indiscriminate, though: it also wipes the page
 * after a REJECTED submission, so a visitor who mistypes their email loses the
 * whole message they just wrote, and the alert tells them to "check the
 * highlighted fields" while every field is now empty.
 *
 * Echoing the submitted values back and restoring them as `defaultValue` is the
 * fix. The values are attacker-controlled, which is safe here because React
 * escapes attribute values — there is no path from this object to markup. The
 * honeypot is deliberately NOT echoed, or a bot would simply resubmit it.
 */
type EchoedValues = Record<string, string>

export type SubmissionResult =
  | { ok: true; message: string }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      values?: EchoedValues
    }

/**
 * Bounded, untrusted strings to echo back.
 *
 * Clipped to the same limits the schemas enforce, so a 10MB `message` cannot be
 * reflected back into the response.
 */
function echo(source: FormData, keys: readonly string[]): EchoedValues {
  const out: EchoedValues = {}
  for (const key of keys) {
    const raw = source.get(key)
    if (typeof raw !== 'string') continue
    const clipped = raw.slice(0, 5000)
    if (clipped.length > 0) out[key] = clipped
  }
  return out
}

/** Uniform success copy, so nothing about the submission is echoed back. */
const CONTACT_THANKS =
  'Thank you — your message has been received and is queued for the editorial team.'

const REPORT_THANKS =
  'Thank you. Your report has been logged and will be checked against the official source.'

/* -------------------------------------------------------------------------- */
/* Shared anti-spam checks                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Honeypot and timing checks.
 *
 * Returns null when the submission looks automated, or a rejection reason when
 * it does not. `null` here means "do not proceed" — deliberately the same shape
 * as the success path's message, so a bot cannot tell which check tripped.
 */
function spamVerdict(formData: FormData): string | null {
  const honeypot = formData.get(HONEYPOT_FIELD)
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return 'Your message looks like it was sent automatically and was not accepted.'
  }

  const renderedAt = formData.get('renderedAt')
  if (typeof renderedAt === 'string' && renderedAt.trim() !== '') {
    const elapsed = Date.now() - Date.parse(renderedAt)
    // NaN-safe: an unparseable value means the field was tampered with or the
    // clock moved, and neither should silently disable the check.
    if (Number.isFinite(elapsed) && elapsed < MIN_FILL_SECONDS * 1000) {
      return 'That was submitted too quickly. Please try again.'
    }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Contact message                                                             */
/* -------------------------------------------------------------------------- */

export async function submitContactAction(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  const spam = spamVerdict(formData)
  if (spam) return { ok: false, message: spam }

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    [HONEYPOT_FIELD]: formData.get(HONEYPOT_FIELD),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echo(formData, ['name', 'email', 'subject', 'message']),
    }
  }

  if (!hasAdminClient()) {
    // Fail loudly in the server log, but tell the visitor the truth rather than
    // pretending the message was accepted.
    console.error(
      '[contact] SUPABASE_SERVICE_ROLE_KEY is not configured, so the message ' +
        'could not be stored. The contact form cannot accept submissions.',
    )
    return {
      ok: false,
      message:
        'The contact form is unavailable right now. Please try again later.',
    }
  }

  const admin = createAdminClient()

  const { error } = await admin.from('contact_submissions').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    // Stored as-is: this is plain text, and the inbox renders it as text rather
    // than as markup, so there is no injection surface to sanitise away.
    message: parsed.data.message,
  })

  if (error) {
    console.error('[contact] insert failed:', error.message)
    return {
      ok: false,
      message: 'Your message could not be sent. Please try again.',
    }
  }

  // The success state is rendered from the action result, so the form must not
  // be re-rendered from a stale cache that still contains the old fields.
  revalidatePath('/contact')

  return { ok: true, message: CONTACT_THANKS }
}

/* -------------------------------------------------------------------------- */
/* Content report                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Submit a "report incorrect information" report.
 *
 * The slug arrives from the URL and is fully attacker-controlled, so it is
 * resolved to a row id HERE, server-side, through the session client. RLS then
 * guarantees the resolved record is publicly visible — a report cannot be
 * attached to a draft, and cannot be used to probe for unpublished slugs because
 * the lookup simply fails.
 */
export async function submitReportAction(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  const spam = spamVerdict(formData)
  if (spam) return { ok: false, message: spam }

  const parsed = reportSchema.safeParse({
    target: formData.get('target'),
    reason: formData.get('reason'),
    details: formData.get('details'),
    email: formData.get('email'),
    [HONEYPOT_FIELD]: formData.get(HONEYPOT_FIELD),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echo(formData, ['reason', 'details', 'email']),
    }
  }

  const slug = formData.get('slug')
  if (typeof slug !== 'string' || slug.trim().length === 0) {
    return {
      ok: false,
      message: 'We could not tell which record this report is about.',
    }
  }

  const supabase = await createClient()
  const target = parsed.data.target

  const table = target === 'article' ? 'articles' : 'scholarships'

  // `maybeSingle` + the session client means RLS does the filtering: an
  // unpublished record is invisible here, which is exactly the desired outcome.
  const { data: record, error: lookupError } = await supabase
    .from(table)
    .select('id')
    .eq('slug', slug.trim())
    .maybeSingle()

  if (lookupError) {
    console.error('[report] lookup failed:', lookupError.message)
    return {
      ok: false,
      message: 'Your report could not be submitted. Please try again.',
    }
  }

  if (!record) {
    return {
      ok: false,
      message:
        'We could not find that record. It may have been removed — please report it through the contact page instead.',
    }
  }

  /*
   * `content_reports_exactly_one_target` requires exactly one of the two ids,
   * so the unselected column must be explicitly null rather than absent.
   *
   * The two branches are spelled out rather than using a computed key. A
   * computed `[column]` widens the object to an index signature, which loses the
   * `Insert` type checking that would otherwise catch a wrong column name — and
   * the whole point of this branch is that the column name is easy to get wrong.
   */
  const shared = {
    reason: parsed.data.reason,
    details: parsed.data.details === '' ? null : parsed.data.details,
    reporter_email: parsed.data.email === '' ? null : parsed.data.email,
    // status defaults to 'open' and resolved_at to null in the schema, and the
    // RLS insert policy requires both — stated here so the intent is visible at
    // the call site rather than only in the policy.
    status: 'open' as const,
    resolved_at: null,
  }

  const { error } = await supabase
    .from('content_reports')
    .insert(
      target === 'article'
        ? { ...shared, article_id: record.id }
        : { ...shared, scholarship_id: record.id },
    )

  if (error) {
    console.error('[report] insert failed:', error.message)
    return {
      ok: false,
      message: 'Your report could not be submitted. Please try again.',
    }
  }

  revalidatePath('/contact')

  return { ok: true, message: REPORT_THANKS }
}