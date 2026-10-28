'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

import { absoluteUrl } from '@/lib/env'

/**
 * Compact "Copy URL" button for a media asset.
 *
 * The URL is the opaque /media/<token> route, which resolves to the asset's
 * storage object. Nothing about the bucket, folder or filename is exposed.
 */
export function CopyUrlButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  async function copy() {
    const url = absoluteUrl(`/media/${token}`)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setError(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(true)
      window.setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void copy()
      }}
      title="Copy URL"
      aria-label="Copy asset URL"
      className="inline-flex items-center gap-1 rounded-sm border border-ink-300 bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? 'Copied' : error ? 'Failed' : 'Copy URL'}
    </button>
  )
}