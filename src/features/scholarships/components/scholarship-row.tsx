import { Award, CalendarClock, Repeat, Users } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/button'
import { DeadlineBadge } from '@/components/ui/badge'
import type { ScholarshipCard as ScholarshipCardData } from '@/features/scholarships/queries'
import {
  formatAwardAmount,
  formatDate,
  formatDeadlineNote,
  getDeadlineState,
} from '@/lib/format'

/**
 * Scholarship row card.
 *
 * The reference's signature listing pattern: a horizontal card with a content
 * column and a fixed action column, separated by a vertical hairline, with the
 * key facts as an icon-over-label grid divided by vertical rules
 * (docs/REFERENCE_ANALYSIS.md).
 *
 * Interaction model, deliberately NOT a stretched link:
 *
 *   The reference keeps the content area and the action area as two separate
 *   links. That is what allows the action column to stay clickable — a stretched
 *   `::after` overlay would sit on top of it. We do the same: the title and the
 *   action button are independent links to the same page. There are no nested
 *   interactive elements and no overlay trapping the button.
 */

export function ScholarshipRow({
  scholarship,
  metaColumns = 4,
}: {
  scholarship: ScholarshipCardData
  /**
   * How many metadata columns to lay out.
   *
   * Four matches the reference on a full-width listing. On `/scholarships` the
   * filter sidebar takes ~260px, which squeezes the card content to roughly
   * 530px — four columns there truncated award amounts and deadlines
   * ("1 Decembe…", "$2,500 - $…"). Values are never truncated, so the caller
   * drops to two columns instead.
   */
  metaColumns?: 2 | 4
}) {
  const deadlineState = getDeadlineState(scholarship.deadline, scholarship.is_rolling)
  const deadlineNote = formatDeadlineNote(scholarship.deadline, scholarship.is_rolling)
  const href = `/scholarships/${scholarship.slug}`

  const meta = [
    {
      icon: <Award className="h-4 w-4" aria-hidden="true" />,
      label: 'Award amount',
      value: formatAwardAmount(
        scholarship.award_amount_min_cents,
        scholarship.award_amount_max_cents,
        scholarship.award_amount_text,
        scholarship.award_currency,
      ),
    },
    {
      icon: <CalendarClock className="h-4 w-4" aria-hidden="true" />,
      label: 'Deadline',
      value: scholarship.is_rolling
        ? 'Rolling'
        : scholarship.deadline
          ? formatDate(scholarship.deadline.slice(0, 10))
          : 'Not recorded',
    },
    {
      icon: <Users className="h-4 w-4" aria-hidden="true" />,
      label: 'Awards',
      value:
        scholarship.number_of_awards === null
          ? 'Not recorded'
          : scholarship.number_of_awards.toLocaleString('en-US'),
    },
    {
      icon: <Repeat className="h-4 w-4" aria-hidden="true" />,
      label: 'Renewable',
      value: scholarship.is_renewable ? 'Yes' : 'No',
    },
  ]

  /**
   * Vertical hairline placement.
   *
   * Two visual columns: a rule on every second cell.
   * Four columns: the same rule below `sm`, and a rule on every cell but the
   * first from `sm` up. A cell at the start of a wrapped row must never get a
   * rule on its left edge.
   */
  const ruleClass = (i: number): string => {
    if (metaColumns === 2) {
      return i % 2 === 1 ? 'border-l border-ink-200 pl-4' : ''
    }
    if (i % 2 === 1) return 'border-l border-ink-200 pl-4 sm:pl-5'
    return i === 0 ? '' : 'sm:border-l sm:pl-5'
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-sm bg-white shadow-xs ring-1 ring-ink-200 transition-shadow duration-200 hover:shadow-md sm:flex-row">
      <div className="min-w-0 flex-1 p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DeadlineBadge state={deadlineState} note={deadlineNote} />
          {scholarship.featured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
              Featured
            </span>
          ) : null}
          {scholarship.application_fee_cents === 0 ? (
            <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200">
              No application fee
            </span>
          ) : null}
        </div>

        <h3 className="text-lg font-semibold leading-snug text-ink-900">
          <Link href={href} className="hover:text-brand-700">
            {scholarship.title}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-ink-500">
          Provided by{' '}
          <span className="font-medium text-ink-700">
            {scholarship.institution?.name ?? scholarship.sponsor_name}
          </span>
          {scholarship.institution?.country
            ? ` · ${scholarship.institution.country}`
            : null}
        </p>

        {scholarship.summary ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">
            {scholarship.summary}
          </p>
        ) : null}

        <dl
          className={
            metaColumns === 4
              ? 'mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-4'
              : 'mt-6 grid grid-cols-2 gap-y-5'
          }
        >
          {meta.map((item, i) => (
            <div key={item.label} className={`min-w-0 ${ruleClass(i)}`}>
              <dt className="flex items-center gap-1.5 text-ink-400">
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </dt>
              {/* Deliberately not `truncate`: an award amount or a deadline
                  that is visually clipped is worse than one that wraps. */}
              <dd className="mt-1 text-sm font-semibold leading-snug text-ink-900">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex shrink-0 flex-col justify-center gap-3 border-t border-ink-200 p-5 sm:w-58 sm:border-t-0 sm:border-l">
        {scholarship.institution?.logo_url ? (
          <div className="flex justify-center">
            <Image
              src={scholarship.institution.logo_url}
              alt={`${scholarship.institution.name} logo`}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 object-contain"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-sm bg-ink-100 text-2xl font-semibold text-ink-600"
            >
              {(scholarship.institution?.name ?? scholarship.sponsor_name)
                .charAt(0)
                .toUpperCase()}
            </span>
          </div>
        )}
        <ButtonLink href={href} className="w-full">
          View details
          <span className="sr-only-focusable"> for {scholarship.title}</span>
        </ButtonLink>

        {scholarship.application_fee_cents > 0 ? (
          <p className="text-center text-xs text-ink-500">
            Application fee applies
          </p>
        ) : null}

        {scholarship.last_reviewed_at ? (
          <p className="text-center text-xs leading-relaxed text-ink-500">
            Reviewed{' '}
            {formatDate(scholarship.last_reviewed_at.slice(0, 10))}
          </p>
        ) : null}
      </div>
    </article>
  )
}