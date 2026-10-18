'use client'

import { useState, useTransition } from 'react'
import { setScholarshipVerificationAction } from '@/features/scholarships/admin/actions'

export function VerificationControl({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await setScholarshipVerificationAction(id, value as 'unverified' | 'pending' | 'verified' | 'disputed', '')
      setMessage(result.message ?? 'Verification saved.')
    })
  }
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
      <label className="sr-only" htmlFor={`verification-${id}`}>Verification status</label>
      <select id={`verification-${id}`} value={value} onChange={(event) => setValue(event.target.value)} className="rounded-sm border border-ink-300 px-2 py-1 text-xs">
        <option value="unverified">Unverified</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="disputed">Disputed</option>
      </select>
      <button type="button" onClick={save} disabled={pending} className="rounded-sm border border-ink-300 px-2 py-1 text-xs font-semibold">{pending ? 'Saving…' : 'Save verification'}</button>
      {message ? <span role="status" className="text-xs text-ink-600">{message}</span> : null}
    </div>
  )
}
