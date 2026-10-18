'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { createTaxonomyAction, deleteTaxonomyAction } from '@/features/taxonomy/actions'
import type { TaxonomyKind, TaxonomyRow } from '@/features/taxonomy/queries'
import { slugify } from '@/lib/slugify'

const LABELS: Record<TaxonomyKind, string> = {
  categories: 'Categories',
  tags: 'Tags',
  education_levels: 'Education levels',
  academic_fields: 'Academic fields',
  locations: 'Locations',
}

export function TaxonomyManager({
  kind,
  items,
}: {
  kind: TaxonomyKind
  items: TaxonomyRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function onCreate(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createTaxonomyAction(kind, formData)
      setMessage(result.message)
      if (result.ok) {
        setName('')
        setSlug('')
        setSlugTouched(false)
      }
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!window.confirm('Delete this record?')) return
    startTransition(async () => {
      await deleteTaxonomyAction(kind, id)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-ink-900">{LABELS[kind]}</h2>

      <form action={onCreate} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-700">Name</label>
          <input
            name="name"
            required
            value={name}
            onChange={(event) => {
              const nextName = event.target.value
              setName(nextName)
              if (!slugTouched) setSlug(slugify(nextName))
            }}
            className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>
        {kind === 'locations' ? (
          <div className="space-y-1">
            <label htmlFor={`location-type-${kind}`} className="block text-xs font-semibold text-ink-700">Type</label>
            <select id={`location-type-${kind}`} name="location_type" defaultValue="region" className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
              <option value="country">Country</option>
              <option value="state">State</option>
              <option value="region">Region</option>
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-700">Slug (auto-generated)</label>
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
              setSlugTouched(true)
            }}
            className="rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
      </form>
      {message ? <p role="status" className="text-sm text-ink-600">{message}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-ink-600">No records.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                <th scope="col" className="px-3 py-2 font-semibold">Slug</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium text-ink-900">{row.name}</td>
                  <td className="px-3 py-2 text-ink-700">{row.slug}</td>
                  <td className="px-3 py-2 text-ink-700">{row.status}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
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
}
