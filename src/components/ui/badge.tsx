import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Badge.
 *
 * Used for scholarship status, deadline urgency and verification state.
 *
 * Status is conveyed by colour AND by text. Colour alone is not an accessible
 * signal, so a badge never reads as a bare coloured dot.
 */

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-accent-50 text-accent-800 ring-accent-200',
  warning: 'bg-highlight-50 text-highlight-800 ring-highlight-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Deadline badge.
 *
 * The wording is chosen so a student can act on it without opening the card:
 * "Closes today" and "Closes in 12 days" beat a bare date.
 */
export function DeadlineBadge({
  state,
  note,
}: {
  state: 'rolling' | 'closed' | 'today' | 'soon' | 'open' | 'unknown'
  note: string
}) {
  const tone: BadgeTone =
    state === 'closed'
      ? 'neutral'
      : state === 'today' || state === 'soon'
        ? 'danger'
        : state === 'open'
          ? 'warning'
          : 'success'

  if (state === 'unknown') return null

  return (
    <Badge tone={tone}>
      <span aria-hidden="true">{state === 'rolling' ? '●' : '◷'}</span>
      {note}
    </Badge>
  )
}
