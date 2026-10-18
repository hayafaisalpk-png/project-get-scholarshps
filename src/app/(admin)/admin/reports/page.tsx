import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ReportStatusActions } from '@/features/contact/admin/components/report-status-actions'
import {
  REPORT_STATUSES,
  listContentReports,
  reportStatusCounts,
} from '@/features/contact/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils/cn'
import {
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/validation/contact'

export const metadata = { title: 'Reported issues' }

/**
 * Content-report inbox.
 *
 * Every scholarship and article page links to
 * `/contact?type=report&slug=…`, and those reports land in `content_reports`.
 * This screen is the other half of that loop: without it the public "report
 * incorrect information" affordance would collect corrections nobody reads.
 *
 * TRIAGE. `content_reports` has UPDATE available to `report.manage` (migration
 * 010), and that UPDATE is now reachable: the controls below move a report to
 * "being checked", "corrected" or "dismissed", and back to open.
 *
 * `content_reports_resolved_consistent` ties a closed `status` to a non-null
 * `resolved_at`, so the action writes both in one statement and requires a note
 * explaining what was done. A correction with no record of the correction is not
 * an auditable correction.
 *
 * There is still no DELETE: the report a visitor filed stays on the record.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requirePermission('report.manage')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const status = REPORT_STATUSES.find((s) => s === params.status)

  const [result, counts] = await Promise.all([
    listContentReports({
      status,
      page: Number.isFinite(page) ? page : 1,
    }),
    reportStatusCounts(),
  ])

  const allCount = (counts.open ?? 0) + (counts.reviewing ?? 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Reported issues</h1>
        <p className="mt-1 text-sm text-ink-600">
          Corrections sent from scholarship and article pages. Closing a report
          requires a note saying what was changed.
        </p>
      </header>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Tab href="/admin/reports" active={!status}>
              Needs attention ({allCount})
            </Tab>
          </li>
          {REPORT_STATUSES.map((value) => (
            <li key={value}>
              <Tab
                href={buildHref({ status: value })}
                active={status === value}
              >
                {label(value)} ({counts[value] ?? 0})
              </Tab>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <EmptyState
          title="Reports could not be loaded"
          description="Something went wrong while reading the inbox. Please try again."
        />
      ) : result.data.items.length === 0 ? (
        <EmptyState
          title="No reports"
          description="Nothing has been reported through the site yet."
        />
      ) : (
        <>
          <ul className="space-y-4">
            {result.data.items.map((row) => (
              <li key={row.id}>
                <article className="rounded-sm border border-ink-200 bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-ink-900">
                      {REPORT_REASON_LABELS[row.reason as ReportReason] ??
                        label(row.reason)}
                    </h2>
                    <time
                      dateTime={row.created_at}
                      className="text-xs text-ink-500"
                    >
                      {formatTimestamp(row.created_at)}
                    </time>
                  </div>

                  {row.targetHref ? (
                    <p className="mt-1 text-sm">
                      <span className="text-ink-600">Record: </span>
                      {/*
                        Rendered as a normal link to the public page, not an
                        admin edit link: the thing being reported is the PUBLIC
                        record, so that is what the reviewer must compare against
                        the awarding body's source.
                      */}
                      <Link
                        href={row.targetHref}
                        className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
                      >
                        {row.targetTitle ?? row.targetHref}
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-ink-600">
                      Record: no longer available
                    </p>
                  )}

                  {row.details ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-ink-800">
                      {row.details}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-ink-500">
                      No further detail was given.
                    </p>
                  )}

                  <p className="mt-3 text-xs text-ink-500">
                    {row.reporter_email ? (
                      <>
                        From{' '}
                        <a
                          href={`mailto:${row.reporter_email}`}
                          className="text-brand-700 hover:underline"
                        >
                          {row.reporter_email}
                        </a>
                        {' · '}
                      </>
                    ) : (
                      'No email given · '
                    )}
                    Status: {label(row.status)}
                    {row.resolved_at ? (
                      <>
                        {' · closed '}
                        <time dateTime={row.resolved_at}>
                          {formatTimestamp(row.resolved_at)}
                        </time>
                      </>
                    ) : null}
                  </p>

                  {/*
                    The resolution note is reviewer text, so it is rendered as a
                    plain string exactly like the report body above — React escapes
                    it and no sanitiser is involved.
                  */}
                  {row.resolution_note ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-sm bg-ink-50 p-3 text-sm text-ink-800">
                      <span className="font-semibold">What was done: </span>
                      {row.resolution_note}
                    </p>
                  ) : null}

                  <ReportStatusActions id={row.id} status={row.status} />
                </article>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.data.page}
            totalPages={result.data.totalPages}
            buildHref={(target) =>
              buildHref({ status: status as string | undefined, page: target })
            }
          />
        </>
      )}
    </div>
  )
}

function buildHref({
  status,
  page,
}: {
  status?: string | undefined
  page?: number | undefined
}): string {
  const search = new URLSearchParams()
  if (status) search.set('status', status)
  if (page && page > 1) search.set('page', String(page))
  const query = search.toString()
  return query ? `/admin/reports?${query}` : '/admin/reports'
}

function Tab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
      )}
    >
      {children}
    </Link>
  )
}

function label(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}