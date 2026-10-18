import type { Metadata } from 'next'

import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { JsonLd } from '@/components/structured-data'
import { getString, isMaintenanceMode } from '@/lib/settings'
import { siteGraph } from '@/lib/structured-data'

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

  /*
   * Site-level structured data, emitted once here rather than per page.
   *
   * `Organization` and `WebSite` describe the site, not any one page, so every
   * indexable page would otherwise repeat them — and a page that has asked not
   * to be indexed still renders inside this layout, which is exactly why these
   * belong at site level and the page-level nodes do not.
   *
   * Both values come from `site_settings`, so an editor can correct the
   * publisher's name or contact address without a code change.
   */
  const siteName = await getString('general.site_name', 'GetScholarship')
  const siteDescription = await getString(
    'general.description',
    'Search scholarships, grants and financial aid.',
  )
  const siteEmail = await getString('contact.email', '')

  const siteLd = siteGraph({
    name: siteName,
    description: siteDescription,
    email: siteEmail || undefined,
    socialUrls: [
      await getString('social.facebook_url', ''),
      await getString('social.instagram_url', ''),
      await getString('social.linkedin_url', ''),
      await getString('social.youtube_url', ''),
    ],
  })

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
      <JsonLd data={siteLd} />

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
