import type { Metadata } from 'next'

/**
 * Authentication route group.
 *
 * Deliberately sits outside `(public)`: these pages must not inherit the
 * marketing header, footer or footer navigation. A sign-in form wrapped in the
 * public chrome invites users to wander off into the CMS.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  // Authentication pages must never be indexed or cached in a shared cache.
  robots: { index: false, follow: false, nocache: true },
  other: {
    bingbot: 'noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-12"
    >
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}