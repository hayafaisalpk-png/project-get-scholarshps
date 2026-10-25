import Link from 'next/link'

import { Container, Section } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'

/**
 * 404 content.
 *
 * Shared by the route-group boundary and the root `app/not-found.tsx`, because
 * only the root file handles URLs that match no route at all.
 *
 * `noindex` (injected by Next.js), and it never reveals whether a requested
 * scholarship slug exists but is unpublished — a missing record and a hidden
 * record must be indistinguishable to a visitor probing URLs.
 */
export function NotFoundContent() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-xl py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            We could not find that page
          </h1>
          <p className="mt-4 text-ink-600">
            The page you are looking for may have moved, or the link may be
            incorrect. Searching for scholarships is the quickest way to find
            what you need.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/scholarships">Search scholarships</ButtonLink>
            <ButtonLink href="/" variant="outline">
              Go to the homepage
            </ButtonLink>
          </div>

          <nav aria-label="Popular pages" className="mt-12 border-t border-ink-200 pt-8">
            <h2 className="text-sm font-semibold text-ink-900">Popular pages</h2>
            <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {[
                { href: '/scholarships', label: 'All scholarships' },
                { href: '/scholarships?deadline=open', label: 'Still open' },
                { href: '/articles', label: 'Guides and articles' },
                { href: '/about', label: 'About us' },
                { href: '/help', label: 'Help' },
                { href: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-brand-700 hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </Section>
  )
}
