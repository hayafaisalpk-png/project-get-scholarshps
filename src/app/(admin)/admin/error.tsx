'use client'

import { Button } from '@/components/ui/button'

/**
 * Administration error boundary.
 *
 * Handles the one error that is genuinely expected in normal operation:
 * an authenticated user whose account carries no administrative role. That
 * should be a clear message, not a stack trace and not a generic failure.
 *
 * `AuthorizationError` is a named class with a `status` of 403, so it is
 * matched structurally rather than by message text.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isAuthorization =
    error.name === 'AuthorizationError' ||
    (typeof error.message === 'string' &&
      error.message.includes('Administrative access required'))

  if (isAuthorization) {
    return (
      <div className="mx-auto max-w-lg rounded-sm border border-ink-200 bg-white p-8 text-center shadow-xs">
        <h1 className="text-xl font-bold text-ink-900">
          You do not have access to this area
        </h1>
        <p className="mt-3 text-sm text-ink-600">
          Your account is signed in, but it has not been granted an
          administrative role. Please contact an administrator who can assign
          one.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg rounded-sm border border-red-200 bg-white p-8 text-center shadow-xs">
      <h1 className="text-xl font-bold text-ink-900">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-ink-600">
        The page could not be loaded. The error has been recorded; please try
        again.
      </p>

      {/*
        The digest is Next.js's correlation id, not application detail. It is
        safe to surface and is what makes a report actionable.
      */}
      {error.digest ? (
        <p className="mt-3 text-xs text-ink-400">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}