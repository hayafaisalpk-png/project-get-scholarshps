import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import {
  listSubscribers,
  subscriberStatusCounts,
} from '@/features/newsletter/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils/cn'
import { NEWSLETTER_STATUSES } from '@/lib/validation/newsletter'

export const metadata = { title: 'Newsletter subscribers' }

/**
 * Newsletter subscriber list.
 *
 * READ-ONLY. `newsletter_subscribers` grants no DELETE to any application role,
 * and this screen exposes no export — a list of subscribers with consent
 * timestamps is exportable personal data, and an accidental bulk export is not a
 * mistake worth being able to make in one click.
 *
 * `requirePermission('newsletter.manage')` is the ONLY gate. The table is read
 * through the service-role client because it is revoked from every client role,
 * which means RLS offers no second layer here. That makes this guard the actual
 * boundary, not a usability nicety.
 */
export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requirePermission('newsletter.manage')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const status = NEWSLETTER_STATUSES.find((s) => s === params.status)

  const [result, counts] = await Promise.all([
    listSubscribers({ status, page: Number.isFinite(page) ? page : 1 }),
    subscriberStatusCounts(),
  ])

  const allCount = NEWSLETTER_STATUSES.reduce(
    (sum, key) => sum + (counts[key] ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">
          Newsletter subscribers
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Read-only. Signups are recorded with a consent timestamp; no email is
          sent while no mail provider is configured.
        </p>
      </header>

      {/*
        A visible warning about the send state, because the obvious next action
        for whoever reads this list is "email these people", and doing so right
        now would silently fail with no provider configured.
      */}
      <p className="rounded-sm bg-highlight-50 px-4 py-3 text-sm text-highlight-900 ring-1 ring-inset ring-highlight-200">
        No mail provider is configured, so nothing on this list has received
        anything. Every row stays in <strong>pending</strong> until a provider
        exists and the address is confirmed.
      </p>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Tab href="/admin/newsletter" active={!status}>
              All ({allCount})
            </Tab>
          </li>
          {NEWSLETTER_STATUSES.map((value) => (
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
          title="Subscribers could not be loaded"
          description={`${result.error.userMessage} The service-role key may be missing from the environment.`}
        />
      ) : result.data.items.length === 0 ? (
        <EmptyState
          title="No subscribers"
          description={
            'The public signup form is disabled, so nothing has been collected yet.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only-focusable">
                Newsletter subscribers, newest first
              </caption>
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink-800">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink-800">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink-800">
                    Consented
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink-800">
                    Signed up
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((row) => (
                  <tr key={row.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${row.email}`}
                        className="text-brand-700 hover:underline"
                      >
                        {row.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{label(row.status)}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {row.consentGivenAt ? (
                        <time dateTime={row.consentGivenAt}>
                          {formatTimestamp(row.consentGivenAt)}
                        </time>
                      ) : (
                        <span className="text-ink-400">Not recorded</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <time dateTime={row.createdAt}>
                        {formatTimestamp(row.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
  return query ? `/admin/newsletter?${query}` : '/admin/newsletter'
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