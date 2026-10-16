import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Alert } from '@/components/ui/alert'
import { EditArticleForm } from '@/features/articles/admin/components/article-form'
import {
  getAdminArticle,
  getArticleFormOptions,
} from '@/features/articles/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'

export const metadata = { title: 'Edit article' }

/**
 * Edit an article.
 *
 * `params` is a Promise in Next.js 16 and must be awaited.
 */
export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('article.create')

  const { id } = await params

  const [detail, options] = await Promise.all([
    getAdminArticle(id),
    getArticleFormOptions(),
  ])

  if (!detail.ok) {
    throw new Error(detail.error.message)
  }

  // RLS already hides records this viewer may not read, so a miss means
  // "missing" or "not permitted" — both are a 404 rather than a 403 that would
  // confirm the record exists.
  if (!detail.data) {
    notFound()
  }

  const { record, relations } = detail.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{record.title}</h1>
          <p className="mt-1 text-sm text-ink-600">
            <span className="capitalize">{record.status.replace('_', ' ')}</span>
            {' · '}
            {record.word_count.toLocaleString('en-GB')} words ·{' '}
            {record.reading_time_minutes} min read
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Last updated {formatDate(record.updated_at)}
            {record.published_at
              ? ` · published ${formatDate(record.published_at)}`
              : ''}
          </p>
        </div>

        <Link
          href="/admin/articles"
          className="text-sm font-medium text-ink-600 hover:text-brand-700 hover:underline"
        >
          All articles
        </Link>
      </div>

      {record.published_at ? (
        <Alert tone="warning" title="This article is live">
          Changing the slug changes its public address. A redirect must be
          created separately so existing links keep working.
        </Alert>
      ) : null}

      {!options.ok ? (
        <Alert tone="error">
          Authors, categories and tags could not be loaded, so they cannot be
          changed on this save. ({options.error.userMessage})
        </Alert>
      ) : null}

      <EditArticleForm
        record={record}
        relations={relations}
        options={
          options.ok
            ? options.data
            : { authors: [], categories: [], tags: [], scholarships: [] }
        }
      />
    </div>
  )
}