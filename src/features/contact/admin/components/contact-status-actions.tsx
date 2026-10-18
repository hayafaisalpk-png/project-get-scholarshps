'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  setContactStatusAction,
  type InboxActionResult,
} from '@/features/contact/admin/actions'
import {
  CONTACT_STATUS_LABELS,
  CONTACT_TRIAGE_TARGETS,
  type ContactStatus,
} from '@/lib/validation/inbox'
import { InboxActionButton } from './inbox-action-button'

/**
 * Per-message triage controls.
 *
 * A Client Component because it dispatches a Server Action on click. The
 * permission check is NOT here — `requirePermission('contact.manage')` runs
 * inside the action, and the RLS policy runs again on the UPDATE. This component
 * only decides what is worth offering; the server decides what is allowed.
 *
 * Status changes are reversible, so they are single-click rather than
 * two-step-confirmed. "Spam" is the exception: it is the target an editor is
 * most likely to reach for by mistake, so it takes a confirm step. The confirm
 * is two real buttons, so the destructive choice is never the default and the
 * interaction stays keyboard-operable.
 *
 * The outcome is announced through an `aria-live` region, because a button that
 * changes a server-side status leaves the list looking identical until the
 * refresh lands.
 */
export function ContactStatusActions({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingSpam, setConfirmingSpam] = useState(false)

  /*
   * A status the database does not know about must not become the `currentStatus`
   * argument, because the action compares the two and would then treat every
   * target as a change. An unrecognised value degrades to `new`, which is the
   * arrival state and the only safe fallback.
   */
  const current: ContactStatus =
    status in CONTACT_STATUS_LABELS ? (status as ContactStatus) : 'new'
  const targets = CONTACT_TRIAGE_TARGETS.filter((value) => value !== current)

  function apply(next: ContactStatus) {
    setMessage(null)
    setError(null)
    setConfirmingSpam(false)
    startTransition(async () => {
      const result: InboxActionResult = await setContactStatusAction(
        id,
        next,
        current,
      )
      if (result.ok) {
        setMessage(result.message)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {targets.includes('in_progress') ? (
          <InboxActionButton
            label={CONTACT_STATUS_LABELS.in_progress}
            onClick={() => apply('in_progress')}
            disabled={pending}
          />
        ) : null}

        {targets.includes('resolved') ? (
          <InboxActionButton
            label={CONTACT_STATUS_LABELS.resolved}
            onClick={() => apply('resolved')}
            disabled={pending}
            tone="primary"
          />
        ) : null}

        {targets.includes('spam') ? (
          confirmingSpam ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => apply('spam')}
                disabled={pending}
                className="rounded-sm bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Confirm spam'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingSpam(false)}
                className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                Cancel
              </button>
            </span>
          ) : (
            <InboxActionButton
              label="Spam"
              onClick={() => setConfirmingSpam(true)}
              disabled={pending}
              tone="danger"
            />
          )
        ) : null}
      </div>

      {/* Polite announcement of success; errors use `role="alert"` below. */}
      <p role="status" aria-live="polite" className="sr-only">
        {message ?? ''}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {message && !error ? (
        <p className="mt-2 text-xs text-ink-500">{message}</p>
      ) : null}
    </div>
  )
}