import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Container, Section } from '@/components/layout/container'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { JsonLd } from '@/components/structured-data'
import { ScholarshipCard } from '@/features/scholarships/components/scholarship-card'
import {
  PAGE_SIZE,
  type RawSearchParams,
  type ScholarshipSearch,
  hasActiveFilters,
  parseScholarshipSearch,
  scholarshipSearchPath,
} from '@/features/scholarships/search-params'
import { searchScholarships } from '@/features/scholarships/queries'
import { absoluteUrl } from '@/lib/env'
import { breadcrumbLd, collectionPageLd, graph, itemListLd } from '@/lib/structured-data'
import { getTermBySlug } from '@/lib/taxonomy'

/**
 * Taxonomy landing page renderer, shared by category, education-level, field and
 * location routes.
 *
 * SEO rules applied here, per docs/SEO_GUIDELINES.md:
 *
 *   - A landing page that matches zero scholarships is NOT published. It 404s
 *     rather than rendering an empty shell, because a thin page with no value
 *     is worse than no page.
 *   - Each landing page needs original introduction copy. `intro_content` from
 *     the CMS is used; when an editor has written none, an honest short
 *     description is generated from the term's own `description` rather than
 *     boilerplate keyword text.
 */

export type TaxonomyKind = {
  /** Database table backing this landing page. */
  table: 'categories' | 'education_levels' | 'academic_fields' | 'locations'
  /** URL segment, e.g. 'education-level'. */
  segment: string
  /** Search filter key this landing page applies. */
  filterKey: 'category' | 'level' | 'field' | 'location'
  /** Plural noun used in generated copy. */
  noun: string
}

/**
 * Taxonomy kinds, keyed by URL segment.
 *
 * Declared with `as const satisfies` rather than as a `Record<string, ...>` so
 * that lookups return a concrete `TaxonomyKind` instead of
 * `TaxonomyKind | undefined` under `noUncheckedIndexedAccess`, while still
 * checking that every entry is valid.
 */
export const TAXONOMY_KINDS = {
  category: {
    table: 'categories',
    segment: 'category',
    filterKey: 'category',
    noun: 'scholarship',
  },
  'education-level': {
    table: 'education_levels',
    segment: 'education-level',
    filterKey: 'level',
    noun: 'scholarship',
  },
  field: {
    table: 'academic_fields',
    segment: 'field',
    filterKey: 'field',
    noun: 'scholarship',
  },
  location: {
    table: 'locations',
    segment: 'location',
    filterKey: 'location',
    noun: 'scholarship',
  },
} as const satisfies Record<string, TaxonomyKind>

/** Copy that varies by landing page type, not duplicated per route. */
const PAGE_COPY: Record<TaxonomyKind['filterKey'], { heading: (n: string) => string; blurb: string }> = {
  category: {
    heading: (n) => `${n}`,
    blurb:
      'Every listing below has been reviewed and carries a confirmed official application link.',
  },
  level: {
    heading: (n) => `Scholarships for ${n.toLowerCase()} students`,
    blurb:
      'Filter further by field of study, location or deadline using the search controls.',
  },
  field: {
    heading: (n) => `${n} scholarships`,
    blurb:
      'Awards open to students studying in this field, at any education level.',
  },
  location: {
    heading: (n) => `Scholarships available in ${n}`,
    blurb:
      'Awards open to students who live or study in this location. Check each listing for its own eligibility rules.',
  },
}

/** Simple English plural for the generic "scholarship" noun. */
function pluralNoun(kind: TaxonomyKind): string {
  return kind.noun.endsWith('s') ? `${kind.noun}es` : `${kind.noun}s`
}

/**
 * Apply the landing page's own filter on top of whatever the visitor selected.
 *
 * The page's filter always wins: someone who clicked "Nursing scholarships" must
 * not be able to remove nursing by editing the URL.
 */
function applyTaxonomyFilter(
  kind: TaxonomyKind,
  slug: string,
  raw: RawSearchParams,
): ScholarshipSearch {
  const search = parseScholarshipSearch(raw)
  return { ...search, [kind.filterKey]: [slug] }
}

export async function renderTaxonomyPage({
  kind,
  slug,
  raw,
}: {
  kind: TaxonomyKind
  slug: string
  raw: RawSearchParams
}) {
  const term = await getTermBySlug(kind.table, slug)

  if (!term) notFound()

  const search = applyTaxonomyFilter(kind, slug, raw)
  const result = await searchScholarships(search, { pageSize: PAGE_SIZE })

  if (!result.ok) {
    return (
      <Section>
        <Container>
          <h1 className="text-3xl font-bold text-ink-900">
            {PAGE_COPY[kind.filterKey].heading(term.name)}
          </h1>
          <EmptyState
            className="mt-8"
            title="We could not load these scholarships right now"
            description="Something went wrong on our side. Please try again shortly."
          />
        </Container>
      </Section>
    )
  }

  const { items, total, page, totalPages } = result.data

  // No matching scholarships means this page would be thin. 404 instead.
  if (total === 0) notFound()

  const copy = PAGE_COPY[kind.filterKey]

  /*
   * Structured data for the landing page.
   *
   * Two subtleties, both about claiming something this page is not:
   *
   *   - `ItemList` is emitted for the results on THIS page only. A taxonomy
   *     landing paginates, and describing page 1 as the complete list of
   *     scholarships in a category would be a false enumeration.
   *   - The landing may also carry its own filters (`?level=`, `?q=`). A filtered
   *     permutation is `noindex`, so the page-level claim is withheld there and
   *     the same way it is on /scholarships.
   */
  const landingPath = `/scholarships/${kind.segment}/${slug}`
  const hasExtraFilters = hasActiveFilters(
    parseScholarshipSearch({ ...raw, [kind.filterKey]: undefined }),
  )

  const structuredData = hasExtraFilters
    ? null
    : graph(
        collectionPageLd({
          name: copy.heading(term.name),
          description: term.description ?? `${total} ${kind.noun} listed.`,
          path: landingPath,
        }),
        breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Scholarships', path: '/scholarships' },
          { name: term.name, path: landingPath },
        ]),
        itemListLd({
          name: copy.heading(term.name),
          path: landingPath,
          items: items.map((item) => ({
            name: item.title,
            path: `/scholarships/${item.slug}`,
          })),
        }),
      )

  return (
    <Section>
      <Container>
        <JsonLd data={structuredData} />

        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <li>
              <Link href="/" className="hover:text-brand-800 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/scholarships" className="hover:text-brand-800 hover:underline">
                Scholarships
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ink-900">
              {term.name}
            </li>
          </ol>
        </nav>

        <header className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {copy.heading(term.name)}
          </h1>
          <p className="mt-3 text-lg text-ink-600">
            {total.toLocaleString('en-US')}{' '}
            {total === 1 ? kind.noun : pluralNoun(kind)} listed.
          </p>
          {term.description ? (
            <p className="mt-3 text-ink-600">{term.description}</p>
          ) : null}
          <p className="mt-3 text-sm text-ink-500">{copy.blurb}</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((scholarship) => (
            <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
          ))}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(target) =>
            scholarshipSearchPath({ ...search, page: target })
          }
        />
      </Container>
    </Section>
  )
}

/**
 * Metadata for a taxonomy landing page.
 *
 * `noindex` if the term is thin or has no listings, so a thin page can never be
 * advertised to search engines even if it is linked internally.
 */
export async function taxonomyMetadata({
  kind,
  slug,
  raw,
}: {
  kind: TaxonomyKind
  slug: string
  raw: RawSearchParams
}): Promise<Metadata> {
  const term = await getTermBySlug(kind.table, slug)

  if (!term) {
    return { title: 'Not found', robots: { index: false, follow: true } }
  }

  const search = applyTaxonomyFilter(kind, slug, raw)
  const result = await searchScholarships(search, { pageSize: 1 })

  const total = result.ok ? result.data.total : 0
  const thin = total === 0

  const title = PAGE_COPY[kind.filterKey].heading(term.name)
  const description =
    term.description ??
    `Browse ${total.toLocaleString('en-US')} verified scholarships for ${term.name.toLowerCase()} on GetScholarship.`

  const path = `/scholarships/${kind.segment}/${term.slug}`

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: path },
    openGraph: {
      title,
      description: description.slice(0, 300),
      url: absoluteUrl(path),
    },
    // Pagination beyond page 1 canonicalises to page 1; the deeper pages are
    // reachable but not competing with it.
    robots: thin ? { index: false, follow: true } : { index: true, follow: true },
  }
}
