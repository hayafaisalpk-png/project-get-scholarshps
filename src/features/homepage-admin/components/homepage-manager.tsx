'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { updateHomepageSectionAction } from '@/features/homepage-admin/actions'
import type { HomepageSectionRow } from '@/features/homepage-admin/queries'

export function HomepageManager({ sections }: { sections: HomepageSectionRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onUpdate(key: string, formData: FormData) {
    startTransition(async () => {
      await updateHomepageSectionAction(key, formData)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <form
          key={s.key}
          action={(fd) => onUpdate(s.key, fd)}
          className="rounded-sm border border-ink-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink-900">{s.key}</h2>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-700">
              <input type="checkbox" name="isVisible" defaultChecked={s.isVisible} className="h-4 w-4" />
              Visible
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-ink-700">Heading</label>
              <input name="heading" defaultValue={s.heading ?? ''} className="w-full rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-ink-700">Sort order</label>
              <input name="sortOrder" type="number" defaultValue={s.sortOrder} className="w-24 rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">Subheading</label>
            <textarea name="subheading" rows={2} defaultValue={s.subheading ?? ''} className="w-full rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
          </div>
          <button type="submit" disabled={pending} className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      ))}
    </div>
  )
}