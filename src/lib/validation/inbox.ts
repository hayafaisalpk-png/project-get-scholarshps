import { z } from 'zod'

/**
 * Inbox triage validation and status-transition rules.
 *
 * The public forms are validated in `@/lib/validation/contact`. This file covers
 * the OTHER direction — the administrative act of deciding what has been handled
 * — and is kept separate because the two have opposite trust properties: a public
 * form must accept anything a real person might type, while a triage action must
 * reject anything the database would reject anyway, with a readable message.
 *
 * PURE AND FRAMEWORK-FREE on purpose. The transition rules are the part most
 * likely to be got wrong — `content_reports_resolved_consistent` ties `status`
 * to `resolved_at`, and violating it fails the whole UPDATE — so they are built
 * and unit tested here rather than being assembled inline in a Server Action
 * where a regression would only show up against the live database.
 */

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * UUID shape check.
 *
 * The id arrives as a plain argument to a Server Action and is interpolated
 * into a PostgREST filter. Zod's `z.uuid()` validates it before that happens, so
 * a malformed value is rejected in the action rather than becoming a query.
 */
const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'That record could not be identified.',
  )

/* -------------------------------------------------------------------------- */
/* Contact messages                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the `public.contact_status` enum.
 *
 * Declared here rather than in the query layer because the Actions, the query
 * filters and the database must agree, and one list with one home is easier to
 * keep in step than three.
 */
export const CONTACT_STATUSES = [
  'new',
  'in_progress',
  'resolved',
  'spam',
] as const

export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  in_progress: 'In Process',
  resolved: 'Resolved',
  spam: 'Spam',
}

/**
 * The statuses a message can be moved TO from the inbox.
 *
 * `new` is deliberately absent as a destination. It is the arrival state, and
 * "move this back to new" is not a decision anyone makes while triaging — it is
 * reachable by simply not touching the message.
 */
export const CONTACT_TRIAGE_TARGETS = ['in_progress', 'resolved', 'spam'] as const

export const contactTriageSchema = z.object({
  id: uuidSchema,
  status: z
    .string()
    .trim()
    .refine(
      (value): value is ContactStatus =>
        (CONTACT_STATUSES as readonly string[]).includes(value),
      'Unknown status.',
    ),
  /** Must differ from the current status; a no-op is rejected, not silently accepted. */
  currentStatus: z
    .string()
    .trim()
    .refine(
      (value): value is ContactStatus =>
        (CONTACT_STATUSES as readonly string[]).includes(value),
      'Unknown current status.',
    ),
})

export type ContactTriageInput = z.infer<typeof contactTriageSchema>

export const contactDeleteSchema = z.object({ id: uuidSchema })
export const contactReadSchema = z.object({ id: uuidSchema })

export type ContactStatusPatch = {
  status: ContactStatus
  handled_by: string | null
  handled_at: string | null
}

/**
 * Build the `contact_submissions` patch for a triage action.
 *
 * `handled_by` and `handled_at` record WHO dealt with a message and WHEN, and
 * they are meaningful only once it has been resolved. Reopening a message clears
 * them rather than leaving a timestamp claiming someone handled something they
 * did not.
 *
 * `contact_submissions` has no CHECK tying these to `status` (unlike
 * `content_reports`), so this is a consistency rule of ours, not a database
 * constraint. It is enforced in one place so both the action and the tests agree.
 */
export function buildContactStatusPatch({
  status,
  actorId,
  now,
}: {
  status: ContactStatus
  actorId: string
  now: string
}): ContactStatusPatch {
  const isResolved = status === 'resolved'

  return {
    status,
    handled_by: isResolved ? actorId : null,
    handled_at: isResolved ? now : null,
  }
}

/* -------------------------------------------------------------------------- */
/* Content reports                                                             */
/* -------------------------------------------------------------------------- */

/** Mirrors the `public.report_status` enum. */
export const REPORT_STATUSES = [
  'open',
  'reviewing',
  'resolved',
  'dismissed',
] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  reviewing: 'Being checked',
  resolved: 'Corrected',
  dismissed: 'Dismissed',
}

/** Statuses that close a report. Each requires a written note. */
export const CLOSED_REPORT_STATUSES = ['resolved', 'dismissed'] as const

export const isClosedReportStatus = (
  status: ReportStatus,
): boolean => (CLOSED_REPORT_STATUSES as readonly string[]).includes(status)

/** A resolution note is evidence for a decision, so it is capped and required. */
export const RESOLUTION_NOTE_MAX = 1000

export const reportTriageSchema = z
  .object({
    id: uuidSchema,
    status: z
      .string()
      .trim()
      .refine(
        (value): value is ReportStatus =>
          (REPORT_STATUSES as readonly string[]).includes(value),
        'Unknown status.',
      ),
    currentStatus: z
      .string()
      .trim()
      .refine(
        (value): value is ReportStatus =>
          (REPORT_STATUSES as readonly string[]).includes(value),
        'Unknown current status.',
      ),
    resolutionNote: z
      .string()
      .trim()
      .max(RESOLUTION_NOTE_MAX, 'That note is too long.')
      .default(''),
  })
  .refine((value) => value.status !== value.currentStatus, {
    message: 'That report is already in that state.',
    path: ['status'],
  })
  .refine(
    (value) => !isClosedReportStatus(value.status) || value.resolutionNote.length > 0,
    {
      message:
        'Say what was done before closing a report — a correction with no record cannot be audited.',
      path: ['resolutionNote'],
    },
  )

export type ReportTriageInput = z.infer<typeof reportTriageSchema>

export type ReportStatusPatch = {
  status: ReportStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
}

/**
 * Build the `content_reports` patch for a triage action.
 *
 * THE IMPORTANT PART — this satisfies `content_reports_resolved_consistent`:
 *
 *   check (status in ('resolved','dismissed')) = (resolved_at is not null)
 *
 * Setting `status` without `resolved_at` fails the whole UPDATE with `23514`,
 * so the two are written together here and never separately at a call site.
 *
 * A note is REQUIRED to close a report and is CLEARED when one is reopened. The
 * note describes an action taken against a specific status; carrying it forward
 * onto a reopened report would assert a correction that has been undone.
 */
export function buildReportStatusPatch({
  status,
  note,
  actorId,
  now,
}: {
  status: ReportStatus
  note: string
  actorId: string
  now: string
}): ReportStatusPatch {
  const closed = isClosedReportStatus(status)
  const trimmed = note.trim()

  return {
    status,
    resolved_by: closed ? actorId : null,
    resolved_at: closed ? now : null,
    resolution_note: closed && trimmed.length > 0 ? trimmed : null,
  }
}
