'use client'

/**
 * The small action button used by both inbox triage controls.
 *
 * A Client Component so it can live inside an already-client tree without
 * pulling another module boundary into the server bundle.
 */
export function InboxActionButton({
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled: boolean
  tone?: 'default' | 'primary' | 'danger'
}) {
  const tones = {
    default:
      'border border-ink-300 text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500',
    primary:
      'border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-500',
    danger:
      'border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  )
}