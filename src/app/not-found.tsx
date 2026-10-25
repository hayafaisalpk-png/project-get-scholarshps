import type { Metadata } from 'next'

import { NotFoundContent } from '@/components/layout/not-found-content'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'

/**
 * Global 404.
 *
 * This lives at the root of `app/` rather than in the `(public)` route group
 * because only the root `not-found.js` handles URLs that match no route. It
 * renders the site chrome itself, since the `(public)` layout does not apply.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex min-h-dvh flex-col">
        <SiteHeader />

        <main id="main-content" className="flex-1" tabIndex={-1}>
          <NotFoundContent />
        </main>

        <SiteFooter />
      </div>
    </>
  )
}
