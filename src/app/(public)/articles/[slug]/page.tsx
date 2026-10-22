import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { Container, Prose, Section } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'
import { JsonLd } from '@/components/structured-data'
import {
  articleDescription,
  articleMetaTags,
  articleTitle,
} from '@/features/articles/metadata'
import { FAQSection } from '@/features/articles/components/faq-section'
import { getPublishedArticleBySlug } from '@/features/articles/queries'
import { formatTimestamp, readingTime } from '@/lib/format'
import { getString } from '@/lib/settings'
import {
  articleLd,
  breadcrumbLd,
  faqLd,
  graph,
  personLd,
  webPageLd,
} from '@/lib/structured-data'

/**
 * Public article detail page.
 *
 * `getPublishedArticleBySlug` returns `null` for a slug that does not exist AND
 * for one that exists but is not published, so a draft, a scheduled article and
 * a made-up slug are indistinguishable from outside. All three 404.
 *
 * DELIBERATELY NO `loading.tsx` IN THIS SEGMENT — a segment-level loading file
 * opens a Suspense boundary above `notFound()`, so the shell is flushed with
 * 200 and the 404 becomes a soft 404. See the note in
 * `src/app/(public)/scholarships/page.tsx`.
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const result = await getPublishedArticleBySlug(slug)

  if (!result.ok || !result.data) notFound()

  const article = result.data
  const siteName = await getString('general.site_name', 'GetScholarship')

  return {
    title: articleTitle(article),
    description: articleDescription(article),
    alternates: {
      canonical: article.canonicalUrl ?? `/articles/${article.slug}`,
    },
    robots: article.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    /*
     * `articleMetaTags` composes `openGraph` and — when the article has a
     * featured image — `twitter`. With no featured image neither key is
     * present, so the `opengraph-image.tsx` generated card applies as before.
     */
    ...articleMetaTags(article, siteName),
  }
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params
  const result = await getPublishedArticleBySlug(slug)

  if (!result.ok || !result.data) notFound()

  const article = result.data
  const published = formatTimestamp(article.publishedAt)

  const detailPath = `/articles/${article.slug}`
  // Same precedence as `og:description` (see `articleMetaTags`), so the share
  // card and the JSON-LD below can never quote two different descriptions.
  const description = articleDescription(article)

  /*
   * Page-level structured data. `articleLd` and `webPageLd` both decline when the
   * article is `noindex`, and `personLd` declines when there is no author name
   * — an article can genuinely have no byline, and a `Person` node with an empty
   * name is a false claim rather than a thin one.
   *
   * `faqLd` describes the questions the article answers. It is built from the
   * same `article.faqs` array that the visible accordion renders below, so the
   * marked-up text and the text on the page are the same text — which is what
   * Google requires. It declines when the article has no FAQ, and when the
   * article is `noindex`.
   */
  const structuredData = graph(
    webPageLd({
      name: article.seoTitle ?? article.title,
      description,
      path: detailPath,
      datePublished: article.publishedAt,
      noindex: article.noindex,
    }),
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Articles', path: '/articles' },
      { name: article.title, path: detailPath },
    ]),
    articleLd({
      title: article.title,
      description,
      path: detailPath,
      datePublished: article.publishedAt,
      authorName: article.authorName,
      wordCount: article.wordCount,
      noindex: article.noindex,
    }),
    personLd({ name: article.authorName, path: detailPath }),
    faqLd({
      faqs: article.faqs,
      path: detailPath,
      noindex: article.noindex,
    }),
  )

  return (
    <Section>
      <Container>
        <JsonLd data={structuredData} />
        {/*
          The measure is capped for the body while the header is allowed to use
          the full column, which is how the reference sets editorial pages: a
          narrow readable column under a wide title block.
        */}
        <article className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-ink-600">
              <li>
                <Link
                  href="/articles"
                  className="hover:text-brand-700 hover:underline"
                >
                  Articles
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="truncate text-ink-500">{article.title}</li>
            </ol>
          </nav>

          <header className="border-b border-ink-200 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              {article.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
              {article.authorName ? (
                <span className="font-medium text-ink-800">
                  {article.authorName}
                </span>
              ) : null}
              {published ? (
                <time dateTime={article.publishedAt}>{published}</time>
              ) : null}
              <span>{readingTime(article.readingTimeMinutes)}</span>
            </div>

            {article.excerpt ? (
              <p className="mt-4 text-lg text-ink-600">{article.excerpt}</p>
            ) : null}

            {article.featuredImage ? (
              <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-sm bg-ink-100">
                <Image
                  src={article.featuredImage.url}
                  alt={article.featuredImage.alt}
                  fill
                  priority
                  sizes="(min-width: 768px) 768px, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </header>

          {/*
            Sanitised by the query layer against the same allowlist as every
            other rich-text surface, so this is the editor's own markup and
            nothing else.
          */}
          <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: article.content }} />

          {/*
            The visible half of the FAQ markup. `faqLd` above describes exactly
            these questions and answers, so the structured data is backed by
            text the reader can actually see.
          */}
          <FAQSection faqs={article.faqs} />

          {article.categories.length > 0 || article.tags.length > 0 ? (
            <footer className="mt-10 border-t border-ink-200 pt-6">
              <h2 className="text-sm font-semibold text-ink-900">Filed under</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {[...article.categories, ...article.tags].map((term) => (
                  <li key={`${term.slug}-${term.name}`}>
                    <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-ink-200">
                      {term.name}
                    </span>
                  </li>
                ))}
              </ul>
            </footer>
          ) : null}
        </article>

        <div className="mx-auto mt-12 max-w-3xl border-t border-ink-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ButtonLink href="/articles" variant="outline">
              All articles
            </ButtonLink>
            <Link
              href={`/contact?type=report&kind=article&slug=${encodeURIComponent(article.slug)}`}
              className="text-sm text-ink-600 underline underline-offset-4 hover:text-brand-700"
            >
              Report incorrect information
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  )
}
