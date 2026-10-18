import Link from 'next/link'

import { getLegalNavigation } from '@/lib/navigation'
import { getString } from '@/lib/settings'
import { PrivacySettingsButton } from '@/features/consent/consent-manager'

/**
 * Site footer.
 *
 * Columns come from the database so editors can reorganise them. The privacy
 * policy is a first-class link: consent-gated advertising makes it a legal
 * requirement, not a nicety.
 */

export async function SiteFooter() {
  const [legal, siteName] = await Promise.all([
    getLegalNavigation(),
    getString('general.site_name', 'GetScholarship'),
  ])

  return (
    <footer className="mt-auto border-t border-ink-200 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm text-ink-500">
            &copy; {new Date().getUTCFullYear()} {siteName}.online
          </p>

          {legal.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
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
              <li><PrivacySettingsButton /></li>
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
