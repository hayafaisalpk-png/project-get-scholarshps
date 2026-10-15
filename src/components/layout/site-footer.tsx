import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { getLegalNavigation, getFooterNavigation } from '@/lib/navigation'
import { getPublicSettings, getString } from '@/lib/settings'

/**
 * Site footer.
 *
 * Columns come from the database so editors can reorganise them. The privacy
 * policy is a first-class link: consent-gated advertising makes it a legal
 * requirement, not a nicety.
 */

const COLUMN_TITLES: Record<string, string> = {
  footer_column_1: 'About',
  footer_column_2: 'Scholarships',
  footer_column_3: 'Resources',
  footer_column_4: 'More',
}

export async function SiteFooter() {
  const [columns, legal, siteName, tagline] = await Promise.all([
    getFooterNavigation(),
    getLegalNavigation(),
    getString('general.site_name', 'GetScholarship'),
    getString('general.tagline', 'Find scholarships, grants and financial aid'),
  ])

  const settings = await getPublicSettings()

  const socialLinks = [
    { key: 'social.facebook_url', label: 'Facebook' },
    { key: 'social.instagram_url', label: 'Instagram' },
    { key: 'social.linkedin_url', label: 'LinkedIn' },
    { key: 'social.youtube_url', label: 'YouTube' },
  ]
    .map((s) => ({ ...s, url: settings[s.key] }))
    .filter((s): s is { key: string; label: string; url: string } =>
      typeof s.url === 'string' && s.url.length > 0,
    )

  const nonEmptyColumns = Object.entries(columns).filter(
    ([, items]) => items.length > 0,
  )

  return (
    <footer className="mt-auto border-t border-ink-200 bg-surface">
      <Container>
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-base font-bold text-brand-800">{siteName}</p>
            <p className="mt-2 max-w-sm text-sm text-ink-600">{tagline}</p>

            {socialLinks.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-4">
                {socialLinks.map((social) => (
                  <li key={social.key}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-ink-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {social.label}
                      <span className="sr-only-focusable"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {nonEmptyColumns.map(([key, items]) => (
            <nav key={key} aria-label={COLUMN_TITLES[key] ?? key}>
              <h2 className="text-sm font-semibold text-ink-900">
                {COLUMN_TITLES[key] ?? key}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="text-sm text-ink-600 hover:text-brand-800 hover:underline underline-offset-4"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-ink-200 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500">
            &copy; {new Date().getUTCFullYear()} {siteName}
          </p>

          {legal.length > 0 ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legal.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="text-sm text-ink-600 hover:text-brand-800 hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </footer>
  )
}
