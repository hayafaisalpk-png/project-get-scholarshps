/**
 * Display formatting.
 *
 * Pure functions, unit tested, with no locale or timezone surprises: amounts are
 * formatted in USD from integer cents, and dates are treated as plain calendar
 * dates rather than instants.
 *
 * Deadlines matter more than usual on this site — a student must not be misled
 * about whether an application is still open — so date handling is explicit
 * rather than relying on `new Date(string)` parsing.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** Format integer cents as a currency amount. */
export function formatCurrency(
  cents: number | null | undefined,
  options: { currency?: string; compact?: boolean } = {},
): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return ''

  const currency = options.currency ?? 'USD'

  // Amounts in this domain span tens to tens of thousands; compact form keeps
  // card layouts from overflowing.
  if (options.compact) {
    const dollars = cents / 100
    if (Math.abs(dollars) >= 1_000_000)
      return `$${trim(dollars / 1_000_000, 1)}M`
    if (Math.abs(dollars) >= 1_000)
      return `$${trim(dollars / 1_000, 0)}k`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function trim(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.0+$/, '')
}

/**
 * Render an award amount, including ranges.
 *
 * `award_amount_text` exists for awards that are not a simple currency figure
 * ("full tuition", "varies"), and takes precedence when present.
 */
export function formatAwardAmount(
  min: number | null | undefined,
  max: number | null | undefined,
  text: string | null | undefined,
  currency = 'USD',
): string {
  if (text && text.trim().length > 0) return text.trim()

  const hasMin = typeof min === 'number' && Number.isFinite(min)
  const hasMax = typeof max === 'number' && Number.isFinite(max)

  if (!hasMin && !hasMax) return 'Amount not specified'

  if (hasMin && hasMax && min !== max) {
    return `${formatCurrency(min, { currency })} - ${formatCurrency(max, { currency })}`
  }

  return formatCurrency(hasMax ? max : min, { currency })
}

/**
 * Parse a `YYYY-MM-DD` date into a UTC Date.
 *
 * Returns null for anything unparseable so callers can handle "unknown"
 * explicitly rather than rendering "Invalid Date".
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  // Reject roll-over dates such as 2026-02-31.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }

  return date
}

/** Format a date as "15 October 2026". */
export function formatDate(value: string | null | undefined): string {
  const date = parseDateOnly(value)
  if (!date) return ''

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Format a date as "15 Oct 2026", for dense layouts. */
export function formatDateShort(value: string | null | undefined): string {
  const date = parseDateOnly(value)
  if (!date) return ''

  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export type DeadlineState = 'rolling' | 'closed' | 'today' | 'soon' | 'open' | 'unknown'

/**
 * Classify a deadline for display.
 *
 * `soon` is three days or fewer, which is aggressive enough to prompt a student
 * to act without turning every card into an alarm.
 */
export function getDeadlineState(
  deadline: string | null | undefined,
  isRolling: boolean,
  today: Date = new Date(),
): DeadlineState {
  if (isRolling) return 'rolling'

  const date = parseDateOnly(deadline)
  if (!date) return 'unknown'

  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )
  const days = Math.round((date.getTime() - todayUtc) / 86_400_000)

  if (days < 0) return 'closed'
  if (days === 0) return 'today'
  if (days <= 3) return 'soon'
  return 'open'
}

/** Days remaining. Negative once passed, null for rolling or unknown. */
export function daysUntil(
  deadline: string | null | undefined,
  today: Date = new Date(),
): number | null {
  const date = parseDateOnly(deadline)
  if (!date) return null

  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )

  return Math.round((date.getTime() - todayUtc) / 86_400_000)
}

/**
 * Human phrasing for a deadline, e.g. "Closes in 12 days".
 *
 * Returns an empty string when there is nothing meaningful to say, so callers
 * can render conditionally rather than showing "Closes in null days".
 */
export function formatDeadlineNote(
  deadline: string | null | undefined,
  isRolling: boolean,
  today: Date = new Date(),
): string {
  const state = getDeadlineState(deadline, isRolling, today)

  switch (state) {
    case 'rolling':
      return 'Applications open all year'
    case 'unknown':
      return ''
    case 'today':
      return 'Closes today'
    case 'closed': {
      const days = daysUntil(deadline, today)
      if (days === null) return 'Closed'
      const n = Math.abs(days)
      return n === 1 ? 'Closed 1 day ago' : `Closed ${n} days ago`
    }
    default: {
      const days = daysUntil(deadline, today)
      if (days === null) return ''
      return days === 1 ? 'Closes tomorrow' : `Closes in ${days} days`
    }
  }
}

/** Format an ISO timestamp as "15 October 2026". */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Approximate reading time. Used for article listings. */
export function readingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / 220))
  return `${minutes} min read`
}

/**
 * Cut a string to a maximum number of characters, marking the cut.
 *
 * This is a HARD cut, not a word-boundary cut. The character budget is the
 * contract — a table column is a fixed width — so the last visible word may
 * be cut in half. The article metadata builder makes the opposite trade-off
 * (`truncateAtWord` in `src/features/articles/metadata.ts`): it reads better
 * inside a sentence but can end up shorter than the limit it was given.
 *
 * The ellipsis is a marker, not part of the budget: the result is at most
 * `maxLength` characters of the original text plus the marker. A cut that
 * lands on a space does not leave a double space before the marker.
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = ' ...',
): string {
  if (maxLength <= 0) return ''
  if (text.length <= maxLength) return text

  return `${text.slice(0, maxLength).trimEnd()}${ellipsis}`
}
