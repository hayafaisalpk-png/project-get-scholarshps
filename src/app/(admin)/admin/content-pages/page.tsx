import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { requirePermission } from '@/lib/auth/guards'
import { listContentPages } from '@/features/content-pages/queries'

export const metadata = { title: 'Content pages' }

export default async function AdminContentPagesPage() {
  await requirePermission('settings.manage')

  const pages = await listContentPages()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Content pages</h1>
        <p className="mt-1 text-sm text-ink-600">
          Edit the copy of the static pages (About, Privacy, Terms, Help,
          Editorial Standards). Changes go live immediately.
        </p>
      </header>

      {pages.length === 0 ? (
        <EmptyState
          title="No content pages"
          description="No content pages are present in the database."
        />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Content pages</caption>
            <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Title</th>
                <th scope="col" className="px-4 py-3 font-semibold">Slug</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Updated</th>
                <th scope="col" className="px-4 py-3 font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {pages.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{p.title}</td>
                  <td className="px-4 py-3 text-ink-700">/{p.slug}</td>
                  <td className="px-4 py-3 text-ink-700">{p.status}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/content-pages/${p.slug}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}