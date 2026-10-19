import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ContactMessageRow } from '@/features/contact/admin/components/contact-message-row'
import {
  CONTACT_STATUSES,
  CONTACT_SORT_KEYS,
  contactStatusCounts,
  listContactSubmissions,
  type ContactSortDirection,
  type ContactSortKey,
} from '@/features/contact/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { cn } from '@/lib/utils/cn'

export const metadata = { title: 'Messages' }

/**
 * Contact message inbox.
 *
 * This route exists so the public contact form is not a black hole. Messages are
 * stored by the Server Action and read here; without this screen a visitor could
 * be told their message was received while nobody could read it.
 *
 * TRIAGE WITH CONTROLLED DELETION. The table grants SELECT, UPDATE and DELETE
 * to `contact.manage` (migrations 022 and 036). Status changes are reversible;
 * deletion is permanent, requires confirmation and writes an audit entry.
 *
 * `requirePermission('contact.manage')` runs before any query, the action
 * re-checks it before writing, and RLS enforces the same boundary
 * independently.
 */
export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    page?: string
    sort?: string
    direction?: string
  }>
}) {
  await requirePermission('contact.manage')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const status = CONTACT_STATUSES.find((s) => s === params.status)
  const sort = CONTACT_SORT_KEYS.find((s) => s === params.sort) ?? 'date'
  const direction: ContactSortDirection = params.direction === 'asc' ? 'asc' : 'desc'

  const [result, counts] = await Promise.all([
    listContactSubmissions({
      status,
      page: Number.isFinite(page) ? page : 1,
      sort,
      direction,
    }),
    contactStatusCounts(),
  ])

  const allHref = buildHref({ sort, direction })
  const statusHref = (value: string) => buildHref({ status: value, sort, direction })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-600">
          Submissions from the contact form. Messages can be marked as in
          process, resolved or permanently delete a message.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Tab href={allHref} active={!status}>
              All ({(counts.new ?? 0) + (counts.in_progress ?? 0) + (counts.resolved ?? 0)})
            </Tab>
          </li>
          {CONTACT_STATUSES.map((value) => (
            <li key={value}>
              <Tab href={statusHref(value)} active={status === value}>
                {label(value)} ({counts[value] ?? 0})
              </Tab>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <EmptyState
          title="Messages could not be loaded"
          description="Something went wrong while reading the inbox. Please try again."
        />
      ) : result.data.items.length === 0 ? (
        <EmptyState
          title="No messages"
          description="Nothing has been submitted through the contact form yet."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Contact messages</caption>
              <thead className="border-b border-ink-200 bg-ink-50 text-xs font-semibold tracking-wide text-ink-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    <SortLink label="From" sort="from" activeSort={sort} direction={direction} />
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <SortLink label="Subject" sort="subject" activeSort={sort} direction={direction} />
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <SortLink label="Email" sort="email" activeSort={sort} direction={direction} />
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <SortLink label="Date" sort="date" activeSort={sort} direction={direction} />
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {result.data.items.map((row) => (
                  <ContactMessageRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={result.data.page}
            totalPages={result.data.totalPages}
            buildHref={(target) =>
              buildHref({
                status: status as string | undefined,
                page: target,
                sort,
                direction,
              })
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
  sort,
  direction,
}: {
  status?: string | undefined
  page?: number | undefined
  sort?: ContactSortKey | undefined
  direction?: ContactSortDirection | undefined
}): string {
  const search = new URLSearchParams()
  if (status) search.set('status', status)
  if (page && page > 1) search.set('page', String(page))
  if (sort && sort !== 'date') search.set('sort', sort)
  if (direction && (sort ?? 'date') === 'date' && direction !== 'desc') {
    search.set('direction', direction)
  } else if (direction && sort && sort !== 'date') {
    search.set('direction', direction)
  }
  const query = search.toString()
  return query ? `/admin/contact?${query}` : '/admin/contact'
}

function SortLink({
  label: text,
  sort,
  activeSort,
  direction,
}: {
  label: string
  sort: ContactSortKey
  activeSort: ContactSortKey
  direction: ContactSortDirection
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
