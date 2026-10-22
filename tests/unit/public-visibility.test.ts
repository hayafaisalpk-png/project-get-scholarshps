import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Public reads must filter on status, not merely rely on Row Level Security.
 *
 * THE DEFECT THIS GUARDS AGAINST
 *
 * Every public reader in this codebase uses the SESSION client
 * (`createClient()` in `src/lib/supabase/server.ts`), because the CMS needs RLS
 * to constrain our own queries exactly as it constrains everyone else's. The
 * consequence is that a signed-in editor is `authenticated`, and the RLS
 * policies deliberately let `article.manage`, `article.review`,
 * `article.edit_own`, `settings.manage` and `seo.manage` holders read
 * UNPUBLISHED rows — that is what makes the CMS work.
 *
 * So an editor browsing the public site was seeing drafts and in-review
 * articles in the article listing, could open them by slug, and could put them
 * into the sitemap — which is a cached, publicly-fetchable route. RLS alone
 * cannot prevent this without breaking the CMS, so each public query carries an
 * explicit status filter as well.
 *
 * These assertions are on the generated query, not on a source file. They fail
 * if someone removes the filter, whatever they do to the comments explaining
 * why it is there.
 */

const { recorded, createFakeBuilder } = vi.hoisted(() => {
  type Recorded = {
    table: string
    filters: [string, unknown][]
    orderings: [string, unknown][]
  }

  const recorded: Recorded[] = []

  /**
   * A chainable PostgREST stand-in that records what it was asked to do.
   *
   * It resolves to an empty result set, which is enough for the assertions
   * below: they are about the FILTERS, not about the rows.
   */
  function createFakeBuilder(table: string) {
    const entry: Recorded = { table, filters: [], orderings: [] }
    recorded.push(entry)

    const builder: Record<string, unknown> = {}

    builder.select = () => builder
    builder.eq = (column: string, value: unknown) => {
      entry.filters.push([column, value])
      return builder
    }
    builder.neq = () => builder
    builder.ilike = () => builder
    builder.like = () => builder
    builder.in = () => builder
    builder.order = (column: string, options: unknown) => {
      entry.orderings.push([column, options])
      return builder
    }
    builder.range = () => builder
    builder.limit = () => builder
    builder.maybeSingle = () => builder
    builder.single = () => builder
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: [], error: null, count: 0 })

    return builder
  }

  return { recorded, createFakeBuilder }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => createFakeBuilder(table),
    rpc: async () => ({ data: [], error: null }),
    storage: {
      from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }),
    },
  }),
}))

import { getPublishedArticleBySlug, listPublishedArticles } from '@/features/articles/queries'
import { buildSitemapGroups } from '@/lib/seo'

function filtersFor(table: string): [string, unknown][] {
  const entry = recorded.find((row) => row.table === table)
  if (!entry) throw new Error(`no query was made against ${table}`)
  return entry.filters
}

beforeEach(() => {
  recorded.length = 0
})

describe('public article reads', () => {
  it('the article listing filters to published rows', async () => {
    await listPublishedArticles({})

    expect(filtersFor('articles')).toContainEqual(['status', 'published'])
  })

  it('the article detail page filters to published rows', async () => {
    await getPublishedArticleBySlug('some-article')

    const filters = filtersFor('articles')
    expect(filters).toContainEqual(['slug', 'some-article'])
    expect(filters).toContainEqual(['status', 'published'])
  })
})

describe('the sitemap', () => {
  it('lists only published articles', async () => {
    await buildSitemapGroups()

    expect(filtersFor('articles')).toContainEqual(['status', 'published'])
  })

  it('lists only published scholarships', async () => {
    await buildSitemapGroups()

    expect(filtersFor('scholarships')).toContainEqual(['status', 'published'])
  })

  it('lists only active content pages', async () => {
    await buildSitemapGroups()

    expect(filtersFor('content_pages')).toContainEqual(['status', 'active'])
  })
})
