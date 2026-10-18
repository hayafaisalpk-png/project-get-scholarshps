import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePermission } from '@/lib/auth/guards'
import { getContentPage } from '@/features/content-pages/queries'
import { updateContentPageAction } from '@/features/content-pages/actions'

export const metadata = { title: 'Edit content page' }

export default async function AdminContentPageEditPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requirePermission('settings.manage')

  const { slug } = await params
  const page = await getContentPage(slug)
  if (!page) notFound()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Edit: {page.title}</h1>
        <p className="mt-1 text-sm text-ink-600">
          Slug: <code className="text-xs">{page.slug}</code> (fixed). Changes go
          live immediately.
        </p>
      </header>

      <form action={updateContentPageAction.bind(null, page.slug)} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-semibold text-ink-800">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={page.title}
            required
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="excerpt" className="block text-sm font-semibold text-ink-800">
            Excerpt
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={3}
            defaultValue={page.excerpt ?? ''}
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="body" className="block text-sm font-semibold text-ink-800">
            Body
          </label>
          <textarea
            id="body"
            name="body"
            rows={16}
            defaultValue={page.body ?? ''}
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="block text-sm font-semibold text-ink-800">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={page.status}
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="seoTitle" className="block text-sm font-semibold text-ink-800">
            SEO title
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            defaultValue={page.seoTitle ?? ''}
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="seoDescription" className="block text-sm font-semibold text-ink-800">
            SEO description
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={3}
            defaultValue={page.seoDescription ?? ''}
            className="w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          >
            Save
          </button>
          <Link
            href="/admin/content-pages"
            className="text-sm font-medium text-ink-600 hover:text-brand-700 hover:underline"
          >
            Back
          </Link>
        </div>
      </form>
    </div>
  )
}