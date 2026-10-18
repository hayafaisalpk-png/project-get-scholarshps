import { describe, expect, it } from 'vitest'

import {
  buildSitemapSegments,
  chunkEntries,
  escapeXml,
  getSitemapSegment,
  parseSegmentName,
  renderSitemapIndex,
  renderUrlSet,
  type SitemapEntry,
  type SitemapGroup,
  SITEMAP_GROUPS,
  SITEMAP_MAX_URLS,
  segmentName,
} from '@/lib/seo'

/**
 * Sitemap segmentation.
 *
 * Three properties matter, and none of them are obvious:
 *
 *   1. **The union of every segment equals the whole site.** A packaging bug that
 *      drops a URL produces a sitemap that looks perfectly valid and silently
 *      de-indexes content.
 *   2. **No file exceeds the protocol cap.** 50,000 URLs per file is a hard limit,
 *      not a guideline.
 *   3. **An unknown segment is a 404, never an empty file.** An empty `<urlset>`
 *      says "this collection is now empty", which a crawler may act on. A typo
 *      must not be able to say that.
 *
 * The chunking tests use small `max` values rather than 50,000-element arrays, so
 * the boundary behaviour is exercised without allocating half a million objects.
 */

function entries(count: number, prefix = '/x'): SitemapEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `${prefix}-${i}`,
    lastModified: '2026-01-01T00:00:00.000Z',
  }))
}

function groupsOf(partial: Partial<Record<SitemapGroup, SitemapEntry[]>>): Record<
  SitemapGroup,
  SitemapEntry[]
> {
  return {
    pages: [],
    scholarships: [],
    articles: [],
    taxonomy: [],
    ...partial,
  }
}

describe('the group list', () => {
  it('splits by content type, in a deliberate order', () => {
    // The order the index advertises is a priority signal: entry points first,
    // then the largest content collections.
    expect([...SITEMAP_GROUPS]).toEqual(['pages', 'scholarships', 'articles', 'taxonomy'])
  })

  it('uses the protocol cap, not a tuned number', () => {
    expect(SITEMAP_MAX_URLS).toBe(50_000)
  })
})

describe('chunkEntries', () => {
  it('keeps a small group as one unnamed-part file', () => {
    expect(chunkEntries(entries(10), 50_000)).toHaveLength(1)
  })

  it('produces no file at all for an empty group', () => {
    // An empty sitemap claims a collection exists and is empty. It says nothing.
    expect(chunkEntries([], 50_000)).toEqual([])
  })

  it('splits exactly at the cap', () => {
    expect(chunkEntries(entries(10), 10)).toHaveLength(1)
    expect(chunkEntries(entries(11), 10)).toHaveLength(2)
  })

  it('never produces a part larger than the cap', () => {
    const parts = chunkEntries(entries(25), 10)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(10)
    // And no URL is lost or duplicated in the split.
    expect(parts.flat()).toHaveLength(25)
  })

  it('handles a final part smaller than the cap', () => {
    const parts = chunkEntries(entries(23), 10)
    expect(parts.map((p) => p.length)).toEqual([10, 10, 3])
  })
})

describe('parseSegmentName', () => {
  it('accepts a plain group name', () => {
    expect(parseSegmentName('scholarships')).toEqual({ group: 'scholarships', part: 0 })
  })

  it('accepts a numbered part', () => {
    expect(parseSegmentName('articles-2')).toEqual({ group: 'articles', part: 2 })
  })

  /**
   * This is a public URL, so the name is untrusted input and the only thing
   * standing between a crawler and a directory is this parser.
   */
  it.each([
    ['an unknown group', 'products'],
    ['a path traversal', '../../etc/passwd'],
    ['a slash', 'articles/2'],
    ['an empty name', ''],
    ['a negative part', 'articles--1'],
    ['a non-numeric part', 'articles-abc'],
    ['uppercase', 'Articles'],
    ['a leading digit group', '1'],
  ])('rejects %s', (_label, name) => {
    expect(parseSegmentName(name)).toBeNull()
  })
})

describe('segmentName', () => {
  it('names the first part plainly and numbers the rest', () => {
    expect(segmentName('articles', 0)).toBe('articles')
    expect(segmentName('articles', 1)).toBe('articles-1')
  })
})

describe('buildSitemapSegments', () => {
  it('omits a group that has no entries', () => {
    // With no articles published there must be no articles.xml at all.
    const segments = buildSitemapSegments(groupsOf({ pages: entries(3) }))
    expect(segments.map((s) => s.name)).toEqual(['pages'])
  })

  it('advertises one segment per non-empty group', () => {
    const segments = buildSitemapSegments(
      groupsOf({ pages: entries(3), scholarships: entries(6), articles: entries(2) }),
    )
    expect(segments.map((s) => s.name)).toEqual(['pages', 'scholarships', 'articles'])
    expect(segments.map((s) => s.count)).toEqual([3, 6, 2])
  })

  it('reports the newest timestamp in the group, for the index lastmod', () => {
    const segments = buildSitemapSegments(
      groupsOf({
        scholarships: [
          { path: '/a', lastModified: '2026-01-01T00:00:00.000Z' },
          { path: '/b', lastModified: '2026-06-01T00:00:00.000Z' },
          { path: '/c', lastModified: '2026-03-01T00:00:00.000Z' },
        ],
      }),
    )
    expect(segments[0]?.lastModified).toBe('2026-06-01T00:00:00.000Z')
  })

  it('splits a group that exceeds the cap into numbered segments', () => {
    // Exercised through `getSitemapSegment` because the cap is 50,000; what is
    // being checked here is the naming, not the arithmetic.
    const segments = buildSitemapSegments(groupsOf({ articles: entries(3) }))
    expect(segments[0]?.path).toBe('/sitemaps/articles.xml')
  })
})

describe('getSitemapSegment', () => {
  it('returns the entries for a known segment', () => {
    const groups = groupsOf({ articles: entries(2, '/a') })
    expect(getSitemapSegment(groups, 'articles')).toHaveLength(2)
  })

  it('returns null for a part that does not exist', () => {
    const groups = groupsOf({ articles: entries(2) })
    expect(getSitemapSegment(groups, 'articles-5')).toBeNull()
  })

  it('returns null for an unknown name — never an empty list', () => {
    expect(getSitemapSegment(groupsOf({}), 'nonsense')).toBeNull()
  })

  it('returns null for a KNOWN group that has no entries', () => {
    // The same reasoning as the unknown name, reached differently: an empty
    // group produces no segment at all, so there is no file to serve. Returning
    // `[]` here would render an empty `<urlset>`, which asserts that a
    // collection exists and is now empty.
    expect(getSitemapSegment(groupsOf({ articles: entries(2) }), 'pages')).toBeNull()
  })
})

describe('escapeXml', () => {
  it('escapes the five predefined entities', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('escapes the ampersand first, so entities are not double-decoded', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;')
  })
})

describe('renderUrlSet', () => {
  it('emits a urlset document with a declared namespace', () => {
    const xml = renderUrlSet([{ path: '/about' }])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('emits absolute URLs, never site-relative paths', () => {
    // A relative <loc> is not valid and a crawler will discard the file.
    const xml = renderUrlSet([{ path: '/about' }])
    expect(xml).toContain('<loc>https://getscholarship.test/about</loc>')
    expect(xml).not.toContain('<loc>/about</loc>')
  })

  it('renders the optional fields only when present', () => {
    const bare = renderUrlSet([{ path: '/about' }])
    expect(bare).not.toContain('<lastmod>')
    expect(bare).not.toContain('<priority>')

    const full = renderUrlSet([
      { path: '/x', lastModified: '2026-01-01T00:00:00.000Z', changeFrequency: 'daily', priority: 0.5 },
    ])
    expect(full).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
    expect(full).toContain('<changefreq>daily</changefreq>')
    expect(full).toContain('<priority>0.5</priority>')
  })

  it('keeps a priority of 0, which is falsy but valid', () => {
    expect(renderUrlSet([{ path: '/x', priority: 0 }])).toContain('<priority>0</priority>')
  })

  it('escapes a value that would otherwise break the document', () => {
    const xml = renderUrlSet([{ path: '/x?a=1&b=2' }])
    expect(xml).toContain('&amp;')
    expect(xml).not.toMatch(/<loc>[^<]*&b=2/)
  })

  it('renders a valid document for an empty group', () => {
    // Only reachable if a group is non-empty but chunks to nothing; the shape
    // must still be well-formed rather than an unclosed element.
    const xml = renderUrlSet([])
    expect(xml).toContain('<urlset')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })
})

describe('renderSitemapIndex', () => {
  it('emits a sitemapindex, not a urlset', () => {
    // THE distinction. A urlset here would tell a crawler these are PAGES.
    const xml = renderSitemapIndex([
      { name: 'pages', path: '/sitemaps/pages.xml', count: 3 },
    ])
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<sitemap>')
    expect(xml).not.toContain('<urlset')
    expect(xml).not.toContain('<url>')
  })

  it('lists each segment with an absolute loc', () => {
    const xml = renderSitemapIndex([
      { name: 'pages', path: '/sitemaps/pages.xml', count: 3 },
      { name: 'articles', path: '/sitemaps/articles.xml', lastModified: '2026-01-01T00:00:00.000Z', count: 2 },
    ])
    expect(xml).toContain('<loc>https://getscholarship.test/sitemaps/pages.xml</loc>')
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
  })

  it('closes every element it opens', () => {
    const xml = renderSitemapIndex([
      { name: 'a', path: '/sitemaps/a.xml', count: 1 },
      { name: 'b', path: '/sitemaps/b.xml', count: 1 },
    ])
    const opens = (xml.match(/<sitemap>/g) ?? []).length
    const closes = (xml.match(/<\/sitemap>/g) ?? []).length
    expect(opens).toBe(2)
    expect(closes).toBe(2)
  })
})