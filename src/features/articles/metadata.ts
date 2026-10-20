import type { Metadata } from 'next'

import { htmlToPlainText } from '@/lib/sanitize'

import type { PublicArticle } from './queries'

/**
 * Article description, title and social-card tag composition.
 *
 * Kept pure (no database access except the site name, which the caller
 * resolves) so the composition is unit-testable — the social tags are read by
 * foreign crawlers, so local tests should pin their shape.
 *
 * TWO NEXT.JS MERGE RULES THIS MODULE EXISTS FOR
 *
 * 1. A nested `openGraph` REPLACES the `openGraph` set in a parent segment
 *    wholesale (`generate-metadata.md` → Merging). The root layout defines
 *    `siteName` and `locale`; the article page must restate both here or
 *    `og:site_name` and `og:locale` silently vanish from every article page.
 *
 * 2. The file-convention `opengraph-image.tsx` is skipped for any segment
 *    whose metadata specifies `openGraph.images` (`mergeStaticMetadata`
 *    applies the file image only when `images` is unset). That is the switch
 *    between the two designed states of an article card:
 *
 *      - featured image set     → og:image / twitter:image point at the
 *                                 article's own uploaded image;
 *      - no featured image      → the keys are left out and the generated
 *                                 branded card applies, as it always has.
 *
 *    For the same reason the `twitter` key must be conditionally spread in —
 *    returning an explicitly `undefined` `twitter` would overwrite the root
 *    layout's `card: 'summary_large_image'` and X would lose its card.
 */

/* -------------------------------------------------------------------------- */
/* Description                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Foreign scrapers and search engines show roughly this much description; the
 * cap keeps `og:description` from becoming a wall of text under the card.
 */
const DERIVED_DESCRIPTION_MAX_LENGTH = 200

/**
 * Cut a plain-text description at a word boundary, marking the cut with a real
 * ellipsis. A hard `slice` could end mid-word, and an ellipsis-less cut reads
 * as though the sentence were never finished writing.
 */
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const slice = text.slice(0, maxLength)
  const lastSpace = slice.lastIndexOf(' ')

  return `${lastSpace > 0 ? slice.slice(0, lastSpace) : slice}…`
}

/**
 * The page description, in strict editor precedence.
 *
 *   1. `seo_description` — the editor's own SEO copy;
 *   2. `excerpt`         — the editor's standfirst;
 *   3. the first readable paragraph of the published body, derived from the
 *      article's own content with the same `htmlToPlainText` used for search
 *      and reading time.
 *
 * The derived step is NOT an invented description: it is a verbatim excerpt of
 * text the editor published. It only exists so a share always has something to
 * quote — an article with neither SEO copy, an excerpt, nor a body yields
 * `undefined` and follows the site-wide principle of omitting rather than
 * guessing.
 */
export function articleDescription(article: PublicArticle): string | undefined {
  const editorial = article.seoDescription ?? article.excerpt
  if (editorial) return editorial

  const plain = htmlToPlainText(article.content).replace(/\s+/g, ' ').trim()
  if (!plain) return undefined

  return truncateAtWord(plain, DERIVED_DESCRIPTION_MAX_LENGTH)
}

/** Display title for the page, its social card and structured data. */
export function articleTitle(article: PublicArticle): string {
  return article.seoTitle ?? article.title
}

/* -------------------------------------------------------------------------- */
/* The featured image as a social-card image                                   */
/* -------------------------------------------------------------------------- */

type SocialImage =
  | {
      url: string
      alt?: string | undefined
      width?: number | undefined
      height?: number | undefined
    }
  | null

/**
 * Build the og:image / twitter:image payload for the article's featured image.
 *
 * The URL is the image's own public storage URL — the exact value that already
 * renders on the page — so the shared preview and the article cannot disagree.
 * Dimensions and alt text are included only when the database actually holds
 * them; an image whose dimensions were never recorded says nothing rather than
 * guessing, and a decorative image (empty alt) omits the alt attribute instead
 * of emitting an empty claim.
 */
function socialImageFor(image: PublicArticle['featuredImage']): SocialImage {
  if (!image) return null

  const { width, height } = image
  // Const boolean so linked destructured values stay narrowed without a cast.
  const hasDimensions =
    width != null && height != null && width > 0 && height > 0

  return {
    url: image.url,
    ...(image.alt ? { alt: image.alt } : {}),
    ...(hasDimensions ? { width, height } : {}),
  }
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The Open Graph and Twitter tags for one article.
 *
 * `siteName` is resolved by the caller (the `general.site_name` setting) so
 * this function stays pure and unit-testable.
 *
 * When the article has no featured image the returned object carries neither
 * `openGraph.images` nor a `twitter` object: the file-convention generated
 * card and the root layout's `card: 'summary_large_image'` then apply exactly
 * as they did before featured images existed.
 */
export function articleMetaTags(
  article: PublicArticle,
  siteName: string,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const title = articleTitle(article)
  const description = articleDescription(article)
  const image = socialImageFor(article.featuredImage)

  const openGraph: Metadata['openGraph'] = {
    type: 'article',
    siteName,
    locale: 'en_US',
    title,
    // Mirrors `alternates.canonical` so og:url and the canonical link can never
    // state two different addresses for the same article.
    url: article.canonicalUrl ?? `/articles/${article.slug}`,
    description,
    ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
    ...(image ? { images: [image] } : {}),
  }

  return {
    openGraph,
    ...(image
      ? {
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
          },
        }
      : {}),
  }
}
