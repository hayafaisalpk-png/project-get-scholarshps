'use server'

import { revalidatePath } from 'next/cache'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import {
  buildContactStatusPatch,
  buildReportStatusPatch,
  contactDeleteSchema,
  contactReadSchema,
  contactTriageSchema,
  type ContactStatus,
  reportTriageSchema,
  type ReportStatus,
} from '@/lib/validation/inbox'

/**
 * Inbox triage Server Actions.
 *
 * The two admin inboxes (`/admin/contact`, `/admin/reports`) were shipped
 * read-only. That was an honest gap rather than an oversight: the tables grant
 * UPDATE to the same permission that grants SELECT, but no action existed, so no
 * control was rendered rather than one that looked real and did nothing.
 *
 * These actions are that missing action. The ordering below is the same as every
 * other mutation in this codebase and is not incidental:
 *
 *   1. `requirePermission` — authorization BEFORE any input is looked at, so an
 *      unprivileged caller learns nothing about the shape of a valid request.
 *   2. Zod validation — the id must be a UUID and the status must be in the
 *      enum before it can reach a PostgREST filter.
 *   3. The write goes through the SESSION client, not the service-role client.
 *      That is deliberate: it means Row Level Security independently re-checks
 *      `contact.manage` / `report.manage` on the UPDATE itself, so a bug in this
 *      file cannot become a privilege escalation.
 *   4. `write_audit_log` last, recording the before and after states.
 *
 * Contact deletion is a separate, explicitly confirmed action. Reports remain
 * status-only and are never deleted from this inbox.
 */

export type InboxActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function fieldErrorsFrom(
  error: { issues: readonly { path: PropertyKey[]; message: string }[] },
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_form'
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

/**
 * Map a database error onto something an editor can act on.
 *
 * `23514` matters here: it is the `content_reports_resolved_consistent` CHECK
 * firing, and it would mean the patch builder and the constraint had drifted
 * apart. It is logged loudly rather than shown raw.
 */
function friendlyWriteError(
  code: string | null | undefined,
  message: string | undefined,
  context: string,
): string {
  console.error(`[inbox] ${context} failed:`, code, message)

  switch (code) {
    case '42501':
      return 'You do not have permission to make that change.'
    case '23514':
      return 'That status change breaks a data rule and was not saved.'
    case 'PGRST116':
      return 'That record no longer exists.'
    default:
      return 'The change could not be saved. Please try again.'
  }
}

/* -------------------------------------------------------------------------- */
/* Contact messages                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Move a message to a triage status.
 *
 * `currentStatus` is passed from the rendered row so the action can reject a
 * no-op. It is only a usability check — it is not trusted, and a caller who
 * passes a wrong value gains nothing, because the update itself is still bounded
 * by RLS and the row's real status is what ends up in the audit log.
 */
export async function setContactStatusAction(
  id: string,
  next: ContactStatus,
  currentStatus: ContactStatus,
): Promise<InboxActionResult> {
  const { user } = await requirePermission('contact.manage')

  const parsed = contactTriageSchema.safeParse({ id, status: next, currentStatus })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'That change is not valid.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  if (parsed.data.status === parsed.data.currentStatus) {
    return { ok: false, message: 'That message is already in that state.' }
  }

  const supabase = await createClient()

  /*
   * Read before writing so the audit log records a real transition. This SELECT
   * is authorised by the same policy as the UPDATE; a caller without
   * `contact.manage` never reaches this line.
   */
  const { data: before } = await supabase
    .from('contact_submissions')
    .select('status, subject')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (!before) {
    return { ok: false, message: 'That message could not be found.' }
  }

  const patch = buildContactStatusPatch({
    status: parsed.data.status,
    actorId: user.id,
    now: new Date().toISOString(),
  })

  const { error } = await supabase
    .from('contact_submissions')
    .update(patch)
    .eq('id', parsed.data.id)

  if (error) {
    return {
      ok: false,
      message: friendlyWriteError(error.code, error.message, 'contact status change'),
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'contact.status_change',
    p_entity_type: 'contact_submission',
    p_entity_id: parsed.data.id,
    p_before: { status: before.status },
    p_after: { status: patch.status, handled_at: patch.handled_at },
  })

  revalidatePath('/admin/contact')
  return { ok: true, message: `Moved to ${parsed.data.status.replace('_', ' ')}.` }
}

/** Permanently delete a contact message after the client-side confirmation. */
export async function deleteContactSubmissionAction(
  id: string,
): Promise<InboxActionResult> {
  const { user } = await requirePermission('contact.manage')
  const parsed = contactDeleteSchema.safeParse({ id })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'That message could not be deleted.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('contact_submissions')
    .select('id, name, email, subject, status')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (!before) return { ok: false, message: 'That message could not be found.' }

  const { data: deleted, error } = await supabase
    .from('contact_submissions')
    .delete()
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: friendlyWriteError(error.code, error.message, 'contact message deletion'),
    }
  }

  if (!deleted) return { ok: false, message: 'That message could not be found.' }

  await supabase.rpc('write_audit_log', {
    p_action: 'contact.delete',
    p_entity_type: 'contact_submission',
    p_entity_id: parsed.data.id,
    p_before: before,
    p_after: { deleted: true, actor_id: user.id },
  })

  revalidatePath('/admin/contact')
  return { ok: true, message: 'Message deleted.' }
}

/** Mark a contact message as read when an authorized editor opens it. */
export async function markContactReadAction(
  id: string,
): Promise<InboxActionResult> {
  const { user } = await requirePermission('contact.manage')
  const parsed = contactReadSchema.safeParse({ id })

  if (!parsed.success) {
    return { ok: false, message: 'That message could not be marked as read.' }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('contact_submissions')
    .select('read_at')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (!before) return { ok: false, message: 'That message could not be found.' }
  if (before.read_at) return { ok: true, message: 'Marked as read.' }

  const readAt = new Date().toISOString()
  const { error } = await supabase
    .from('contact_submissions')
    .update({ read_at: readAt })
    .eq('id', parsed.data.id)

  if (error) {
    return {
      ok: false,
      message: friendlyWriteError(error.code, error.message, 'marking contact message as read'),
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'contact.mark_read',
    p_entity_type: 'contact_submission',
    p_entity_id: parsed.data.id,
    p_before: { read_at: null },
    p_after: { read_at: readAt, actor_id: user.id },
  })

  revalidatePath('/admin/contact')
  return { ok: true, message: 'Marked as read.' }
}

/* -------------------------------------------------------------------------- */
/* Content reports                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Move a report to a triage status, optionally with a written note.
 *
 * Closing a report (`resolved` / `dismissed`) REQUIRES a note and writes
 * `resolved_at` in the same statement, because the database CHECK
 * `content_reports_resolved_consistent` equates the two. Reopening clears the
 * note rather than leaving a correction recorded against a report that is open
 * again.
 */
export async function setReportStatusAction(
  id: string,
  next: ReportStatus,
  currentStatus: ReportStatus,
  resolutionNote: string,
): Promise<InboxActionResult> {
  const { user } = await requirePermission('report.manage')

  const parsed = reportTriageSchema.safeParse({
    id,
    status: next,
    currentStatus,
    resolutionNote,
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'That change is not valid.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  if (parsed.data.status === parsed.data.currentStatus) {
    return { ok: false, message: 'That report is already in that state.' }
  }

  const supabase = await createClient()

  const { data: before } = await supabase
    .from('content_reports')
    .select('status, reason')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (!before) {
    return { ok: false, message: 'That report could not be found.' }
  }

  const patch = buildReportStatusPatch({
    status: parsed.data.status,
    note: parsed.data.resolutionNote,
    actorId: user.id,
    now: new Date().toISOString(),
  })

  const { error } = await supabase
    .from('content_reports')
    .update(patch)
    .eq('id', parsed.data.id)

  if (error) {
    return {
      ok: false,
      message: friendlyWriteError(error.code, error.message, 'report status change'),
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'report.status_change',
    p_entity_type: 'content_report',
    p_entity_id: parsed.data.id,
    p_before: { status: before.status },
    p_after: {
      status: patch.status,
      resolved_at: patch.resolved_at,
      resolution_note: patch.resolution_note,
    },
  })

  revalidatePath('/admin/reports')
  return { ok: true, message: `Moved to ${parsed.data.status}.` }
}
