'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { setIndexAction, type SeoActionResult } from '@/features/seo/actions'
import type { SeoIssue } from '@/features/seo/guardrails'
import type { SeoRecordRow } from '@/features/seo/queries'

/**
 * The indexable-record list, with a per-record index control.
 *
 * The toggle is the guardrail's user interface. A record that is not published
 * cannot be switched to indexable, and the refusal comes back as a sentence from
 * the server explaining why — "this record is still a draft, so it is not on the
 * site yet. Publish it first" — rather than a disabled control with a tooltip
 * nobody can read on a phone.
 *
 * That means the control is rendered for every record. Hiding it for a draft
 * would hide the reason the draft cannot rank, which is the more useful fact.
 */
export function SeoRecordList({
  records,
  issues,
}: {
  records: SeoRecordRow[]
  issues: SeoIssue[]
}) {
  const [filter, setFilter] = useState<'all' | 'indexable' | 'noindex' | 'issues'>('all')

  const issuesByRecord = useMemo(() => {
    const map = new Map<string, SeoIssue[]>()
    for (const issue of issues) {
      const id = issue.key.split(':')[1]
      if (!id) continue
      map.set(id, [...(map.get(id) ?? []), issue])
    }
    return map
  }, [issues])

  const visible = records.filter((record) => {
    if (filter === 'indexable') return !record.noindex
    if (filter === 'noindex') return record.noindex
    if (filter === 'issues') return (issuesByRecord.get(record.id)?.length ?? 0) > 0
    return true
  })

  return (
    <section aria-labelledby="seo-records-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="seo-records-heading" className="text-base font-semibold text-ink-900">
          Records ({visible.length.toLocaleString('en-US')})
        </h2>

        <div role="group" aria-label="Filter records" className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All'],
              ['indexable', 'Indexable'],
              ['noindex', 'Excluded'],
              ['issues', 'Needs attention'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
                filter === value
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-600">No records match this filter.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((record) => (
            <li key={`${record.kind}:${record.id}`}>
              <SeoRecordCard
                record={record}
                issues={issuesByRecord.get(record.id) ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SeoRecordCard({
  record,
  issues,
}: {
  record: SeoRecordRow
  issues: SeoIssue[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setMessage(null)
    setError(null)

    /*
     * `indexable` is the state being ASKED FOR, and the button offers the
     * opposite of the current one. So when the record is currently excluded
     * (`noindex` true) the button is "Allow indexing" and asks for `true` —
     * which is `record.noindex`, NOT its negation.
     *
     * Writing `!record.noindex` here inverts the control against its own label:
     * a record that is already indexable shows "Exclude from search" and, when
     * clicked, asks to make it indexable. That is what this comment exists to
     * prevent, and it was exactly the bug the end-to-end run caught.
     */
    const next = record.noindex

    startTransition(async () => {
      const result: SeoActionResult = await setIndexAction(
        record.kind,
        record.id,
        next,
        record.status,
      )
      if (result.ok) {
        setMessage(result.message)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <article className="rounded-sm border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">{record.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {label(record.kind)} · {record.status} · {indexLabel(record)}
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={!record.noindex}
          className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${
            record.noindex
              ? 'border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-500'
              : 'border border-ink-300 text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500'
          }`}
        >
          {pending ? 'Saving…' : record.noindex ? 'Allow indexing' : 'Exclude from search'}
        </button>
      </div>

      {issues.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className={`text-xs ${
                issue.severity === 'warning' ? 'text-red-700' : 'text-ink-500'
              }`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {message ?? ''}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {message && !error ? <p className="mt-2 text-xs text-ink-500">{message}</p> : null}
    </article>
  )
}

/**
 * Describe the record's index state honestly.
 *
 * The obvious implementation — `noindex ? 'excluded' : 'indexable'` — is wrong
 * for a draft. A draft with `noindex = false` is NOT indexable; it does not
 * exist for a crawler at all, and labelling it "indexable" tells an editor the
 * opposite of the truth about a record they are about to publish.
 */
function indexLabel(record: SeoRecordRow): string {
  if (!REACHABLE_STATUSES.has(record.status)) return 'not on the site yet'
  return record.noindex ? 'excluded from search engines' : 'indexable'
}

/** Statuses whose pages actually exist for a visitor. Mirrors the guardrail. */
const REACHABLE_STATUSES = new Set(['published', 'active'])

function label(kind: SeoRecordRow['kind']): string {
  switch (kind) {
    case 'scholarship':
      return 'Scholarship'
    case 'article':
      return 'Article'
    case 'content_page':
      return 'Page'
  }
}