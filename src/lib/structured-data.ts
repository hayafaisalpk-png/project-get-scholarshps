import { BRAND_MARK } from '@/lib/brand'
import { absoluteUrl } from '@/lib/env'
import { type FAQItem, normalizeFaqItems } from '@/lib/validation/faq'

/**
 * Schema.org JSON-LD builders.
 *
 * Pure, framework-free and free of `server-only`, so every builder is unit
 * testable without a database or a render.
 *
 * THE RULE THAT SHAPES THIS FILE
 *
 * **Emit only what is true.** Structured data is a claim about a page, and a
 * claim that the page cannot support is worse than no claim at all: a
 * `BlogPosting` on a page that is not an article, or an `Organization` with a
 * logo URL that 404s, teaches a consumer that this site's markup cannot be
 * trusted. So every builder here omits a property rather than inventing it, and
 * several return `null` — which the renderer drops — when the page does not
 * actually have the thing being described.
 *
 * Two concrete consequences, both deliberate:
 *
 *   - **`Organization.logo` now exists.** It was deliberately absent while the
 *     project had no brand asset at all, because pointing at a logo that 404s is
 *     exactly the fabricated URL `AGENTS.md` §2.7 forbids. The operator-supplied
 *     master now exists and `src/lib/brand.ts` owns the derived, transparent PNG.
 *   - **Nothing page-level on a `noindex` page.** Structured data asks a
 *     consumer to treat a page as notable, while `noindex` asks it not to. Both
 *     at once is a contradiction, so `webPageLd()` returns `null` when the page
 *     is not indexable.
 *
 * Site-level entities (`Organization`, `WebSite`) are emitted once from the
 * public layout instead, because they describe the site rather than any page.
 *
 * ## Why an `@graph` and not a bare node
 *
 * A detail page describes several things that reference each other — the page,
 * its breadcrumb, the article, its author. Emitting them as separate scripts
 * repeats `@id` values and leaves the consumer to guess the links. One
 * `@graph` with stable `@id`s states the relationships explicitly, and a single
 * script tag is one less thing to get out of sync.
 */

/** A JSON-LD node. Deliberately loose: schema.org is extensible. */
export type JsonLdNode = Record<string, unknown>

/** A complete JSON-LD document, as embedded in a `<script>` tag. */
export type JsonLdDocument = {
  '@context': 'https://schema.org'
  '@graph': JsonLdNode[]
}

/** Stable identifiers, so nodes can reference each other across a graph. */
const id = (fragment: string): string => `${absoluteUrl('/')}#${fragment}`

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Serialise a document for embedding inside `<script type="application/ld+json">`.
 *
 * **The `<` escaping is a security control, not a formatting preference.**
 * Values here include editor-controlled text: article titles, scholarship
 * titles, author names, alt text. JSON.stringify does NOT escape `<`, so a
 * title containing the literal text `</script><script>fetch(...)` would terminate
 * this script element early and turn the remainder into live markup — an XSS
 * vector created by the very feature meant to describe the page.
 *
 * `\u003c` is the JSON escape for `<`, so the value survives `JSON.parse`
 * unchanged while never appearing literally in the document. `>` and `&` are
 * escaped too because a JSON-LD block is embedded in HTML, not JSON.
 */
export function serializeJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

/**
 * Compose a document from nodes, dropping anything falsy.
 *
 * Returning `null` is how a builder declines to describe something, so the
 * filter here is part of the contract rather than defensive tidying.
 */
export function graph(...nodes: (JsonLdNode | null | undefined)[]): JsonLdDocument | null {
  const kept = nodes.filter((node): node is JsonLdNode => Boolean(node))
  return kept.length > 0 ? { '@context': 'https://schema.org', '@graph': kept } : null
}

/** Drop `undefined` and empty-string properties. */
function compact<T extends JsonLdNode>(node: T): T {
  const out: JsonLdNode = {}
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out as T
}

/* -------------------------------------------------------------------------- */
/* Site level                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `Organization` and `WebSite`.
 *
 * Social profiles are included only when the corresponding setting is a real
 * URL — the seeded defaults are empty strings, and emitting `"sameAs": [""]`
 * would be a false link to the publisher's social presence.
 */
export function siteGraph({
  name,
  description,
  email,
  socialUrls = [],
}: {
  name: string
  description: string
  email?: string | undefined
  socialUrls?: (string | undefined | null)[] | undefined
}): JsonLdDocument | null {
  const siteUrl = absoluteUrl('/')
  const sameAs = socialUrls.filter(
    (url): url is string => typeof url === 'string' && /^https:\/\//.test(url),
  )

  const organization: JsonLdNode = compact({
    '@type': 'Organization',
    '@id': id('organization'),
    name,
    url: siteUrl,
    description,
    contactPoint: email
      ? {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email,
          url: absoluteUrl('/contact'),
        }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    /*
     * The logo.
     *
     * This was deliberately absent while the project had no brand asset — a logo
     * URL that 404s is a fabricated claim about the publisher, which is worse than
     * no claim. `logo-getscholarship.jpg` now exists and `src/lib/brand.ts` owns
     * the derived, transparent PNG, so the property is real and is emitted.
     */
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(BRAND_MARK.src),
      width: BRAND_MARK.width,
      height: BRAND_MARK.height,
      caption: name,
    },
    image: absoluteUrl(BRAND_MARK.src),
  })

  const website: JsonLdNode = compact({
    '@type': 'WebSite',
    '@id': id('website'),
    url: siteUrl,
    name,
    description,
    publisher: { '@id': id('organization') },
    inLanguage: 'en',
  })

  return graph(organization, website)
}

/* -------------------------------------------------------------------------- */
/* Page level                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `WebPage` for an indexable page.
 *
 * Returns `null` for a `noindex` page — see the contradiction note above. The
 * caller therefore cannot accidentally emit rich data for a page that has asked
 * not to be indexed.
 */
export function webPageLd({
  name,
  description,
  path,
  datePublished,
  dateModified,
  noindex = false,
}: {
  name: string
  description?: string | null | undefined
  path: string
  datePublished?: string | null | undefined
  dateModified?: string | null | undefined
  noindex?: boolean | undefined
}): JsonLdNode | null {
  if (noindex) return null

  return compact({
    '@type': 'WebPage',
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: { '@id': id('website') },
    about: { '@id': id('organization') },
    datePublished: datePublished ?? undefined,
    dateModified: dateModified ?? undefined,
    inLanguage: 'en',
  })
}

/**
 * `CollectionPage` for a taxonomy landing.
 *
 * A landing page is a collection, not merely a document: it enumerates the
 * scholarships filed under a term, and `CollectionPage` is the type that says so
 * (it is a subtype of `WebPage`). `docs/SEO_GUIDELINES.md` §5 specifies
 * `CollectionPage` + `ItemList` here, and this builder exists so the code can
 * follow the document rather than quietly approximate it.
 *
 * Declines for a `noindex` page, for the same reason `webPageLd` does.
 */
export function collectionPageLd({
  name,
  description,
  path,
  noindex = false,
}: {
  name: string
  description?: string | null | undefined
  path: string
  noindex?: boolean | undefined
}): JsonLdNode | null {
  if (noindex) return null

  return compact({
    '@type': 'CollectionPage',
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: { '@id': id('website') },
    about: { '@id': id('organization') },
    inLanguage: 'en',
  })
}

/* -------------------------------------------------------------------------- */
/* Breadcrumbs                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `BreadcrumbList`.
 *
 * Declines (`null`) for fewer than two crumbs: a breadcrumb trail of one is
 * just the current page, and Google treats a single-item trail as malformed
 * rather than as the trivial case it actually is.
 */
export function breadcrumbLd(
  trail: { name: string; path: string }[],
): JsonLdNode | null {
  if (trail.length < 2) return null

  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(trail[trail.length - 1]?.path ?? '/')}#breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `ItemList` for a listing page.
 *
 * Declines for an empty list. An `ItemList` with zero items is not a thin list,
 * it is a claim that the page enumerates something, which it does not — and an
 * empty `ItemList` is exactly the kind of markup that earns a manual action.
 */
export function itemListLd({
  name,
  path,
  items,
}: {
  name: string
  path: string
  items: { name: string; path: string }[]
}): JsonLdNode | null {
  if (items.length === 0) return null

  return {
    '@type': 'ItemList',
    '@id': `${absoluteUrl(path)}#itemlist`,
    name,
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* Articles                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `Person` for an article author.
 *
 * Declines without a name. `authors` can be present with no `full_name`, and a
 * `Person` node with an empty `name` is worse than no author markup.
 */
export function personLd({
  name,
  path,
}: {
  name: string | null | undefined
  path?: string | undefined
}): JsonLdNode | null {
  if (!name || name.trim().length === 0) return null

  return compact({
    '@type': 'Person',
    '@id': path ? `${absoluteUrl(path)}#author` : undefined,
    name,
    url: path ? absoluteUrl(path) : undefined,
  })
}

/**
 * `BlogPosting` for an article.
 *
 * `headline` is truncated to 110 characters because that is the documented
 * Google limit; a longer value is silently ignored by consumers, so truncating
 * here keeps the markup honest about what will actually be shown.
 */
export function articleLd({
  title,
  description,
  path,
  datePublished,
  dateModified,
  authorName,
  imageUrl,
  wordCount,
  noindex = false,
}: {
  title: string
  description?: string | null | undefined
  path: string
  datePublished?: string | null | undefined
  dateModified?: string | null | undefined
  authorName?: string | null | undefined
  imageUrl?: string | null | undefined
  wordCount?: number | null | undefined
  noindex?: boolean | undefined
}): JsonLdNode | null {
  // A noindex article must not be advertised as a published post.
  if (noindex) return null

  const hasAuthor = Boolean(authorName && authorName.trim().length > 0)

  return compact({
    '@type': 'BlogPosting',
    '@id': `${absoluteUrl(path)}#article`,
    // Points at the same article node the page renders, so a consumer can match
    // the markup to what is on screen.
    mainEntityOfPage: { '@id': `${absoluteUrl(path)}#webpage` },
    headline: title.slice(0, 110),
    description: description ?? undefined,
    url: absoluteUrl(path),
    datePublished: datePublished ?? undefined,
    dateModified: dateModified ?? undefined,
    author: hasAuthor ? { '@type': 'Person', name: authorName } : undefined,
    publisher: { '@id': id('organization') },
    image: imageUrl ?? undefined,
    wordCount: typeof wordCount === 'number' && wordCount > 0 ? wordCount : undefined,
    inLanguage: 'en',
  })
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `FAQPage` for the questions an article answers.
 *
 * The shape is the one Google documents for FAQ rich results: a `FAQPage`
 * node whose `mainEntity` is a list of `Question` nodes, each with an
 * `acceptedAnswer` of type `Answer` carrying the answer text.
 *
 * Three rules keep this honest rather than decorative:
 *
 *   1. **It declines when there is nothing to say.** An article with no FAQ
 *      emits no `FAQPage` node, because a `FAQPage` with an empty `mainEntity`
 *      claims the page answers questions when it answers none.
 *   2. **It declines on a `noindex` page**, for the same reason
 *      `webPageLd` and `articleLd` do: structured data asks a consumer to
 *      treat the page as notable, `noindex` asks it not to, and both at once
 *      is a contradiction.
 *   3. **The answer text is the visible answer text.** The same
 *      `FAQItem[]` array renders the accordion and produces this node, so
 *      the structured data cannot describe something the reader cannot see.
 *      Google requires the marked-up text to be present on the page.
 *
 * The items are run through `normalizeFaqItems` first, so a malformed entry
 * left in the database is dropped rather than emitted as an empty `Question`.
 */
export function faqLd({
  faqs,
  path,
  noindex = false,
}: {
  faqs: FAQItem[]
  path: string
  noindex?: boolean | undefined
}): JsonLdNode | null {
  // A noindex page must not advertise answers it has asked not to be indexed.
  if (noindex) return null

  const items = normalizeFaqItems(faqs)
  if (items.length === 0) return null

  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(path)}#faq`,
    url: absoluteUrl(path),
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}