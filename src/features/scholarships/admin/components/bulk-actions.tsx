'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { bulkSetScholarshipStatusAction, type ScholarshipActionResult } from '@/features/scholarships/admin/actions'

export function ScholarshipBulkForm({ children }: { children: ReactNode }) {
  const [state, action] = useActionState<ScholarshipActionResult | null, FormData>(bulkSetScholarshipStatusAction, null)
  return (
    <form action={action}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-ink-200 bg-white p-3">
        <label htmlFor="bulk-next" className="text-sm font-medium text-ink-800">Selected records</label>
        <select id="bulk-next" name="next" defaultValue="" className="rounded-sm border border-ink-300 px-2 py-1.5 text-sm">
          <option value="" disabled>Choose action</option>
          <option value="published">Publish</option>
          <option value="pending_review">Send for review</option>
          <option value="draft">Restore to draft</option>
          <option value="archived">Archive</option>
        </select>
        <button type="submit" className="rounded-sm bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white">Apply</button>
        {state ? <p role={state.ok ? 'status' : 'alert'} className="text-sm text-ink-700">{state.message}</p> : null}
      </div>
      {children}
    </form>
  )
}
