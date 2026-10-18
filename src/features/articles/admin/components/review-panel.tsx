'use client'

import { useState, useTransition } from 'react'
import { submitReviewAction } from '@/features/articles/admin/actions'

export function ReviewPanel({ id }: { id: string }) {
  const [decision, setDecision] = useState<'approved' | 'changes_requested' | 'rejected'>('approved')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setMessage(null)
    startTransition(async () => {
      const result = await submitReviewAction(id, decision, notes)
      setMessage(result.message ?? 'Review saved.')
      if (result.ok) setNotes('')
    })
  }

  return (
    <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-ink-900">Editorial review</h2>
      <p className="mt-1 text-sm text-ink-600">Record the decision and keep the article&apos;s review history auditable.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink-800">
          Decision
          <select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="mt-1 block w-full rounded-sm border border-ink-300 px-3 py-2">
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes requested</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="text-sm font-medium text-ink-800 sm:col-span-2">
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} rows={4} className="mt-1 block w-full rounded-sm border border-ink-300 px-3 py-2" />
        </label>
      </div>
      <button type="button" onClick={submit} disabled={pending} className="mt-4 rounded-sm bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Saving…' : 'Record decision'}
      </button>
      {message ? <p role="status" className="mt-3 text-sm text-ink-700">{message}</p> : null}
    </section>
  )
}
