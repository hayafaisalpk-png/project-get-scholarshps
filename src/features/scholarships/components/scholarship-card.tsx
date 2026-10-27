import Image from 'next/image'
import Link from 'next/link'

import { DeadlineBadge } from '@/components/ui/badge'
import type { ScholarshipCard as ScholarshipCardData } from '@/features/scholarships/queries'
import {
  formatAwardAmount,
  formatDate,
  formatDeadlineNote,
  getDeadlineState,
} from '@/lib/format'

/**
 * Scholarship card.
 *
 * Shows only verified fields. When a field is unknown the card says nothing
 * rather than guessing, because a wrong award amount or deadline is worse than
 * an absent one.
 *
 * The whole card is not a link: the heading holds the link, which keeps a single
 * tab stop and lets the taxonomy links below be independently focusable.
 */
export function ScholarshipCard({
  scholarship,
}: {
  scholarship: ScholarshipCardData
}) {
  const deadlineState = getDeadlineState(
    scholarship.deadline,
    scholarship.is_rolling,
  )
  const deadlineNote = formatDeadlineNote(
    scholarship.deadline,
    scholarship.is_rolling,
  )

  return (
    <article className="group relative flex h-full flex-col rounded-sm border border-ink-200 bg-white p-5 transition-shadow hover:shadow-md focus-within:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <DeadlineBadge state={deadlineState} note={deadlineNote} />
        {scholarship.is_renewable ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-800 ring-1 ring-inset ring-accent-200">
            Renewable
          </span>
        ) : null}
        {scholarship.application_fee_cents === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200">
            No application fee
          </span>
        ) : null}
      </div>

      <h3 className="text-base font-semibold leading-snug text-ink-900">
        <Link
          href={`/scholarships/${scholarship.slug}`}
          className="after:absolute after:inset-0 hover:text-brand-800"
        >
          {scholarship.title}
        </Link>
      </h3>

      <p className="mt-1 text-sm text-ink-600">
        {scholarship.institution?.name ?? scholarship.sponsor_name}
        {scholarship.institution?.country
          ? ` · ${scholarship.institution.country}`
          : null}
      </p>

      <p className="mt-3 text-lg font-bold text-brand-800">
        {formatAwardAmount(
          scholarship.award_amount_min_cents,
          scholarship.award_amount_max_cents,
          scholarship.award_amount_text,
          scholarship.award_currency,
        )}
      </p>

      {scholarship.summary ? (
        <p className="mt-3 line-clamp-3 text-sm text-ink-600">
          {scholarship.summary}
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        <div className="mb-3 flex justify-center">
          {scholarship.institution?.logo_url ? (
            <Image
              src={scholarship.institution.logo_url}
              alt={`${scholarship.institution.name} logo`}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-sm bg-ink-100 text-lg font-semibold text-ink-600"
            >
              {(scholarship.institution?.name ?? scholarship.sponsor_name)
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
        </div>
        {scholarship.last_reviewed_at ? (
          <p className="text-xs text-ink-500">
            Information last reviewed{' '}
            {formatDate(scholarship.last_reviewed_at.slice(0, 10))}
          </p>
        ) : null}

        <span className="mt-3 inline-block text-sm font-semibold text-brand-700 group-hover:text-brand-900">
          View details
          <span aria-hidden="true"> &rarr;</span>
          <span className="sr-only-focusable"> for {scholarship.title}</span>
        </span>
      </div>

      {/* The stretched link above makes the card clickable without nesting
          interactive elements, so these remain separately focusable. */}
    </article>
  )
}

/**
 * Compact variant used in sidebars and related lists.
 */
export function ScholarshipCardCompact({
  scholarship,
}: {
  scholarship: ScholarshipCardData
}) {
  return (
    <article className="relative rounded-sm border border-ink-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <h3 className="text-sm font-semibold leading-snug text-ink-900">
        <Link
          href={`/scholarships/${scholarship.slug}`}
          className="after:absolute after:inset-0 hover:text-brand-800"
        >
          {scholarship.title}
        </Link>
      </h3>
      <div className="mt-1 flex items-center gap-1.5">
        {scholarship.institution?.logo_url ? (
          <Image
            src={scholarship.institution.logo_url}
            alt={`${scholarship.institution.name} logo`}
            width={16}
            height={16}
            unoptimized
            className="h-4 w-4 flex-none object-contain"
          />
        ) : null}
        <p className="text-xs text-ink-600">
          {scholarship.institution?.name ?? scholarship.sponsor_name}
        </p>
      </div>
      <p className="mt-2 text-sm font-semibold text-brand-800">
        {formatAwardAmount(
          scholarship.award_amount_min_cents,
          scholarship.award_amount_max_cents,
          scholarship.award_amount_text,
          scholarship.award_currency,
        )}
      </p>
      {formatDeadlineNote(scholarship.deadline, scholarship.is_rolling) ? (
        <p className="mt-1 text-xs text-ink-500">
          {formatDeadlineNote(scholarship.deadline, scholarship.is_rolling)}
        </p>
      ) : null}
    </article>
  )
}
