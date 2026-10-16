'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { setArticleStatusAction } from '@/features/articles/admin/actions'
import type { ArticleStatus } from '@/lib/validation/article'

/**
 * Per-article workflow controls.
 *
 * Destructive actions use a two-step inline confirmation rather than
 * `window.confirm`, which cannot be styled and handles focus poorly. The
 * confirm step is two real buttons, so the destructive choice is never the
 * default and the whole interaction is keyboard-operable.
 *
 * Every action re-checks permission on the server; hiding a button here is
 * presentation only.
 */
export function ArticleRowActions({
  id,
  status,
  scheduledFor,
  hasScheduledTime,
  canDelete,
  canReview,
}: {
  id: string
  status: string
  scheduledFor: string | null
  hasScheduledTime: boolean
  canDelete: boolean
  canReview: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function move(next: ArticleStatus) {
    setError(null)
    startTransition(async () => {
      const result = await setArticleStatusAction(id, next)
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  async function remove() {
    setError(null)
    const { deleteArticleAction } = await import(
      '@/features/articles/admin/actions'
    )
    startTransition(async () => {
      const result = await deleteArticleAction(id)
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {status !== 'published' ? (
          <RowButton
            label="Publish"
            onClick={() => move('published')}
            disabled={pending}
            tone="primary"
          />
        ) : (
          <RowButton
            label="Unpublish"
            onClick={() => move('draft')}
            disabled={pending}
          />
        )}

        {status !== 'scheduled' ? (
          <RowButton
            label="Schedule"
            onClick={() => move('scheduled')}
            disabled={pending}
            title={
              hasScheduledTime
                ? `Schedules for ${scheduledFor ?? 'the chosen time'}`
                : 'Set a publication date in the editor first'
            }
          />
        ) : (
          <RowButton
            label="Cancel schedule"
            onClick={() => move('draft')}
            disabled={pending}
          />
        )}

        {status !== 'in_review' ? (
          <RowButton
            label="Send for review"
            onClick={() => move('in_review')}
            disabled={pending}
          />
        ) : null}

        {status !== 'archived' ? (
          <RowButton
            label="Archive"
            onClick={() => move('archived')}
            disabled={pending}
          />
        ) : (
          <RowButton
            label="Restore"
            onClick={() => move('draft')}
            disabled={pending}
          />
        )}

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
              label="Delete"
              onClick={() => setConfirming(true)}
              disabled={pending}
              tone="danger"
            />
          )
        ) : null}
      </div>

      {canReview && status === 'in_review' ? (
        <p className="text-xs text-ink-500">Open the article to record a review.</p>
      ) : null}

      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function RowButton({
  label,
  onClick,
  disabled,
  tone = 'default',
  title,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  tone?: 'default' | 'primary' | 'danger'
  title?: string
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
      title={title}
      className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  )
}