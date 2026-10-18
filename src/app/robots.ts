import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/env'

/**
 * `robots.txt`.
 *
 * Two jobs, and the split matters.
 *
 * CRAWL BUDGET is handled here. `/admin` and `/auth` are disallowed outright:
 * neither has search value, both sit behind an authentication guard, and
 * crawling them burns crawl budget on redirects to a login page. The `/admin`
 * route also sets `robots: noindex` in its own metadata, so the two layers agree.
 *
 * INDEXABILITY is deliberately NOT handled here, because it cannot be. A
 * `robots.txt` `Disallow` prevents a crawler from *fetching* a page, which stops
 * it from ever seeing that page's `noindex` meta tag — so disallowing something
 * that should be deindexed is the one reliably counterproductive thing you can
 * write. Every conditional case in this project (filtered search, paginated
 * results, thin taxonomy landings, `noindex` records) is therefore expressed as a
 * per-page `robots` meta tag, never as a rule in this file.
 *
 * The sitemap is advertised with an absolute URL, which is what lets a crawler
 * discover every page that has no inbound link worth following.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/auth',
          '/auth/',
          // Query-string filtering is handled by per-page meta tags, but these
          // prefixes also produce large numbers of near-duplicate URLs. Blocking
          // the crawl saves the budget without affecting indexability, because
          // every filtered page is already `noindex` at the meta level.
          '/scholarships?',
          '/articles?',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  }
}