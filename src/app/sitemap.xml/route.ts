import { buildSitemapGroups, buildSitemapSegments, renderSitemapIndex } from '@/lib/seo'

/**
 * `/sitemap.xml` — the sitemap INDEX.
 *
 * A Route Handler rather than the `sitemap.(xml|ts)` file convention, because the
 * convention can only emit a `<urlset>`. An index is a `<sitemapindex>` whose
 * children are sitemap files, and Next's metadata route has no way to produce
 * that root element — `generateSitemaps` splits into more `<urlset>` files, which
 * is a different thing and would leave `/sitemap.xml` claiming to be a page list.
 *
 * The split is by content type (`pages`, `scholarships`, `articles`, `taxonomy`),
 * not by an arbitrary block size: a numbered `sitemap-3.xml` satisfies the
 * protocol and tells a crawler nothing, whereas a separate `articles.xml` is
 * information it can act on.
 *
 * The rules about WHAT is listed live in `buildSitemapGroups()` and are unchanged
 * from Phase 3: an unpublished, `noindex`, thin or withdrawn record is absent, and
 * filtered search permutations never appear. This file only decides how the list
 * is packaged.
 *
 * `force-dynamic` for the same reason as before: a sitemap cached from build time
 * would happily advertise an article unpublished an hour ago.
 */

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const groups = await buildSitemapGroups()
  const segments = buildSitemapSegments(groups)

  return new Response(renderSitemapIndex(segments), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}