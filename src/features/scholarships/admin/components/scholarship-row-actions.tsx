'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  deleteScholarshipAction,
  setScholarshipStatusAction,
  toggleFeaturedAction,
} from '@/features/scholarships/admin/actions'
import type { ScholarshipStatus } from '@/lib/validation/scholarship'

/**
 * Per-row lifecycle controls.
 *
 * Delete uses a two-step inline confirmation rather than `window.confirm`,
 * which cannot be styled, is inconsistently implemented, and traps focus in a
 * way screen readers handle poorly. The confirmation is real buttons, so it is
 * fully keyboard-operable and the destructive choice is never the default.
 */
export function ScholarshipRowActions({
  id,
  status,
  featured,
  canDelete,
}: {
  id: string
  status: string
  featured: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function move(next: ScholarshipStatus) {
    setError(null)
    startTransition(async () => {
      const result = await setScholarshipStatusAction(id, next)
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  function toggleFeatured() {
    setError(null)
    startTransition(async () => {
      const result = await toggleFeaturedAction(id, !featured)
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteScholarshipAction(id)
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Link
          href={`/admin/scholarships/${id}`}
          className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          Edit
        </Link>

        {status !== 'published' ? (
          <RowButton
            onClick={() => move('published')}
            disabled={pending}
            label="Publish"
            tone="primary"
          />
        ) : (
          <RowButton
            onClick={() => move('draft')}
            disabled={pending}
            label="Unpublish"
          />
        )}

        {status !== 'archived' ? (
          <RowButton
            onClick={() => move('archived')}
            disabled={pending}
            label="Archive"
          />
        ) : (
          <RowButton
            onClick={() => move('draft')}
            disabled={pending}
            label="Restore"
          />
        )}

        <RowButton
          onClick={toggleFeatured}
          disabled={pending}
          label={featured ? 'Unfeature' : 'Feature'}
        />

        {canDelete ? (
          confirming ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-sm bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                Cancel
              </button>
            </span>
          ) : (
            <RowButton
              onClick={() => setConfirming(true)}
              disabled={pending}
              label="Delete"
              tone="danger"
            />
          )
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function RowButton({
  onClick,
  disabled,
  label,
  tone = 'default',
}: {
  onClick: () => void
  disabled: boolean
  label: string
  tone?: 'default' | 'primary' | 'danger'
}) {
  const tones = {
    default:
      'border border-ink-300 text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500',
    primary:
      'border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-500',
    danger:
      'border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  )
}