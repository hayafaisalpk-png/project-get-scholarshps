import 'server-only'

import { cache } from 'react'

import { absoluteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Sitemap composition.
 *
 * Every URL is read from the database, so the sitemap cannot drift from the site:
 * a page that is unpublished, `noindex` or withdrawn simply is not listed.
 *
 * THE RULE THIS MODULE ENFORCES
 *
 * A sitemap must never list a URL that the page itself marks `noindex`. The two
 * are read by different consumers — a crawler fetches the page for its robots
 * meta, and fetches the sitemap for its URL list — so a contradiction is only
 * visible when you cross-check them, and search engines are entitled to treat the
 * contradiction as a signal to ignore both. Three separate rules follow from it:
 *
 *   - scholarships and articles are skipped when `noindex` is set;
 *   - articles are additionally skipped when `allow_sitemap` is false;
 *   - taxonomy landing pages are skipped when they are THIN, because
 *     `taxonomyMetadata` noindexes a zero-result page (see
 *     `src/features/scholarships/components/taxonomy-landing.tsx`);
 *   - static pages are skipped when `noindex` is set;
 *   - `/contact` is never listed. A page whose only purpose is to receive input
 *     has no search value, and listing it invites form spam.
 *
 * Filtered and paginated search permutations are never listed. Those pages carry
 * `noindex` in their own metadata, and a sitemap of near-duplicate filter
 * combinations is the classic way to get a site deindexed.
 *
 * The whole thing costs a FIXED number of queries — four for content plus one
 * aggregated call for taxonomy — because counting per term in the application
 * layer would issue hundreds of queries once `locations` grows.
 */

/** One entry in a sitemap. */
export type SitemapEntry = {
  path: string
  lastModified?: string | undefined
  changeFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority?: number
}

/**
 * Sitemap segments.
 *
 * The site is split by CONTENT TYPE rather than by an arbitrary block size.
 * Chunking every 50,000 URLs into numbered files would satisfy the protocol and
 * tell a crawler nothing; a separate `scholarships.xml` and `articles.xml` is
 * information a consumer can act on, and it is the split that stays useful as
 * the catalogue grows.
 *
 * The 50,000-URL cap is still enforced, inside each group, by `chunkEntries`.
 * A site can never exceed the cap per file, whichever way it grows.
 */
export const SITEMAP_GROUPS = [
  'pages',
  'scholarships',
  'articles',
  'taxonomy',
] as const

export type SitemapGroup = (typeof SITEMAP_GROUPS)[number]

/**
 * Protocol cap on URLs in a single sitemap file (50,000 / 50 MB).
 *
 * This is the documented maximum, not a tuning knob. It is exported so the
 * chunking logic and its tests share one number.
 */
export const SITEMAP_MAX_URLS = 50_000

/** How often each kind of page is expected to change. */
const FREQUENCY = {
  home: 'daily',
  listing: 'daily',
  detail: 'weekly',
  legal: 'yearly',
} as const

/**
 * Split a group into protocol-legal files.
 *
 * A group small enough to fit stays a single file named after the group, so
 * `/sitemaps/articles.xml` is the URL an editor can bookmark. Only when a group
 * exceeds the cap does it gain numbered parts (`articles-1`, `articles-2`), and
 * the first part is still named plainly so the common case never acquires a
 * number it does not need.
 */
export function chunkEntries(
  entries: SitemapEntry[],
  max = SITEMAP_MAX_URLS,
): SitemapEntry[][] {
  if (entries.length <= max) return entries.length > 0 ? [entries] : []
  const parts: SitemapEntry[][] = []
  for (let i = 0; i < entries.length; i += max) {
    parts.push(entries.slice(i, i + max))
  }
  return parts
}

/**
 * Build every sitemap entry, grouped by content type.
 *
 * This is the single source of truth for what is indexable. Both the sitemap
 * index and each segment file are derived from it, so the two can never disagree
 * about which records belong.
 */
export const buildSitemapGroups = cache(
  async (): Promise<Record<SitemapGroup, SitemapEntry[]>> => {
    const supabase = await createClient()

  /*
   * Four queries in parallel. RLS decides visibility for every one of them:
   *
   *   - `scholarships`   → published records only
   *   - `articles`       → `article_is_public()` only, so scheduled articles that
   *                        are not yet due cannot leak their URL before they exist
   *   - `content_pages`  → active rows only, so a withdrawn legal page disappears
   *   - taxonomy terms   → via `sitemap_taxonomy_terms()`, aggregated in SQL
   *
   * Only the columns the sitemap needs are selected; selecting whole rows would
   * ship article bodies and rich descriptions to a file meant to hold URLs.
   */
  const [scholarships, articles, pages, terms] = await Promise.all([
    supabase
      .from('scholarships')
      .select('slug, updated_at, noindex')
      .order('updated_at', { ascending: false }),
    supabase
      .from('articles')
      .select('slug, updated_at, noindex, allow_sitemap')
      .order('updated_at', { ascending: false }),
    supabase
      .from('content_pages')
      .select('slug, updated_at, noindex')
      .order('sort_order', { ascending: true }),
    supabase.rpc('sitemap_taxonomy_terms'),
  ])

  for (const [name, result] of [
    ['scholarships', scholarships],
    ['articles', articles],
    ['content_pages', pages],
    ['sitemap_taxonomy_terms', terms],
  ] as const) {
    if (result.error) {
      console.error(`[sitemap] ${name} query failed:`, result.error.message)
    }
  }

  const groups: Record<SitemapGroup, SitemapEntry[]> = {
    // The two entry points and the site root. They are the pages a crawler should
    // re-fetch most often, so they lead the index rather than trailing it.
    pages: [
      { path: '/', changeFrequency: FREQUENCY.home, priority: 1 },
      { path: '/scholarships', changeFrequency: FREQUENCY.listing, priority: 0.9 },
      { path: '/articles', changeFrequency: FREQUENCY.listing, priority: 0.7 },
    ],
    scholarships: [],
    articles: [],
    taxonomy: [],
  }

  for (const row of articles.data ?? []) {
    // `noindex` AND `allow_sitemap` is a combination the schema forbids, so the
    // first check is enough — but both are read because an editor can change
    // either one without the other, and the constraint only guards the pair.
    if (row.noindex || !row.allow_sitemap) continue
    groups.articles.push({
      path: `/articles/${row.slug}`,
      lastModified: row.updated_at,
      changeFrequency: FREQUENCY.detail,
      priority: 0.6,
    })
  }

  for (const row of scholarships.data ?? []) {
    if (row.noindex) continue
    groups.scholarships.push({
      path: `/scholarships/${row.slug}`,
      lastModified: row.updated_at,
      changeFrequency: FREQUENCY.detail,
      priority: 0.8,
    })
  }

  /*
   * Taxonomy landings. The function groups by slug across an inner join, so a
   * term with no visible scholarships returns no row at all. The explicit
   * `listings > 0` check is therefore redundant today and kept anyway: it is the
   * rule from `taxonomyMetadata` restated at the point of use, so a future change
   * to the function cannot silently start listing thin pages.
   */
  for (const row of terms.data ?? []) {
    const kind = String(row.kind)
    const slug = String(row.slug)
    const listings = Number(row.listings ?? 0)
    if (listings <= 0) continue

    groups.taxonomy.push({
      path: `/scholarships/${kind}/${slug}`,
      changeFrequency: FREQUENCY.listing,
      priority: 0.5,
    })
  }

  for (const row of pages.data ?? []) {
    if (row.noindex) continue
    groups.pages.push({
      path: `/${row.slug}`,
      lastModified: row.updated_at,
      changeFrequency: FREQUENCY.legal,
      priority: 0.3,
    })
  }

  return groups
})

/**
 * Every entry, flattened.
 *
 * Kept because it is the invariant worth asserting: the union of every segment
 * file must equal this list. If the index ever drops or duplicates a URL, the
 * difference shows up here rather than as a quietly incomplete crawl.
 */
export const buildSitemap = cache(async (): Promise<SitemapEntry[]> => {
  const groups = await buildSitemapGroups()
  return SITEMAP_GROUPS.flatMap((group) => groups[group])
})

/* -------------------------------------------------------------------------- */
/* Segments                                                                   */
/* -------------------------------------------------------------------------- */

/** One file listed in the sitemap index. */
export type SitemapSegment = {
  /** File name, without `.xml`, e.g. `scholarships` or `articles-2`. */
  name: string
  /** Public path of the segment file. */
  path: string
  /** Newest `lastmod` across the group, so a crawler can skip unchanged files. */
  lastModified?: string | undefined
  /** Number of URLs in this file. Used by tests, not rendered. */
  count: number
}

/**
 * Parse a requested segment name back into a group and chunk index.
 *
 * `/sitemaps/<name>.xml` is a public URL, so this is the one place an
 * attacker-influenced string becomes a lookup. Only names this module could
 * itself have produced are accepted: a known group, optionally with a positive
 * integer part suffix. Anything else is `null`, and the route 404s rather than
 * guessing.
 */
export function parseSegmentName(name: string): {
  group: SitemapGroup
  part: number
} | null {
  const match = /^([a-z]+)(?:-(\d+))?$/.exec(name)
  const group = match?.[1] as SitemapGroup | undefined
  if (!group || !SITEMAP_GROUPS.includes(group)) return null

  const part = match?.[2] ? Number.parseInt(match[2], 10) : 0
  if (!Number.isInteger(part) || part < 0) return null

  return { group, part }
}

/** Segment file name for a group and chunk index. */
export function segmentName(group: SitemapGroup, part: number): string {
  return part === 0 ? group : `${group}-${part}`
}

/**
 * Every segment file the index should advertise.
 *
 * An EMPTY group produces no segment and no entry in the index. That is the
 * correct behaviour: an empty sitemap file is not a thin page, it is a claim
 * that a collection exists and is empty, and a crawler gains nothing from it.
 * With no articles published there is simply no `articles.xml`.
 */
export function buildSitemapSegments(
  groups: Record<SitemapGroup, SitemapEntry[]>,
): SitemapSegment[] {
  const segments: SitemapSegment[] = []

  for (const group of SITEMAP_GROUPS) {
    const parts = chunkEntries(groups[group])
    parts.forEach((entries, index) => {
      const name = segmentName(group, index)
      segments.push({
        name,
        path: `/sitemaps/${name}.xml`,
        lastModified: newestTimestamp(entries),
        count: entries.length,
      })
    })
  }

  return segments
}

/** Entries for one requested segment, or `null` if it does not exist. */
export function getSitemapSegment(
  groups: Record<SitemapGroup, SitemapEntry[]>,
  name: string,
): SitemapEntry[] | null {
  const parsed = parseSegmentName(name)
  if (!parsed) return null

  const parts = chunkEntries(groups[parsed.group])
  const part = parts[parsed.part]
  return part ?? null
}

function newestTimestamp(entries: SitemapEntry[]): string | undefined {
  let newest: string | undefined
  for (const entry of entries) {
    if (!entry.lastModified) continue
    if (!newest || entry.lastModified > newest) newest = entry.lastModified
  }
  return newest
}

/* -------------------------------------------------------------------------- */
/* XML rendering                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Escape text for XML character data.
 *
 * Slugs are constrained by the database, but `lastmod` and any future free-text
 * value are not, and an unescaped `&` in a URL makes the whole document
 * malformed — which a crawler treats as "no sitemap at all" rather than
 * "partly wrong". The five predefined entities are the only ones XML defines.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Render a `<urlset>` document. */
export function renderUrlSet(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>`]
      if (entry.lastModified) {
        parts.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`)
      }
      if (entry.changeFrequency) {
        parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`)
      }
      if (entry.priority !== undefined) {
        parts.push(`    <priority>${entry.priority}</priority>`)
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (urls ? `${urls}\n` : '') +
    '</urlset>\n'
  )
}

/** Render a `<sitemapindex>` document. */
export function renderSitemapIndex(segments: SitemapSegment[]): string {
  const items = segments
    .map((segment) => {
      const lines = [`    <loc>${escapeXml(absoluteUrl(segment.path))}</loc>`]
      if (segment.lastModified) {
        lines.push(`    <lastmod>${escapeXml(segment.lastModified)}</lastmod>`)
      }
      return `  <sitemap>\n${lines.join('\n')}\n  </sitemap>`
    })
    .join('\n')

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (items ? `${items}\n` : '') +
    '</sitemapindex>\n'
  )
}

/** Entries as absolute URLs. Used by verification, not by the routes. */
export async function buildSitemapUrls(): Promise<
  { url: string; entry: SitemapEntry }[]
> {
  const entries = await buildSitemap()
  return entries.map((entry) => ({ url: absoluteUrl(entry.path), entry }))
}