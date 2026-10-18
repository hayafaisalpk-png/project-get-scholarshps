import Link from 'next/link'

import { BrandLockup } from '@/components/layout/brand-lockup'
import { MobileNav, NavLink } from '@/components/layout/mobile-nav'
import { ButtonLink } from '@/components/ui/button'
import { AccountMenu } from '@/features/auth/components/account-menu'
import { getAuthState } from '@/lib/auth/session'
import { getHeaderNavigation } from '@/lib/navigation'
import { getString } from '@/lib/settings'

/**
 * Site header.
 *
 * A Server Component: navigation, the site name and the session are read here
 * and only the interactive mobile menu crosses into the client.
 *
 * Layout follows the measured reference (docs/REFERENCE_ANALYSIS.md): white
 * bar, hairline bottom border, wordmark alone on the left, and on the right the
 * text links (Articles, About, Contact, Help) followed by the auth control.
 * Navigation and auth are grouped on the right so the bar has two anchors
 * instead of three competing ones. There is no rule between them: the outline
 * button is already a closed shape, so a divider next to it only added a second
 * vertical edge and read as clutter at this height.
 *
 * Deliberate departures from the reference:
 *
 * 1. There is no dark micro-bar above the bar. The reference uses it for
 *    "For Donors / For Applicants" — audiences we do not have. Inventing
 *    equivalents would be fake navigation, so the layer is simply absent.
 * 2. There is no "Join" call to action, because sign-up is closed by design
 *    (`AGENTS.md` §2.5). The header previously linked to `/auth/register`,
 *    which does not exist and 404'd; that link has been removed rather than
 *    restyled.
 * 3. There is no "Search scholarships" button. Search is the site's primary
 *    action and it is no longer duplicated in every bar on every page: the
 *    homepage hero search field, the scholarship detail page and the taxonomy
 *    landings all reach `/scholarships`, so the entry point survives the
 *    removal. See the note on the right-hand group below.
 * 4. The signed-in state is an "Admin" menu, not the account's email address.
 *    See `features/auth/components/account-menu.tsx`.
 */
export async function SiteHeader() {
  const [items, auth, siteName] = await Promise.all([
    getHeaderNavigation(),
    getAuthState(),
    getString('general.site_name', 'GetScholarship'),
  ])

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-white/90 backdrop-blur-sm">
      <div className="flex w-full flex-col items-start gap-4 px-4 pt-4 pb-[5px] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
        <div className="flex items-center gap-2">
          {/* Toggle first in the DOM so it sits left of the wordmark on
              mobile, as the reference does. Hidden on desktop, so the
              wordmark stays flush left there. */}
          <MobileNav
            items={items}
            authSlot={
              <div className="flex flex-col gap-3">
                {auth.user ? (
                  <AccountMenu />
                ) : (
                  <ButtonLink href="/auth/login" variant="primary">
                    Sign in
                  </ButtonLink>
                )}
              </div>
            }
          />

          {/*
            The brand lockup. The mark keeps the 32px box the placeholder occupied
            inside the `h-16` bar, and the name beside it is live text — see
            `brand-lockup.tsx` for why it is not baked into the image.
          */}
          <Link
            href="/"
            /* The site's own name, from settings, is the link's accessible name. */
            aria-label={siteName}
            className="flex min-w-0 items-center"
          >
            <BrandLockup variant="header" className="text-navy" />
          </Link>
        </div>

        {/*
          Responsive show/hide is done with WRAPPER elements, never with a
          `hidden sm:inline-flex` class on a control.

          `cn` is a plain joiner (see lib/utils/cn.ts), so a caller cannot
          reliably override a class the component already sets. Passing
          `hidden sm:inline-flex` to a button whose base class is
          `inline-flex` loses: the control stays visible below `sm` and
          overflows the viewport on a 390px screen. Wrapping sidesteps the
          conflict entirely and needs no class-merge dependency.
        */}
        <div className="flex items-center gap-2 lg:gap-4">
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center">
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} size="bar" />
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center sm:flex">
            {auth.user ? (
              /*
               * A session replaces the sign-in link. The email address is
               * NOT rendered: this bar is public chrome repeated on every
               * page, so an address here is noise to a visitor and a small
               * privacy exposure on a shared screen. The menu carries the
               * account actions instead.
               */
              <AccountMenu />
            ) : (
              /*
               * `outline`, not a `className` override of `primary`. The
               * brand fill is reserved for the one action the bar is asking
               * for, and "Sign in" is an account affordance rather than a
               * call to action. `outline` already carries the theme's
               * border/bg/hover ramp from `@/components/ui/button`, so it
               * tracks the palette automatically instead of pinning grey
               * hex steps at the call site.
               */
              <ButtonLink href="/auth/login" variant="outline" size="sm">
                Sign in
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
