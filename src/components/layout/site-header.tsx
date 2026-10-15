import { Search } from 'lucide-react'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/button'
import { Container } from '@/components/layout/container'
import { MobileNav, NavLink } from '@/components/layout/mobile-nav'
import { getAuthState } from '@/lib/auth/session'
import { getHeaderNavigation } from '@/lib/navigation'
import { getString } from '@/lib/settings'

/**
 * Site header.
 *
 * A Server Component: navigation, the site name and the session are read here
 * and only the interactive mobile menu crosses into the client.
 */

export async function SiteHeader() {
  const [items, auth, siteName] = await Promise.all([
    getHeaderNavigation(),
    getAuthState(),
    getString('general.site_name', 'GetScholarship'),
  ])

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Container>
        <div className="flex h-[4.5rem] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-brand-800"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white"
            >
              G
            </span>
            {siteName}
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/scholarships"
              className="hidden h-11 items-center gap-2 rounded-lg border border-ink-300 px-4 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50 sm:inline-flex"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Link>

            {auth.user ? (
              <span className="hidden text-sm text-ink-600 lg:inline">
                {auth.user.email}
              </span>
            ) : (
              <>
                <ButtonLink
                  href="/auth/login"
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  Sign in
                </ButtonLink>
                <ButtonLink
                  href="/auth/register"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  Create account
                </ButtonLink>
              </>
            )}

            <MobileNav
              items={items}
              authSlot={
                <div className="flex flex-col gap-3">
                  {auth.user ? (
                    <p className="text-sm text-ink-600">Signed in as {auth.user.email}</p>
                  ) : (
                    <>
                      <ButtonLink href="/auth/login" variant="outline">
                        Sign in
                      </ButtonLink>
                      <ButtonLink href="/auth/register">Create account</ButtonLink>
                    </>
                  )}
                </div>
              }
            />
          </div>
        </div>
      </Container>
    </header>
  )
}
