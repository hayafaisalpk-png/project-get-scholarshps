'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copyEmail}
      aria-label={copied ? `Copied ${email}` : `Copy ${email}`}
      title={copied ? 'Copied' : 'Copy email'}
      className="inline-flex size-7 items-center justify-center rounded-sm text-ink-500 hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}
