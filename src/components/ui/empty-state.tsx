import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Empty state.
 *
 * An empty result set is a normal outcome for a search engine, not an error, so
 * it gets a dedicated component with a clear explanation and a way forward.
 */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-ink-400" aria-hidden="true">
          {icon}
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>

      {description ? (
        <p className="mt-2 max-w-md text-sm text-ink-600">{description}</p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
