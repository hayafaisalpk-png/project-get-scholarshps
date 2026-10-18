'use server'

import { revalidatePath } from 'next/cache'

import { findRedirectByPath } from '@/features/redirects/queries'
import { invalidateRedirectCache } from '@/features/redirects/store'
import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import {
  fieldErrorsFrom,
  redirectSchema,
} from '@/features/redirects/validation'
import { validateRedirectRule, detectRedirectLoop } from './resolution'
import type { RedirectStatusCode } from './resolution'

/**
 * Redirect management Server Actions.
 *
 * Requires `seo.manage`, which is exactly the permission the `redirects` UPDATE
 * policy requires, so the guard and RLS agree rather than one compensating for
 * the other. The write goes through the session client for the same reason.
 *
 * `invalidateRedirectCache()` is called after every successful write. See
 * `src/features/redirects/store.ts` for what that does and does not guarantee on
 * a multi-instance deployment — the TTL is the real bound.
 *
 * NO REDIRECT IS EVER SILENTLY APPLIED ON BEHALF OF THE SITE ROOT, and no rule
 * can be created that this codebase's own `validateRedirectRule` rejects. The
 * action and the request-time resolver share that function, so a rule that cannot
 * be validated cannot be stored and cannot fire.
 */

export type RedirectActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function friendlyWriteError(
  code: string | null | undefined,
  message: string | undefined,
): string {
  console.error('[redirects] write failed:', code, message)

  switch (code) {
    case '23505':
      return 'That old path already has a redirect.'
    case '23514':
      return 'Those values break a data rule and were not saved.'
    case '42501':
      return 'You do not have permission to change redirects.'
    default:
      return 'The change could not be saved. Please try again.'
  }
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/**
 * Would this rule send a visitor round in circles?
 *
 * Checked before the write rather than at request time, because the request-time
 * behaviour (refuse the redirect, serve a 404) is confusing to diagnose from a
 * URL. Telling the editor "these two rules form a loop" at the moment of saving
 * is the difference between a five-second fix and an afternoon.
 *
 * Reads every rule, so it uses the session client and stays inside the same
 * `seo.manage` boundary as the write it is protecting.
 */
async function wouldLoop(from: string, to: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('redirects')
    .select('from_path, to_path, status_code')

  const rules = new Map(
    ((data ?? []) as { from_path: string; to_path: string; status_code: number }[]).map(
      (row) => [
        row.from_path,
        {
          from: row.from_path,
          to: row.to_path,
          statusCode: row.status_code as RedirectStatusCode,
        },
      ],
    ),
  )

  return detectRedirectLoop(rules, from, to)
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export async function createRedirectAction(
  _prev: RedirectActionResult | null,
  formData: FormData,
): Promise<RedirectActionResult> {
  await requirePermission('seo.manage')

  const parsed = redirectSchema.safeParse({
    from: text(formData, 'from'),
    to: text(formData, 'to'),
    statusCode: text(formData, 'statusCode'),
    note: text(formData, 'note'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const { from, to, statusCode, note } = parsed.data

  // A readable message beats letting the primary key reject the insert.
  const existing = await findRedirectByPath(from)
  if (existing) {
    return {
      ok: false,
      message: 'That old path already has a redirect.',
      fieldErrors: { from: 'This path is already redirected.' },
    }
  }

  if (await wouldLoop(from, to)) {
    return {
      ok: false,
      message:
        'That would create a redirect loop: following it would come back to where it started.',
      fieldErrors: { to: 'This would loop back to a path that already redirects.' },
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('redirects').insert({
    from_path: from,
    to_path: to,
    status_code: statusCode,
    note: note === '' ? null : note,
  })

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'redirect.create',
    p_entity_type: 'redirect',
    p_entity_id: from,
    p_after: { from, to, statusCode },
  })

  invalidateRedirectCache()
  revalidatePath('/admin/redirects')

  return { ok: true, message: `Redirect saved: ${from} → ${to}.` }
}

/* -------------------------------------------------------------------------- */
/* Update                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `from_path` is the primary key, so it is the record's identity: changing it is
 * a delete and an insert, not an update. That is why this action targets the
 * existing path and ignores any attempt to move it — an editor who needs a
 * different source creates a new rule and deletes this one.
 */
export async function updateRedirectAction(
  _prev: RedirectActionResult | null,
  formData: FormData,
): Promise<RedirectActionResult> {
  await requirePermission('seo.manage')

  const from = text(formData, 'from')
  if (!from) return { ok: false, message: 'Missing redirect reference.' }

  const parsed = redirectSchema.safeParse({
    from,
    to: text(formData, 'to'),
    statusCode: text(formData, 'statusCode'),
    note: text(formData, 'note'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const { to, statusCode, note } = parsed.data

  // Re-checked here even though the schema validated it: this is the function the
  // request-time resolver relies on, and an action that stored something the
  // resolver would reject would create a rule that misbehaves in production.
  const check = validateRedirectRule({ from, to })
  if (!check.ok) return { ok: false, message: check.message }

  if (await wouldLoop(from, to)) {
    return {
      ok: false,
      message:
        'That would create a redirect loop: following it would come back to where it started.',
    }
  }

  const supabase = await createClient()

  const { data: before } = await supabase
    .from('redirects')
    .select('to_path, status_code, is_active')
    .eq('from_path', from)
    .maybeSingle()

  if (!before) return { ok: false, message: 'That redirect no longer exists.' }

  const { error } = await supabase
    .from('redirects')
    .update({
      to_path: to,
      status_code: statusCode,
      note: note === '' ? null : note,
    })
    .eq('from_path', from)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'redirect.update',
    p_entity_type: 'redirect',
    p_entity_id: from,
    p_before: before,
    p_after: { to, statusCode },
  })

  invalidateRedirectCache()
  revalidatePath('/admin/redirects')

  return { ok: true, message: 'Redirect updated.' }
}

/* -------------------------------------------------------------------------- */
/* Active toggle                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pause or resume a rule without deleting it.
 *
 * The safer default for a redirect that turned out to be wrong: turning it off is
 * reversible and keeps the audit trail intact, whereas deleting it loses the
 * reason it was created. `from_path` is immutable, so this can never change the
 * identity of the rule.
 */
export async function setRedirectActiveAction(
  from: string,
  isActive: boolean,
): Promise<RedirectActionResult> {
  await requirePermission('seo.manage')

  if (!from.startsWith('/') || from.startsWith('//')) {
    return { ok: false, message: 'That redirect could not be identified.' }
  }

  const supabase = await createClient()

  const { data: before } = await supabase
    .from('redirects')
    .select('is_active')
    .eq('from_path', from)
    .maybeSingle()

  if (!before) return { ok: false, message: 'That redirect no longer exists.' }

  const { error } = await supabase
    .from('redirects')
    .update({ is_active: isActive })
    .eq('from_path', from)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: isActive ? 'redirect.enable' : 'redirect.disable',
    p_entity_type: 'redirect',
    p_entity_id: from,
    p_before: { is_active: before.is_active },
    p_after: { is_active: isActive },
  })

  invalidateRedirectCache()
  revalidatePath('/admin/redirects')

  return { ok: true, message: isActive ? 'Redirect active.' : 'Redirect paused.' }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Delete a rule.
 *
 * This is a genuine delete, and it is offered because a rule that points at a
 * 404 or an external site an editor no longer trusts should be removable, not
 * merely paused. It takes a two-step confirmation in the UI for the same reason
 * every other destructive control in this codebase does.
 */
export async function deleteRedirectAction(
  from: string,
): Promise<RedirectActionResult> {
  await requirePermission('seo.manage')

  if (!from.startsWith('/') || from.startsWith('//')) {
    return { ok: false, message: 'That redirect could not be identified.' }
  }

  const supabase = await createClient()

  const { data: before } = await supabase
    .from('redirects')
    .select('to_path, status_code, is_active')
    .eq('from_path', from)
    .maybeSingle()

  if (!before) return { ok: false, message: 'That redirect no longer exists.' }

  const { error } = await supabase.from('redirects').delete().eq('from_path', from)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'redirect.delete',
    p_entity_type: 'redirect',
    p_entity_id: from,
    p_before: before,
  })

  invalidateRedirectCache()
  revalidatePath('/admin/redirects')

  return { ok: true, message: 'Redirect deleted.' }
}