import type { Metadata } from 'next'

import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { isMaintenanceMode } from '@/lib/settings'

/**
 * Public site layout.
 *
 * The route group `(public)` keeps these routes out of the URL while sharing the
 * site chrome. Admin routes sit outside it and must never inherit the public
 * header, footer or footer navigation.
 */

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: '/' },
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const maintenance = await isMaintenanceMode()

  if (maintenance) {
    // Render bare: the point of maintenance mode is to keep the site up while
    // the database or content is being repaired, so nothing else should load.
    return (
      <html lang="en">
        <body className="min-h-dvh bg-background text-foreground">
          <main className="container-page flex min-h-dvh max-w-2xl items-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-ink-900">
                We are carrying out maintenance
              </h1>
              <p className="mt-3 text-ink-600">
                GetScholarship is temporarily unavailable while we carry out
                scheduled work. Please try again shortly.
              </p>
            </div>
          </main>
        </body>
      </html>
    )
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex min-h-dvh flex-col">
        <SiteHeader />

        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>

        <SiteFooter />
      </div>
    </>
  )
}
