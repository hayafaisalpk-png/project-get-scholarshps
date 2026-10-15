import { cn } from '@/lib/utils/cn'

/**
 * Alert.
 *
 * `role="status"` for informational messages and `role="alert"` for errors, so a
 * screen reader announces them without stealing focus.
 */

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const TONES: Record<AlertTone, string> = {
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  success: 'bg-accent-50 text-accent-900 ring-accent-200',
  warning: 'bg-highlight-50 text-highlight-900 ring-highlight-200',
  error: 'bg-red-50 text-red-900 ring-red-200',
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone
  title?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-4 py-3 text-sm ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
    </div>
  )
}
