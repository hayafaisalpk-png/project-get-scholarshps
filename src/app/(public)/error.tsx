'use client'

import { Container, Section } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'

/**
 * Route-level error boundary.
 *
 * Receives the thrown error but must NOT render its message: it can contain SQL,
 * column names or internal detail. Visitors get a plain explanation and the
 * operator gets the detail in the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('[route error]', error.digest ?? '', error.message)

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-xl py-16 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            Something went wrong
          </h1>
          <p className="mt-4 text-ink-600">
            We could not complete that request. The problem has been logged.
            Please try again.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/scholarships">Search scholarships</ButtonLink>
            <ButtonLink href="/" variant="outline">
              Go to the homepage
            </ButtonLink>
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-6 text-sm font-medium text-brand-700 underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </Container>
    </Section>
  )
}
