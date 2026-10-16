import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

/**
 * Pagination.
 *
 * Renders a `<nav aria-label="Pagination">` containing an ordered list, so the
 * page count is announced correctly. Only a window of pages around the current
 * one is shown; at 50,000 results an "every page" list would be unusable.
 */

export type PaginationProps = {
  page: number
  totalPages: number
  /** Builds the href for a given page, preserving current filters. */
  buildHref: (page: number) => string
  className?: string
}

/** How many page links to show either side of the current page. */
const WINDOW = 1

function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 1) return []

  const pages = new Set<number>([1, totalPages])
  for (let i = page - WINDOW; i <= page + WINDOW; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const result: (number | 'gap')[] = []

  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push('gap')
    result.push(p)
    previous = p
  }

  return result
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = pageWindow(page, totalPages)
  const previousHref = page > 1 ? buildHref(page - 1) : null
  const nextHref = page < totalPages ? buildHref(page + 1) : null

  const itemClasses = (active: boolean) =>
    cn(
      'inline-flex h-10 min-w-10 items-center justify-center rounded-sm px-3 text-sm font-semibold transition-colors',
      active
        ? 'bg-brand-700 text-white'
        : 'text-ink-700 hover:bg-ink-100 active:bg-ink-200',
    )

  return (
    <nav aria-label="Pagination" className={cn('mt-10', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {previousHref ? (
            <Link href={previousHref} rel="prev" className={itemClasses(false)}>
              <span aria-hidden="true">Previous</span>
              <span className="sr-only-focusable">Previous page</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClasses(false), 'pointer-events-none opacity-40')}
            >
              Previous
            </span>
          )}
        </li>

        {pages.map((entry, index) =>
          entry === 'gap' ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-2 text-ink-400"
            >
              &hellip;
            </li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span aria-current="page" className={itemClasses(true)}>
                  {entry}
                </span>
              ) : (
                <Link href={buildHref(entry)} className={itemClasses(false)}>
                  {entry}
                </Link>
              )}
            </li>
          ),
        )}

        <li>
          {nextHref ? (
            <Link href={nextHref} rel="next" className={itemClasses(false)}>
              <span aria-hidden="true">Next</span>
              <span className="sr-only-focusable">Next page</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClasses(false), 'pointer-events-none opacity-40')}
            >
              Next
            </span>
          )}
        </li>
      </ul>

      <p className="mt-4 text-center text-sm text-ink-600">
        Page {page} of {totalPages}
      </p>
    </nav>
  )
}
