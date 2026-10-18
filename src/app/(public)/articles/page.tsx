import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, Section } from '@/components/layout/container'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { JsonLd } from '@/components/structured-data'
import { ArticleCard } from '@/features/articles/components/article-card'
import {
  ARTICLE_PAGE_SIZE,
  getArticleCategories,
  listPublishedArticles,
} from '@/features/articles/queries'
import { graph, itemListLd, webPageLd } from '@/lib/structured-data'
import { cn } from '@/lib/utils/cn'

/**
 * Article index.
 *
 * Filters are a plain GET form over the same URL, so a category can be shared,
 * bookmarked and reached with JavaScript disabled, and the browser back button
 * behaves. Nothing is filtered in the browser: the query runs in PostgreSQL and
 * only one page of results is sent.
 *
 * DELIBERATELY NO `loading.tsx` IN THIS SEGMENT — same reason as
 * `src/app/(public)/scholarships/page.tsx`: a segment-level loading file opens a
 * Suspense boundary above `notFound()`, which produces soft 404s.
 */

export const dynamic = 'force-dynamic'

type RawSearchParams = {
  category?: string | undefined
  page?: string | undefined
  q?: string | undefined
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}): Promise<Metadata> {
  const raw = await searchParams
  const category = raw.category?.trim() || undefined
  const q = raw.q?.trim() || undefined
  const filtered = Boolean(category || q)
  const page = parsePage(raw.page)

  /*
   * Pagination is self-canonical; filters are not.
   *
   * A filtered view is a SUBSET of the same list and correctly points at the
   * clean index. Page 2 is a DIFFERENT set of records, and canonicalising it to
   * page 1 tells a crawler that everything after the first page is a duplicate —
   * which is precisely how a paginated index loses pages 2 onwards. The sweep
   * found every page 2+ doing exactly that.
   */
  const canonical =
    filtered || page === 1
      ? '/articles'
      : articlesPath({ category, q, page })

  return {
    title: 'Articles and guides',
    description:
      'Guides on scholarship applications, financial aid, essays and study choices.',
    alternates: { canonical },
    // Filter permutations are useful to a reader but must not flood the index
    // with near-duplicate pages; the unfiltered index is the one that should rank.
    robots: filtered
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

/** Clamp a `?page=` value to a positive integer. */
function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

/** Build a listing URL, dropping empty parameters. */
function articlesPath(params: {
  category?: string | undefined
  q?: string | undefined
  page?: number | undefined
}): string {
  const search = new URLSearchParams()
  if (params.category) search.set('category', params.category)
  if (params.q) search.set('q', params.q)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const query = search.toString()
  return query ? `/articles?${query}` : '/articles'
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const raw = await searchParams
  const category = raw.category?.trim() || undefined
  const q = raw.q?.trim() || undefined
  const requestedPage = parsePage(raw.page)

  const [categories, result] = await Promise.all([
    getArticleCategories(),
    listPublishedArticles({ page: requestedPage, category, q }),
  ])

  if (!result.ok) {
    return (
      <Section>
        <Container>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Articles and guides
          </h1>
          <Alert tone="error" className="mt-8">
            We could not load articles right now. Please try again in a moment.
          </Alert>
        </Container>
      </Section>
    )
  }

  const { items, total, page, totalPages } = result.data
  const activeCategory = categories.find((c) => c.slug === category) ?? null

  /*
   * `ItemList` only on the canonical, unfiltered index.
   *
   * Filter permutations and page 2+ are `noindex` (see `generateMetadata`), and
   * `webPageLd` refuses to describe a page that asked not to be indexed. A list
   * of search results for "engineering" is not the site's article index, and
   * claiming it is would be a rich-result claim about a page that is excluded.
   */
  const isCanonicalIndex = !category && !q && page === 1

  const structuredData = isCanonicalIndex
    ? graph(
        webPageLd({
          name: 'Articles and guides',
          description:
            'Guides on scholarship applications, financial aid, essays and study choices.',
          path: '/articles',
        }),
        itemListLd({
          name: 'Articles and guides',
          path: '/articles',
          items: items.map((item) => ({
            name: item.title,
            path: `/articles/${item.slug}`,
          })),
        }),
      )
    : null

  return (
    <Section>
      <Container>
        <JsonLd data={structuredData} />
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Articles and guides
          </h1>
          <p className="mt-2 text-ink-600">
            {total > 0
              ? `${total.toLocaleString('en-US')} ${total === 1 ? 'article' : 'articles'}`
              : 'Guidance on applications, financial aid and essays'}
          </p>
        </header>

        {/*
          A GET form rather than a set of links, so the keyword box and the
          category control submit together instead of fighting each other.
        */}
        <form
          action="/articles"
          method="get"
          className="mb-8 flex flex-col gap-4 border-b border-ink-200 pb-6 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="q"
              className="block text-sm font-medium text-ink-800"
            >
              Search articles
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q ?? ''}
              placeholder="Search by keyword"
              className="mt-1.5 block w-full rounded-sm border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
          </div>

          {categories.length > 0 ? (
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-ink-800"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={category ?? ''}
                className="mt-1.5 block h-[42px] rounded-sm border border-ink-300 bg-white px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-[42px] items-center justify-center rounded-md bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Search
          </button>
        </form>

        {/*
          Category links are rendered alongside the select so the filter is
          reachable as plain links — crawlable, and usable with the form
          controls ignored entirely.
        */}
        {categories.length > 0 ? (
          <nav aria-label="Article categories" className="mb-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <CategoryChip href="/articles" active={!category}>
                  All
                </CategoryChip>
              </li>
              {categories.map((item) => (
                <li key={item.slug}>
                  <CategoryChip
                    href={articlesPath({ category: item.slug })}
                    active={category === item.slug}
                  >
                    {item.name}
                  </CategoryChip>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {/*
          `aria-live` because the result count changes in response to the
          filters; a screen-reader user needs it announced, not merely re-rendered.
        */}
        <p className="mb-6 text-sm text-ink-600" aria-live="polite">
          {total > 0
            ? `Showing ${(page - 1) * ARTICLE_PAGE_SIZE + 1}–${Math.min(page * ARTICLE_PAGE_SIZE, total)} of ${total}`
            : 'No articles match'}
        </p>

        {items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(target) =>
                articlesPath({ category, q, page: target })
              }
            />
          </>
        ) : (
          <EmptyState
            title={
              activeCategory
                ? `No articles in ${activeCategory.name} yet`
                : q
                  ? `No articles found for "${q}"`
                  : 'No articles have been published yet'
            }
            description={
              activeCategory || q
                ? 'Try a different category or keyword.'
                : 'Guides on applications, financial aid and essays will appear here once they are published.'
            }
          />
        )}
      </Container>
    </Section>
  )
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
      )}
    >
      {children}
    </Link>
  )
}