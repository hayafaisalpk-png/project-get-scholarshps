import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, Section } from '@/components/layout/container'
import { Button, ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { ScholarshipCard } from '@/features/scholarships/components/scholarship-card'
import {
  DEADLINE_OPTIONS,
  SORT_OPTIONS,
  type RawSearchParams,
  type ScholarshipSearch,
  hasActiveFilters,
  parseScholarshipSearch,
  scholarshipSearchPath,
  toSearchRpcArgs,
} from '@/features/scholarships/search-params'
import { PAGE_SIZE } from '@/features/scholarships/search-params'
import { searchScholarships } from '@/features/scholarships/queries'
import {
  getAcademicFields,
  getEducationLevels,
  getScholarshipCategories,
} from '@/lib/taxonomy'

/**
 * Scholarship search.
 *
 * The form is a plain GET form that submits to this same route, so filtering
 * works with JavaScript disabled, every state is a shareable URL, and the
 * browser's back button behaves. Nothing is filtered in the browser: the query
 * runs in PostgreSQL and only one page of results is ever sent.
 *
 * DELIBERATELY NO `loading.tsx` IN THIS SEGMENT
 *
 * A route-segment `loading.tsx` opens a Suspense boundary ABOVE this page, so the
 * skeleton is flushed with a `200` before the page resolves. Any `notFound()`
 * thrown below it then renders the 404 UI but the status stays `200` — a soft
 * 404, which search engines treat as duplicate or low-value content.
 *
 * Measured: with `loading.tsx` present, `/scholarships/nonexistent-slug`
 * returned `200` with 404 content. Without it, the same URL returns `404`.
 * Correct status codes beat a loading skeleton, so the skeleton was removed.
 * If loading states are reintroduced, wrap the results area in a `<Suspense>`
 * INSIDE this page, after the notFound() decision, rather than adding a
 * segment-level `loading.tsx`.
 */

export const dynamic = 'force-dynamic'

const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  relevance: 'Most relevant',
  newest: 'Newest first',
  deadline: 'Closing soonest',
  amount_desc: 'Highest award',
}

const DEADLINE_LABELS: Record<(typeof DEADLINE_OPTIONS)[number], string> = {
  any: 'Any deadline',
  open: 'Still open',
  week: 'Closing this week',
  month: 'Closing this month',
  closed: 'Recently closed',
}

/**
 * Canonical URL for the current state.
 *
 * Filtered and sorted permutations are `noindex, follow`: they are useful to a
 * visitor but must not flood the index with near-duplicate pages. The unfiltered
 * page is the one that should rank.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}): Promise<Metadata> {
  const raw = await searchParams
  const search = parseScholarshipSearch(raw)

  const filtered = hasActiveFilters(search)

  const canonical = filtered
    ? '/scholarships'
    : scholarshipSearchPath(search)

  return {
    title: filtered
      ? `${resultSummary(search)} | Scholarships`
      : 'Scholarships',
    description: filtered
      ? 'Filtered scholarship results.'
      : 'Search scholarships by keyword, education level, field of study, location, award amount and deadline.',
    alternates: { canonical },
    robots: filtered
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

function resultSummary(search: ScholarshipSearch): string {
  if (search.q) return `Results for "${search.q}"`
  if (search.level.length > 0) return 'Filtered scholarships'
  return 'Filtered results'
}

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const raw = await searchParams
  const search = parseScholarshipSearch(raw)

  const [levels, fields, categories] = await Promise.all([
    getEducationLevels(),
    getAcademicFields(),
    getScholarshipCategories(),
  ])

  const result = await searchScholarships(search, { pageSize: PAGE_SIZE })

  // A database failure must not look like "no results". Both render an error
  // state, but only this one tells the visitor to try again.
  if (!result.ok) {
    return (
      <Section>
        <Container>
          <h1 className="text-3xl font-bold text-ink-900">Find scholarships</h1>
          <EmptyState
            className="mt-8"
            title="We could not load scholarships right now"
            description="Something went wrong on our side. Please try again in a moment."
            action={
              <ButtonLink href="/scholarships" variant="outline">
                Reload
              </ButtonLink>
            }
          />
        </Container>
      </Section>
    )
  }

  const { items, total, page, totalPages } = result.data
  const filtered = hasActiveFilters(search)

  // The page state drives every "no results" message, so the visitor is told
  // what to change rather than simply told nothing matched.
  let emptyTitle = 'No scholarships match your filters'
  let emptyDescription =
    'Try removing a filter or broadening your search term.'
  if (search.q) {
    emptyTitle = `No scholarships found for "${search.q}"`
    emptyDescription =
      'Check the spelling, try a broader term, or remove a filter to widen the search.'
  } else if (filtered) {
    emptyTitle = 'No scholarships match this combination'
    emptyDescription =
      'Filters are combined, so a narrow combination can return nothing. Try removing one.'
  }

  return (
    <Section>
      <Container>
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Find scholarships
          </h1>
          <p className="mt-2 text-ink-600">
            {total > 0
              ? `${total.toLocaleString('en-US')} ${total === 1 ? 'scholarship' : 'scholarships'} available`
              : 'Search by keyword, level, field or location'}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
          <aside aria-labelledby="filters-heading">
            <h2 id="filters-heading" className="sr-only-focusable">
              Filters
            </h2>

            <form action="/scholarships" method="get" className="space-y-6">
              {/* Preserve the search term and sort when filters change. */}
              {search.q ? <input type="hidden" name="q" value={search.q} /> : null}
              <input type="hidden" name="sort" value={search.sort} />

              <FilterGroup title="Education level">
                {levels.map((level) => (
                  <CheckboxFilter
                    key={level.id}
                    name="level"
                    value={level.slug}
                    label={level.name}
                    defaultChecked={search.level.includes(level.slug)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Field of study">
                {fields.map((field) => (
                  <CheckboxFilter
                    key={field.id}
                    name="field"
                    value={field.slug}
                    label={field.name}
                    defaultChecked={search.field.includes(field.slug)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Type">
                {categories.map((category) => (
                  <CheckboxFilter
                    key={category.id}
                    name="category"
                    value={category.slug}
                    label={category.name}
                    defaultChecked={search.category.includes(category.slug)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Deadline">
                <div className="space-y-2">
                  {DEADLINE_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700"
                    >
                      <input
                        type="radio"
                        name="deadline"
                        value={option}
                        defaultChecked={search.deadline === option}
                        className="h-4 w-4 border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                      />
                      {DEADLINE_LABELS[option]}
                    </label>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title="Other">
                <div className="space-y-2">
                  <CheckboxFilter
                    name="renewable"
                    value="1"
                    label="Renewable awards"
                    defaultChecked={search.renewable}
                  />
                  <CheckboxFilter
                    name="freeApplication"
                    value="1"
                    label="No application fee"
                    defaultChecked={search.freeApplication}
                  />
                </div>
              </FilterGroup>

              <div className="flex gap-3">
                <Button type="submit" size="sm">
                  Apply filters
                </Button>
                {filtered ? (
                  <Link
                    href="/scholarships"
                    className="inline-flex h-9 items-center rounded-sm px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                  >
                    Clear all
                  </Link>
                ) : null}
              </div>
            </form>
          </aside>

          <div>
            <div className="mb-6 flex flex-col gap-4 border-b border-ink-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-600" aria-live="polite">
                {total > 0
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
                  : 'No results'}
              </p>

              <form action="/scholarships" method="get" className="flex items-center gap-2">
                {preservedParams(search, ['sort'])}
                <label htmlFor="sort" className="text-sm text-ink-600">
                  Sort by
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={search.sort}
                  className="h-9 rounded-sm border border-ink-300 bg-white px-2 text-sm text-ink-900"
                >
                  {SORT_OPTIONS.filter((option) =>
                    option === 'relevance' ? search.q.length > 0 : true,
                  ).map((option) => (
                    <option key={option} value={option}>
                      {SORT_LABELS[option]}
                    </option>
                  ))}
                </select>
                <noscript>
                  <Button type="submit" size="sm" variant="outline">
                    Go
                  </Button>
                </noscript>
              </form>
            </div>

            {items.length > 0 ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
              </>
            ) : (
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                action={
                  filtered ? (
                    <ButtonLink href="/scholarships" variant="outline">
                      Clear all filters
                    </ButtonLink>
                  ) : null
                }
              />
            )}
          </div>
        </div>
      </Container>
    </Section>
  )
}

function FilterGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-ink-900">{title}</legend>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">{children}</div>
    </fieldset>
  )
}

function CheckboxFilter({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string
  value: string
  label: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      />
      {label}
    </label>
  )
}

/**
 * Hidden inputs carrying the current filters into the sort form, so changing the
 * sort does not silently discard the filters.
 */
function preservedParams(
  search: ScholarshipSearch,
  exclude: (keyof ScholarshipSearch)[],
): React.ReactNode {
  const params = toSearchRpcArgs(search)

  const mapping: [string, string][] = [
    ['q', params.p_q ?? ''],
    ['level', params.p_levels?.join(',') ?? ''],
    ['field', params.p_fields?.join(',') ?? ''],
    ['category', params.p_categories?.join(',') ?? ''],
    ['deadline', search.deadline],
    ['renewable', search.renewable ? '1' : ''],
    ['freeApplication', search.freeApplication ? '1' : ''],
  ]

  return mapping
    .filter(([key]) => !exclude.includes(key as keyof ScholarshipSearch))
    .filter(([, value]) => value !== '')
    .map(([key, value]) => (
      <input key={key} type="hidden" name={key} value={value} />
    ))
}
