import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ScholarshipRowActions } from '@/features/scholarships/admin/components/scholarship-row-actions'
import { ScholarshipBulkForm } from '@/features/scholarships/admin/components/bulk-actions'
import { VerificationControl } from '@/features/scholarships/admin/components/verification-control'
import {
  SCHOLARSHIP_SORT_KEYS,
  type ScholarshipSortDirection,
  type ScholarshipSortKey,
  listAdminScholarships,
  scholarshipStatusCounts,
} from '@/features/scholarships/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'
import {
  type ScholarshipStatus,
  SCHOLARSHIP_STATUSES,
} from '@/lib/validation/scholarship'

export const metadata = { title: 'Scholarships' }

const STATUS_LABELS: Record<ScholarshipStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  published: 'Published',
  expired: 'Expired',
  archived: 'Archived',
}

/**
 * Scholarship list.
 *
 * Filtering, search, sorting and pagination all happen in PostgreSQL via
 * `listAdminScholarships`; the full result set is never fetched to be filtered
 * in the browser.
 *
 * RLS decides what this page can see. An author without `scholarship.manage`
 * never reaches it, and even then the session policy — not this component —
 * is what actually filters rows.
 */
export default async function AdminScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    page?: string
    sort?: string
    direction?: string
  }>
}) {
  const { permissions } = await requirePermission('scholarship.manage')

  const params = await searchParams

  const page = Number.parseInt(params.page ?? '1', 10)
  const sort =
    SCHOLARSHIP_SORT_KEYS.find((s) => s === params.sort) ?? 'updated'
  const direction: ScholarshipSortDirection =
    params.direction === 'asc' ? 'asc' : 'desc'

  const result = await listAdminScholarships({
    q: params.q,
    status: params.status,
    page: Number.isFinite(page) ? page : 1,
    sort,
    direction,
  })

  const counts = await scholarshipStatusCounts()
  const canDelete = permissions.includes('scholarship.delete')
  const canVerify = permissions.includes('scholarship.verify')

  const q = params.q?.trim() ?? ''
  const activeStatus = params.status ?? ''


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Scholarships</h1>
          <p className="mt-1 text-sm text-ink-600">
            {result.ok
              ? `${result.data.total} record${result.data.total === 1 ? '' : 's'}`
              : 'Records could not be loaded'}
          </p>
        </div>

        <ButtonLink href="/admin/scholarships/new">
          <Plus className="size-4" aria-hidden="true" />
          New scholarship
        </ButtonLink>
      </div>

      {/* Filters */}
      <form
        action="/admin/scholarships"
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
            placeholder="Title or sponsor"
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
            {SCHOLARSHIP_STATUSES.map((status) => (
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
            href="/admin/scholarships"
            className="px-2 py-2 text-sm font-medium text-ink-600 hover:text-brand-700 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {/* Results */}
      {!result.ok ? (
        <Alert tone="error">{result.error.userMessage}</Alert>
      ) : result.data.items.length === 0 ? (
        <EmptyState
          title={q || activeStatus ? 'No matching records' : 'No scholarships yet'}
          description={
            q || activeStatus
              ? 'Try a different search term or clear the filters.'
              : 'Create the first scholarship to populate the public site.'
          }
          action={
            <ButtonLink href="/admin/scholarships/new">
              <Plus className="size-4" aria-hidden="true" />
              New scholarship
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/*
            Horizontally scrollable rather than column-stacked: an editorial
            table has too many columns to read on a phone, and truncating the
            title would be worse than scrolling.
          */}
          <ScholarshipBulkForm>
          <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
            <table className="w-full min-w-3xl text-left text-sm">
              <caption className="sr-only">
                Scholarships matching the current filters
              </caption>
              <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Select</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <SortLink
                      label="Scholarship"
                      sort="title"
                      activeSort={sort}
                      direction={direction}
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <SortLink
                      label="Status"
                      sort="status"
                      activeSort={sort}
                      direction={direction}
                    />
                  </th>

                  <th scope="col" className="px-4 py-3 font-semibold">
                    <SortLink
                      label="Updated"
                      sort="updated"
                      activeSort={sort}
                      direction={direction}
                    />
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
                      <input type="checkbox" name="ids" value={row.id} aria-label={`Select ${row.title}`} className="size-4 rounded border-ink-300 text-brand-700" />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/scholarships/${row.id}`}
                        className="font-medium text-brand-800 hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="text-xs text-ink-500">{row.sponsor_name}</p>
                      {row.featured ? (
                        <span className="mt-1 inline-block rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-800">
                          Featured
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        status={row.status}
                        verification={row.verification_status}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                      {formatDate(row.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ScholarshipRowActions
                        id={row.id}
                        status={row.status}
                        featured={row.featured}
                        canDelete={canDelete}
                      />
                      {canVerify ? <VerificationControl id={row.id} status={row.verification_status} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </ScholarshipBulkForm>

          {result.data.totalPages > 1 ? (
            <Pagination
              page={result.data.page}
              totalPages={result.data.totalPages}
              buildHref={(target) =>
                buildHref({
                  q,
                  status: activeStatus || undefined,
                  page: target,
                  sort,
                  direction,
                })
              }
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function StatusPill({
  status,
  verification,
}: {
  status: string
  verification: string
}) {
  const tones: Record<string, string> = {
    draft: 'bg-ink-100 text-ink-700',
    pending_review: 'bg-amber-100 text-amber-900',
    published: 'bg-accent-100 text-accent-900',
    expired: 'bg-sky-100 text-sky-900',
    archived: 'bg-ink-200 text-ink-800',
  }

  const label = SCHOLARSHIP_STATUSES.includes(status as ScholarshipStatus)
    ? STATUS_LABELS[status as ScholarshipStatus]
    : status

  return (
    <span className="inline-flex flex-col gap-1">
      <span
        className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[status] ?? 'bg-ink-100 text-ink-700'}`}
      >
        {label}
      </span>
      {verification === 'pending' || verification === 'disputed' ? (
        <span className="text-xs text-ink-500">{verification}</span>
      ) : null}
    </span>
  )
}

function buildHref({
  q,
  status,
  page,
  sort,
  direction,
}: {
  q?: string
  status?: string
  page?: number
  sort?: ScholarshipSortKey
  direction?: ScholarshipSortDirection
}): string {
  const search = new URLSearchParams()
  if (q) search.set('q', q)
  if (status) search.set('status', status)
  if (page && page > 1) search.set('page', String(page))
  const activeSort = sort ?? 'updated'
  const activeDirection = direction ?? 'desc'
  if (activeSort !== 'updated') search.set('sort', activeSort)
  if (activeSort === 'updated' && activeDirection !== 'desc') {
    search.set('direction', activeDirection)
  } else if (activeSort !== 'updated' && activeDirection !== 'asc') {
    search.set('direction', activeDirection)
  }
  const query = search.toString()
  return query ? `/admin/scholarships?${query}` : '/admin/scholarships'
}

function SortLink({
  label: text,
  sort,
  activeSort,
  direction,
}: {
  label: string
  sort: ScholarshipSortKey
  activeSort: ScholarshipSortKey
  direction: ScholarshipSortDirection
}) {
  const active = sort === activeSort
  const nextDirection = active && direction === 'asc' ? 'desc' : 'asc'
  const href = buildHref({ sort, direction: nextDirection })

  return (
    <Link
      href={href}
      aria-label={`Sort by ${text}${active ? `, currently ${direction}ending` : ''}`}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className="inline-flex items-center gap-1 hover:text-ink-900"
    >
      {text}
      <span aria-hidden="true" className="text-ink-400">
        {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </Link>
  )
}