import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ArticleRowActions } from '@/features/articles/admin/components/article-row-actions'
import {
  articleStatusCounts,
  listAdminArticles,
} from '@/features/articles/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'
import {
  type ArticleStatus,
  ARTICLE_STATUSES,
} from '@/lib/validation/article'

export const metadata = { title: 'Articles' }

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

/**
 * Article list.
 *
 * Search, filtering, sorting and pagination all happen in PostgreSQL. RLS
 * decides what this page can see: an author with only `article.edit_own` sees
 * their own articles and nothing else, without any filter in this component.
 */
export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  // Any editorial role may list articles; RLS scopes the rows.
  const { permissions } = await requirePermission('article.create')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)

  const [result, counts] = await Promise.all([
    listAdminArticles({
      q: params.q,
      status: params.status,
      page: Number.isFinite(page) ? page : 1,
    }),
    articleStatusCounts(),
  ])

  const canDelete = permissions.includes('article.delete')
  const canReview = permissions.includes('article.review')

  const q = params.q?.trim() ?? ''
  const activeStatus = params.status ?? ''

  function pageHref(page: number): string {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (activeStatus) next.set('status', activeStatus)
    if (page > 1) next.set('page', String(page))
    const query = next.toString()
    return query ? `/admin/articles?${query}` : '/admin/articles'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Articles</h1>
          <p className="mt-1 text-sm text-ink-600">
            {result.ok
              ? `${result.data.total} record${result.data.total === 1 ? '' : 's'}`
              : 'Records could not be loaded'}
          </p>
        </div>

        <ButtonLink href="/admin/articles/new">
          <Plus className="size-4" aria-hidden="true" />
          New article
        </ButtonLink>
      </div>

      <form
        action="/admin/articles"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-sm border border-ink-200 bg-white p-4"
      >
        <div className="min-w-56 flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block text-sm font-medium text-ink-800"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Article title"
            className="block w-full rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-1.5 block text-sm font-medium text-ink-800"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={activeStatus}
            className="rounded-sm border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          >
            <option value="">All statuses</option>
            {ARTICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]} ({counts[status] ?? 0})
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-sm bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          Apply
        </button>

        {q || activeStatus ? (
          <Link
            href="/admin/articles"
            className="px-2 py-2 text-sm font-medium text-ink-600 hover:text-brand-700 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {!result.ok ? (
        <Alert tone="error">{result.error.userMessage}</Alert>
      ) : result.data.items.length === 0 ? (
        <EmptyState
          title={q || activeStatus ? 'No matching articles' : 'No articles yet'}
          description={
            q || activeStatus
              ? 'Try a different search term or clear the filters.'
              : 'Write the first article to start building the education section of the site.'
          }
          action={
            <ButtonLink href="/admin/articles/new">
              <Plus className="size-4" aria-hidden="true" />
              New article
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
            <table className="w-full min-w-3xl text-left text-sm">
              <caption className="sr-only">
                Articles matching the current filters
              </caption>
              <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Article
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Length
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {result.data.items.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/articles/${row.id}`}
                        className="font-medium text-brand-800 hover:underline"
                      >
                        {row.title}
                      </Link>
                      {row.status === 'scheduled' && row.scheduled_for ? (
                        <p className="text-xs text-ink-500">
                          Goes live {formatDate(row.scheduled_for)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-700">
                      {row.word_count.toLocaleString('en-GB')} words
                      <span className="block text-xs text-ink-500">
                        {row.reading_time_minutes} min
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                      {formatDate(row.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ArticleRowActions
                        id={row.id}
                        status={row.status}
                        scheduledFor={row.scheduled_for}
                        hasScheduledTime={Boolean(row.scheduled_for)}
                        canDelete={canDelete}
                        canReview={canReview}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.data.totalPages > 1 ? (
            <Pagination
              page={result.data.page}
              totalPages={result.data.totalPages}
              buildHref={pageHref}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    draft: 'bg-ink-100 text-ink-700',
    in_review: 'bg-amber-100 text-amber-900',
    scheduled: 'bg-sky-100 text-sky-900',
    published: 'bg-accent-100 text-accent-900',
    archived: 'bg-ink-200 text-ink-800',
  }

  const label = ARTICLE_STATUSES.includes(status as ArticleStatus)
    ? STATUS_LABELS[status as ArticleStatus]
    : status

  return (
    <span
      className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[status] ?? 'bg-ink-100 text-ink-700'}`}
    >
      {label}
    </span>
  )
}