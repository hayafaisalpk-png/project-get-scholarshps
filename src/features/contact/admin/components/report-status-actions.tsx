'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import {
  setReportStatusAction,
  type InboxActionResult,
} from '@/features/contact/admin/actions'
import {
  isClosedReportStatus,
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from '@/lib/validation/inbox'
import { InboxActionButton } from './inbox-action-button'

/**
 * Per-report triage controls.
 *
 * Closing a report ("Corrected" / "Dismissed") opens a note field, because the
 * note is not optional — a correction that leaves no record of what was done
 * cannot be audited, and the server rejects an empty one. The note is written to
 * `content_reports.resolution_note` in the same UPDATE as the status, because the
 * `content_reports_resolved_consistent` CHECK equates a closed status with a
 * non-null `resolved_at`.
 *
 * Reopening is deliberately one click and clears the note. The note describes an
 * action taken against a report that was open; carrying it onto a reopened report
 * would assert a correction that has been undone.
 */
export function ReportStatusActions({
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
  const [noteFor, setNoteFor] = useState<ReportStatus | null>(null)
  const [note, setNote] = useState('')
  const noteFieldId = useId()

  const current: ReportStatus =
    status in REPORT_STATUS_LABELS ? (status as ReportStatus) : 'open'
  const isClosed = isClosedReportStatus(current)

  function apply(next: ReportStatus, withNote = '') {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result: InboxActionResult = await setReportStatusAction(
        id,
        next,
        current,
        withNote,
      )
      if (result.ok) {
        setMessage(result.message)
        setNoteFor(null)
        setNote('')
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  function close(target: ReportStatus) {
    // An empty note is refused by the server; catching it here keeps the field
    // open with the message attached to the input rather than shown bare.
    if (note.trim().length === 0) {
      setError(
        'Say what was done before closing this report. The note is kept on the record.',
      )
      return
    }
    apply(target, note)
  }

  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {current !== 'reviewing' ? (
          <InboxActionButton
            label={REPORT_STATUS_LABELS.reviewing}
            onClick={() => apply('reviewing')}
            disabled={pending}
          />
        ) : null}

        {!isClosed ? (
          <>
            <InboxActionButton
              label={REPORT_STATUS_LABELS.resolved}
              onClick={() => (noteFor === 'resolved' ? setNoteFor(null) : setNoteFor('resolved'))}
              disabled={pending}
              tone="primary"
            />
            <InboxActionButton
              label={REPORT_STATUS_LABELS.dismissed}
              onClick={() => (noteFor === 'dismissed' ? setNoteFor(null) : setNoteFor('dismissed'))}
              disabled={pending}
            />
          </>
        ) : (
          <InboxActionButton
            label="Reopen"
            onClick={() => apply('open')}
            disabled={pending}
            tone="primary"
          />
        )}
      </div>

      {noteFor ? (
        <div className="mt-3 rounded-sm border border-ink-200 bg-ink-50 p-3">
          <label
            htmlFor={noteFieldId}
            className="block text-xs font-semibold text-ink-800"
          >
            What was done
          </label>
          <p className="mt-1 text-xs text-ink-600">
            Recorded against this report and kept in the audit log.
          </p>
          <textarea
            id={noteFieldId}
            name="resolutionNote"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-2 w-full rounded-sm border border-ink-300 bg-white px-2.5 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => close(noteFor)}
              disabled={pending}
              className="rounded-sm bg-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
            >
              {pending ? 'Saving…' : `Confirm: ${REPORT_STATUS_LABELS[noteFor]}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteFor(null)
                setNote('')
                setError(null)
              }}
              className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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