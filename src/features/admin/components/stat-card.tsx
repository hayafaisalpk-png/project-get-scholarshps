import type { LucideIcon } from 'lucide-react'

/**
 * Dashboard statistic card.
 *
 * The value is always a real database count. When a figure could not be read
 * the card renders an explicit em dash rather than a zero, because "zero" is a
 * claim about the data and "unavailable" is a claim about the query — showing
 * zero for a failed query would be a fabricated number.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  unavailable = false,
}: {
  label: string
  value: number | null
  icon: LucideIcon
  hint?: string
  unavailable?: boolean
}) {
  const showEmDash = unavailable || value === null

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <span className="rounded-sm bg-brand-50 p-2 text-brand-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900 tabular-nums">
        {showEmDash ? (
          <span
            className="text-ink-400"
            title="This figure could not be read with your current permissions."
          >
            —
          </span>
        ) : (
          value.toLocaleString('en-GB')
        )}
      </p>

      <p className="mt-1 text-xs text-ink-500">
        {showEmDash ? 'Not available to your role' : (hint ?? ' ')}
      </p>
    </div>
  )
}