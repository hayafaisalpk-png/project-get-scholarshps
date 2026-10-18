'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { createNavItemAction, deleteNavItemAction, updateNavItemAction } from '@/features/navigation/actions'
import type { NavItemRow } from '@/features/navigation/queries'

const LOCATIONS = [
  'header',
  'footer_column_1',
  'footer_column_2',
  'footer_column_3',
  'footer_column_4',
  'legal',
] as const

export function NavigationManager({ items }: { items: NavItemRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onCreate(formData: FormData) {
    startTransition(async () => {
      await createNavItemAction(formData)
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!window.confirm('Delete this navigation item?')) return
    startTransition(async () => {
      await deleteNavItemAction(id)
      router.refresh()
    })
  }

  function onUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      await updateNavItemAction(id, formData)
      router.refresh()
    })
  }

  const byLocation = new Map<string, NavItemRow[]>()
  for (const loc of LOCATIONS) byLocation.set(loc, [])
  for (const item of items) {
    const list = byLocation.get(item.location) ?? []
    list.push(item)
    byLocation.set(item.location, list)
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink-900">Add an item</h2>
        <form action={onCreate} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">Label</label>
            <input name="label" required className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">Href</label>
            <input name="href" required className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">Location</label>
            <select name="location" required className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">Sort order</label>
            <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
          </div>
          <button type="submit" disabled={pending} className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60">
            {pending ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      {LOCATIONS.map((loc) => {
        const list = byLocation.get(loc) ?? []
        return (
          <section key={loc} className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">{loc}</h2>
            {list.length === 0 ? (
              <p className="text-sm text-ink-600">No items.</p>
            ) : (
              <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Item (edit inline)</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {list.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <form action={(fd) => onUpdate(item.id, fd)} className="flex flex-wrap items-center gap-2">
                            <input name="label" defaultValue={item.label} className="w-32 rounded-sm border border-ink-300 bg-white px-2 py-1 text-xs text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
                            <input name="href" defaultValue={item.href} className="w-40 rounded-sm border border-ink-300 bg-white px-2 py-1 text-xs text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
                            <input name="sortOrder" type="number" defaultValue={item.sortOrder} className="w-16 rounded-sm border border-ink-300 bg-white px-2 py-1 text-xs text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" />
                            <label className="inline-flex items-center gap-1 text-xs text-ink-700">
                              <input type="checkbox" name="isVisible" defaultChecked={item.isVisible} className="h-3.5 w-3.5" />
                              Visible
                            </label>
                            <button type="submit" disabled={pending} className="rounded-sm bg-navy px-2 py-1 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60">
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            disabled={pending}
                            className="rounded-sm bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}