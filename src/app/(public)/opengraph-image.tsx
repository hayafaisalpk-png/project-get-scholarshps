import { OG_SIZE, renderOgCard } from '@/lib/og-image'

/**
 * Social card for every page in this segment.
 *
 * Placed at the root of `(public)`, so it covers the homepage, the scholarship and
 * article listings, and all six static pages — anywhere without a more specific
 * card of its own. More specific route-level cards override it, which is why the
 * scholarship and article detail pages have their own.
 *
 * Deliberately STATIC: it is the card for pages that have no per-record data to
 * show, so reading the database here would buy nothing. Being static also means
 * it is generated once at build time and served from cache.
 *
 * Nothing on it is invented. Every claim on the card is a description of what the
 * site actually does, and the filters named are exactly the ones rendered by
 * `src/app/(public)/scholarships/page.tsx`.
 */
export const alt = 'GetScholarship — scholarship search'

export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderOgCard({
    eyebrow: 'Scholarships and financial aid',
    title: 'Find and compare scholarships',
    subtitle:
      'Search by keyword, education level, field of study, location, award amount and deadline.',
  })
}