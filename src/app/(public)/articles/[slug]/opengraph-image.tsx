import { getPublishedArticleBySlug } from '@/features/articles/queries'
import { formatTimestamp } from '@/lib/format'
import { OG_SIZE, renderOgCard } from '@/lib/og-image'

/**
 * Social card for an article.
 *
 * Reading time and publication date come from the record's own derived columns,
 * so the card cannot disagree with the page.
 *
 * As with the scholarship card, an unresolved slug yields a neutral card rather
 * than a 404, so requesting the image of an unpublished article leaks nothing
 * about whether it exists.
 */
export const alt = 'GetScholarship article'

export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await getPublishedArticleBySlug(slug)

  /*
   * A database failure is handled the same as "no such article": both produce the
   * neutral card. Letting an error throw here would return a 500 for an image,
   * which social crawlers treat as a hard failure and then cache.
   */
  if (!result.ok) {
    console.error('[og] article card lookup failed:', result.error.message)
  }

  const article = result.ok ? result.data : null

  if (!article) {
    return renderOgCard({
      eyebrow: 'Article',
      title: 'Article',
      subtitle: 'This article is not available.',
    })
  }

  const published = formatTimestamp(article.publishedAt)

  return renderOgCard({
    eyebrow: 'Guide',
    title: article.title,
    subtitle: article.excerpt ?? undefined,
    meta: [
      article.authorName ?? undefined,
      published || undefined,
      article.readingTimeMinutes > 0
        ? `${article.readingTimeMinutes} min read`
        : undefined,
    ]
      .filter((part): part is string => Boolean(part))
      .join('  ·  '),
  })
}