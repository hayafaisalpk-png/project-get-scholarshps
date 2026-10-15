import { cn } from '@/lib/utils/cn'

/**
 * Skeleton placeholder.
 *
 * The shimmer is disabled automatically under `prefers-reduced-motion` by the
 * global stylesheet, so this stays safe for motion-sensitive users.
 */

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-ink-200/70', className)}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? 'h-4 w-2/3' : 'h-4 w-full'}
        />
      ))}
    </div>
  )
}

/** Matches the shape of a scholarship card so the layout does not shift. */
export function ScholarshipCardSkeleton() {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function ScholarshipGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <ScholarshipCardSkeleton key={i} />
      ))}
    </div>
  )
}
