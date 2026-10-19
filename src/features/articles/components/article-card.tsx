import Link from 'next/link'
import Image from 'next/image'

import type { ArticleCardData } from '@/features/articles/queries'
import { formatTimestamp, readingTime } from '@/lib/format'

/**
 * Article card.
 *
 * Same anatomy as `ScholarshipCard`: the heading holds the link, so the card is
 * one tab stop rather than three, and a stretched pseudo-element makes the whole
 * surface clickable without nesting interactive elements.
 *
 * The publication date is a real `<time>` with a machine-readable `dateTime`.
 * A card with no date would look fine but would be quietly wrong, so the date
 * line is omitted only when `publishedAt` is genuinely absent.
 */
export function ArticleCard({ article }: { article: ArticleCardData }) {
  const published = formatTimestamp(article.publishedAt)

  return (
    <article className="group relative flex h-full flex-col rounded-sm border border-ink-200 bg-white p-5 transition-shadow hover:shadow-md focus-within:shadow-md">
      {article.featuredImage ? (
        <div className="relative -mx-5 -mt-5 mb-5 aspect-[16/9] overflow-hidden rounded-t-sm bg-ink-100">
          <Image
            src={article.featuredImage.url}
            alt={article.featuredImage.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200">
          {readingTime(article.readingTimeMinutes)}
        </span>
      </div>

      <h3 className="text-base font-semibold leading-snug text-ink-900">
        <Link
          href={`/articles/${article.slug}`}
          className="after:absolute after:inset-0 hover:text-brand-800"
        >
          {article.title}
        </Link>
      </h3>

      {article.excerpt ? (
        <p className="mt-2 line-clamp-3 text-sm text-ink-600">
          {article.excerpt}
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        {published ? (
          <time
            dateTime={article.publishedAt}
            className="text-xs text-ink-500"
          >
            {published}
          </time>
        ) : null}
        {article.authorName ? (
          <p className="mt-0.5 text-xs text-ink-500">{article.authorName}</p>
        ) : null}
      </div>
    </article>
  )
}
