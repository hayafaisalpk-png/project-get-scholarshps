import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, Section, SectionHeading } from '@/components/layout/container'
import { Button, ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { JsonLd } from '@/components/structured-data'
import { ScholarshipRow } from '@/features/scholarships/components/scholarship-row'
import { AutoSubmitForm } from '@/features/scholarships/components/auto-submit-form'
import { ArticleCard } from '@/features/articles/components/article-card'
import { listPublishedArticles } from '@/features/articles/queries'
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
import { graph, itemListLd, webPageLd } from '@/lib/structured-data'

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

  /*
   * A SORTED view is a duplicate of the same list in a different order, and the
   * indexability sweep found it serving `index, follow` while
   * `docs/SEO_GUIDELINES.md` says sorted search is `noindex, follow`. Four sort
   * orders means four near-identical pages competing with each other and with
   * `/scholarships`, which is the page that should rank.
   *
   * `relevance` and `newest` are the default presentation for an unfiltered
   * page, so neither counts as a re-order — `parseScholarshipSearch` already
   * normalises a relevance sort with no query to `newest`, so the comparison
   * below is against what the visitor actually sees.
   */
  const sortedUnusually =
    search.sort !== 'relevance' &&
    search.sort !== 'newest'

  const indexable = !filtered && !sortedUnusually

  const canonical =
    filtered || sortedUnusually ? '/scholarships' : scholarshipSearchPath(search)

  return {
    title: filtered
      ? `${resultSummary(search)} | Scholarships`
      : sortedUnusually
        ? 'Scholarships (sorted)'
        : 'Scholarships',
    description: filtered
      ? 'Filtered scholarship results.'
      : 'Search scholarships by keyword, education level, field of study, location, award amount and deadline.',
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
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

  const [levels, fields, categories, articleResult] = await Promise.all([
    getEducationLevels(),
    getAcademicFields(),
    getScholarshipCategories(),
    listPublishedArticles({ page: 1 }),
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

  const articles = articleResult.ok ? articleResult.data.items.slice(0, 6) : []

  /*
   * `ItemList` only on the canonical, unfiltered, unsorted first page.
   *
   * Every filter permutation, every unusual sort order and page 2+ is
   * `noindex, follow` (see `generateMetadata`), and `webPageLd` refuses to
   * describe a page that asked not to be indexed. "The 12 engineering
   * scholarships we found" is not the site's scholarship index, and describing
   * it as one would be a rich-result claim about a page that is deliberately
   * excluded from the index.
   *
   * The condition is derived from the same values as the robots directive
   * above, deliberately: structured data that disagrees with the page's own
   * robots meta is the exact contradiction the sitemap rules exist to avoid.
   */
  const isCanonicalIndex =
    !filtered &&
    page === 1 &&
    search.sort !== 'relevance' &&
    search.sort !== 'newest'

  const structuredData = isCanonicalIndex
    ? graph(
        webPageLd({
          name: 'Find scholarships',
          description:
            'Search scholarships by keyword, education level, field of study, location, award amount and deadline.',
          path: '/scholarships',
        }),
        itemListLd({
          name: 'Scholarships',
          path: '/scholarships',
          items: items.map((item) => ({
            name: item.title,
            path: `/scholarships/${item.slug}`,
          })),
        }),
      )
    : null

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
    <>
    <Section>
      <Container>
        <JsonLd data={structuredData} />

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

            {/*
              `AutoSubmitForm` is still a plain GET form to this route. With
              JavaScript it submits the instant a control changes; without it,
              the `<noscript>` button below is the way to apply. Filtering never
              happens in the browser — the results are a server round trip and the
              URL is the state.
            */}
            <AutoSubmitForm
              action="/scholarships"
              className="space-y-6"
            >
              {/* Preserve the search term and sort when filters change. */}
              {search.q ? <input type="hidden" name="q" value={search.q} /> : null}
              <input type="hidden" name="sort" value={search.sort} />

              <FilterGroup title="Education level" itemCount={levels.length}>
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

              <FilterGroup title="Field of study" itemCount={fields.length}>
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

              <FilterGroup title="Type" itemCount={categories.length}>
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

              <FilterGroup title="Deadline" itemCount={DEADLINE_OPTIONS.length}>
                <div className="space-y-2">
                  {DEADLINE_OPTIONS.map((option) => (
                    // `min-h-7` for the same WCAG 2.5.8 reason as CheckboxFilter:
                    // the wrapping label is the effective target, not the 16px
                    // radio.
                    <label
                      key={option}
                      className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm text-ink-700"
                    >
                      <input
                        type="radio"
                        name="deadline"
                        value={option}
                        defaultChecked={search.deadline === option}
                        className="h-4 w-4 shrink-0 border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                      />
                      {DEADLINE_LABELS[option]}
                    </label>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title="Other" itemCount={2}>
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
                {/*
                  Only needed without JavaScript, where nothing auto-submits.
                  Same pattern as the sort control below. With JavaScript the
                  button is redundant, and a button that is redundant is noise
                  next to the controls it duplicates.
                */}
                <noscript>
                  <Button type="submit" size="sm">
                    Apply filters
                  </Button>
                </noscript>
                {filtered ? (
                  <Link
                    href="/scholarships"
                    className="inline-flex h-9 items-center rounded-sm px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                  >
                    Clear all
                  </Link>
                ) : null}
              </div>
            </AutoSubmitForm>
          </aside>

          <div>
            <div className="mb-6 flex flex-col gap-4 border-b border-ink-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-600" aria-live="polite">
                {total > 0
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
                  : 'No results'}
              </p>

              {/*
                  Same progressive enhancement as the filter form: with
                  JavaScript the select submits itself, and `<noscript>` keeps a
                  button for everyone else.
                */}
              <AutoSubmitForm
                action="/scholarships"
                className="flex items-center gap-2"
              >
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
              </AutoSubmitForm>
            </div>

            {items.length > 0 ? (
              <>
                {/* Reference listing anatomy: stacked horizontal row cards,
                    not a grid of tiles. The action column is 224px and the
                    metadata grid is four-up inside each row. */}
                <div className="space-y-4">
                  {items.map((scholarship) => (
                    <ScholarshipRow
                      key={scholarship.id}
                      scholarship={scholarship}
                      metaColumns={2}
                    />
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

    {/* ------------------------------------------------------ Feature articles */}
    {articles.length > 0 ? (
      <Section className="bg-ink-50">
        <Container>
          <SectionHeading
            title="Read Articles"
            description="Practical guidance for finding and applying for scholarships."
            action={
              <Link
                href="/articles"
                className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4"
              >
                View all
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </Container>
      </Section>
    ) : null}
  </>
  )
}

/**
 * Filter option row height in `rem`.
 *
 * Each row is `min-h-7` (1.75rem, required for WCAG 2.5.8 target size) plus the
 * `space-y-2` gap (0.5rem) = 2.25rem.
 *
 * This MUST be kept in step with the row markup. It was 1.75rem when rows were an
 * unconstrained `text-sm` line box; leaving it there after the target-size fix
 * would under-size the container and reintroduce the internal scrollbar that the
 * adaptive sizing was added to remove.
 */
const FILTER_ROW_REM = 2.25

/**
 * Hard cap on a filter list's height, in `rem`. Longer taxonomies (fields of
 * study grows into the dozens) scroll instead of pushing the results column
 * off the first screen.
 */
const FILTER_MAX_REM = 24

function FilterGroup({
  title,
  itemCount,
  children,
}: {
  title: string
  /** Number of options rendered, so the box fits its own content. */
  itemCount: number
  children: React.ReactNode
}) {
  // Show the whole list when it fits within the cap; only scroll when it cannot.
  // The +1 row of slack absorbs a label that wraps onto a second line.
  const maxRem = Math.min((itemCount + 1) * FILTER_ROW_REM, FILTER_MAX_REM)
  const scrolls = maxRem < itemCount * FILTER_ROW_REM

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-ink-900">{title}</legend>
      <div
        style={{ maxHeight: `${maxRem}rem` }}
        className={`no-scrollbar space-y-2 overflow-y-auto pr-1 ${
          // The scrollbar is hidden, so the clipped edge fades out to signal
          // there is more below. Keyboard users still reach every option: moving
          // focus to an off-screen checkbox scrolls it into view.
          scrolls
            ? '[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.25rem),transparent)]'
            : ''
        }`}
      >
        {children}
      </div>
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
    /*
     * `min-h-7` is a WCAG requirement, not styling.
     *
     * The `<input>` is 16x16, but because the label wraps it, the LABEL is the
     * effective target — so 2.5.8 Target Size (Minimum) is judged on the label.
     * Measured at `text-sm` with no height constraint it was 354x20, which fails
     * the 24px minimum on height. `min-h-7` (28px) clears it with room to spare,
     * which also makes the row comfortable to tap on a phone.
     */
    <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm text-ink-700">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
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
