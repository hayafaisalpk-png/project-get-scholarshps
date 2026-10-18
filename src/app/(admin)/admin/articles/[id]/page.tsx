import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Alert } from '@/components/ui/alert'
import { EditArticleForm } from '@/features/articles/admin/components/article-form'
import { ReviewPanel } from '@/features/articles/admin/components/review-panel'
import {
  getAdminArticle,
  getArticleFormOptions,
  listArticleReviews,
} from '@/features/articles/admin/queries'
import { getSelectableAsset, listSelectableAssets } from '@/features/media/queries'
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

  const [detail, options, reviews] = await Promise.all([
    getAdminArticle(id),
    getArticleFormOptions(),
    listArticleReviews(id),
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

  /*
   * The picker needs two things: a page of the library, and the image this record
   * already points at. The chosen asset is resolved separately because the
   * library page is only the FIRST page — an article whose image was chosen from
   * page three would otherwise render with nothing selected while its id was
   * still stored, and the next save would clear it.
   */
  const [images, selectedImage] = await Promise.all([
    listSelectableAssets({ page: 1 }),
    record.featured_image_id
      ? getSelectableAsset(record.featured_image_id)
      : Promise.resolve(null),
  ])

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
        <Link
          href={`/admin/articles/${record.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Preview
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
        images={images.ok ? { items: images.data.items, total: images.data.total } : { items: [], total: 0 }}
        selectedImage={selectedImage}
      />
      {record.status === 'in_review' ? <ReviewPanel id={record.id} /> : null}
      {reviews.length > 0 ? (
        <section className="rounded-sm border border-ink-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-ink-900">Review history</h2>
          <ul className="mt-4 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="border-l-2 border-brand-300 pl-3 text-sm">
                <p className="font-semibold capitalize text-ink-900">{review.decision.replace('_', ' ')}</p>
                <p className="text-xs text-ink-500">{formatDate(review.created_at)}</p>
                {review.notes ? <p className="mt-1 whitespace-pre-wrap text-ink-700">{review.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
