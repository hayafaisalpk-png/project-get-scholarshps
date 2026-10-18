import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ContactStatusActions } from '@/features/contact/admin/components/contact-status-actions'
import {
  CONTACT_STATUSES,
  contactStatusCounts,
  listContactSubmissions,
} from '@/features/contact/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils/cn'
import { CONTACT_SUBJECT_LABELS, type ContactSubject } from '@/lib/validation/contact'

export const metadata = { title: 'Messages' }

/**
 * Contact message inbox.
 *
 * This route exists so the public contact form is not a black hole. Messages are
 * stored by the Server Action and read here; without this screen a visitor could
 * be told their message was received while nobody could read it.
 *
 * TRIAGE, NOT ARCHIVING. The table grants SELECT and UPDATE but never DELETE
 * (migration 022), and the UI follows the schema: an editor can mark a message
 * in progress, resolved or spam, and every one of those is reversible, but
 * nothing here can remove correspondence with a member of the public.
 *
 * `requirePermission('contact.manage')` runs before any query, the action
 * re-checks it before writing, and RLS enforces the same boundary
 * independently.
 */
export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requirePermission('contact.manage')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const status = CONTACT_STATUSES.find((s) => s === params.status)

  const [result, counts] = await Promise.all([
    listContactSubmissions({
      status,
      page: Number.isFinite(page) ? page : 1,
    }),
    contactStatusCounts(),
  ])

  const allHref = buildHref({})
  const statusHref = (value: string) => buildHref({ status: value })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-600">
          Submissions from the contact form. Messages can be marked as in
          progress, resolved or spam. Nothing is deleted from this screen.
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
          <ul className="space-y-4">
            {result.data.items.map((row) => (
              <li key={row.id}>
                <article className="rounded-sm border border-ink-200 bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-ink-900">
                      {CONTACT_SUBJECT_LABELS[row.subject as ContactSubject] ??
                        row.subject}
                    </h2>
                    <time dateTime={row.created_at} className="text-xs text-ink-500">
                      {formatTimestamp(row.created_at)}
                    </time>
                  </div>

                  <p className="mt-1 text-sm text-ink-600">
                    {row.name}{' '}
                    <span className="text-ink-500">
                      &lt;<a
                        href={`mailto:${row.email}`}
                        className="text-brand-700 hover:underline"
                      >
                        {row.email}
                      </a>&gt;
                    </span>
                  </p>

                  {/*
                    Rendered as text, never as markup. The message is
                    attacker-supplied free text stored in a private table, so
                    `whitespace-pre-wrap` is both the correct formatting and the
                    reason no sanitiser is needed here: React escapes the value.
                  */}
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-800">
                    {row.message}
                  </p>

                  <p className="mt-3 text-xs text-ink-500">
                    Status: {label(row.status)}
                    {row.handled_at ? (
                      <>
                        {' · handled '}
                        <time dateTime={row.handled_at}>
                          {formatTimestamp(row.handled_at)}
                        </time>
                      </>
                    ) : null}
                  </p>

                  <ContactStatusActions id={row.id} status={row.status} />
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
  return query ? `/admin/contact?${query}` : '/admin/contact'
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