import {
  buildSitemapGroups,
  getSitemapSegment,
  renderUrlSet,
} from '@/lib/seo'

/**
 * `/sitemaps/<segment>.xml` — one segment of the sitemap index.
 *
 * A catch-all route because the segment name ends in `.xml`, which is a literal
 * suffix on a dynamic path rather than a separate route: `/sitemaps/articles.xml`
 * arrives here as the parameter `articles.xml`.
 *
 * The name is untrusted input. `getSitemapSegment` accepts only names this module
 * could itself have produced — a known group, optionally with a part number — and
 * anything else is a **404, not an empty sitemap**. A route that returned an empty
 * `<urlset>` for a typo'd name would be indistinguishable from a genuinely empty
 * collection, and a crawler would treat the second as "these URLs were all removed".
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ segment: string }> }

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { segment } = await params

  // The file suffix is part of the dynamic parameter, not a route extension.
  const name = segment.endsWith('.xml') ? segment.slice(0, -'.xml'.length) : segment

  const groups = await buildSitemapGroups()
  const entries = getSitemapSegment(groups, name)

  if (!entries) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(renderUrlSet(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}