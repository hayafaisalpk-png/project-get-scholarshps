'use client'

import { useEffect, useState, useTransition } from 'react'
import { recordConsent } from './actions'

type Preferences = { analytics: boolean; ads: boolean; functionality: boolean }
const STORAGE_KEY = 'getscholarship-consent'
const VERSION = '1'

function visitorId(): string {
  const existing = window.localStorage.getItem('getscholarship-visitor-id')
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem('getscholarship-visitor-id', created)
  return created
}

export function ConsentManager({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Preferences>({ analytics: false, ads: false, functionality: true })
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Preferences
        // Browser storage is the external source of truth on hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreferences(parsed)
        setDraft(parsed)
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    const openSettings = () => setOpen(true)
    window.addEventListener('getscholarship:privacy-settings', openSettings)
    return () => window.removeEventListener('getscholarship:privacy-settings', openSettings)
  }, [])

  function save(next: Preferences, source: 'banner' | 'settings') {
    startTransition(async () => {
      const result = await recordConsent({ visitorId: visitorId(), ...next, version: VERSION, source })
      if (!result.ok) return
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setPreferences(next)
      setDraft(next)
      setOpen(false)
      window.dispatchEvent(new CustomEvent('getscholarship:consent-changed', { detail: next }))
    })
  }

  return <>
    {children}
    {preferences === null || open ? (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white p-4 shadow-lg" role="dialog" aria-label="Privacy preferences" aria-live="polite">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-base font-semibold text-ink-900">Privacy preferences</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-600">We use optional analytics and advertising only after you allow them. Essential functionality is always on. See our privacy policy for details.</p>
          {open ? <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-800">
            <label><input type="checkbox" checked={draft.functionality} disabled className="mr-2" />Essential functionality</label>
            <label><input type="checkbox" checked={draft.analytics} onChange={(event) => setDraft({ ...draft, analytics: event.target.checked })} className="mr-2" />Analytics</label>
            <label><input type="checkbox" checked={draft.ads} onChange={(event) => setDraft({ ...draft, ads: event.target.checked })} className="mr-2" />Advertising</label>
          </div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => save({ analytics: false, ads: false, functionality: true }, 'banner')} className="rounded-sm border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-800">Reject optional</button>
            <button type="button" disabled={pending} onClick={() => save({ analytics: true, ads: true, functionality: true }, 'banner')} className="rounded-sm bg-brand-700 px-3 py-2 text-sm font-semibold text-white">Accept all</button>
            {open ? <button type="button" disabled={pending} onClick={() => save(draft, 'settings')} className="rounded-sm border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-800">Save preferences</button> : <button type="button" onClick={() => setOpen(true)} className="rounded-sm border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-800">Manage preferences</button>}
          </div>
        </div>
      </div>
    ) : null}
  </>
}

export function PrivacySettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event('getscholarship:privacy-settings'))} className="text-sm text-ink-600 hover:text-brand-800 hover:underline underline-offset-4">Privacy settings</button>
}
