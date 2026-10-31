import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Container, Prose, Section } from '@/components/layout/container'
import {
  type ContentPageSlug,
  getContentPage,
} from '@/lib/content-pages'
import { formatTimestamp } from '@/lib/format'

/**
 * Shared renderer for the five static pages.
 *
 * One component rather than five, so heading order, prose styling, the
 * last-updated line and the metadata rules are identical on every one of them.
 * Accessibility and SEO both depend on that consistency: the `<h1>` is always
 * the page title and the body headings always start at `<h2>`.
 */

/**
 * Metadata for a static page.
 *
 * `noindex` on the page row wins over the site default, and the canonical is
 * the page's own URL unless an editor has overridden it.
 */
export async function contentPageMetadata(
  slug: ContentPageSlug,
): Promise<Metadata> {
  const result = await getContentPage(slug)

  // A missing page is a 404, not a soft failure. `notFound()` inside
  // generateMetadata renders the not-found boundary and returns a real 404
  // status, which is what the SEO rules require.
  if (!result.ok || !result.data) notFound()

  const page = result.data

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? page.excerpt ?? undefined,
    alternates: { canonical: page.canonicalUrl ?? `/${page.slug}` },
    robots: page.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    other: {
      bingbot: page.noindex
        ? 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    },
  }
}

export async function ContentPage({ slug }: { slug: ContentPageSlug }) {
  const result = await getContentPage(slug)

  if (!result.ok || !result.data) notFound()

  const page = result.data
  const updated = formatTimestamp(page.updatedAt)

  return (
    <Section>
      <Container>
        {/*
          `max-w-3xl` is a measure choice, not decoration: the editorial body is
          set at a comfortable line length. A wider column would force long line
          lengths and measurably worse readability.
        */}
        <article className="max-w-3xl">
          <header className="border-b border-ink-200 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              {page.title}
            </h1>
            {page.excerpt ? (
              <p className="mt-3 text-lg text-ink-600">{page.excerpt}</p>
            ) : null}
            {updated ? (
              <p className="mt-4 text-sm text-ink-500">
                Last updated{' '}
                <time dateTime={page.updatedAt}>{updated}</time>
              </p>
            ) : null}
          </header>

          {/*
            Sanitised by `getContentPage` against the same allowlist as article
            bodies, so the markup reaching here is limited to the editor's tag
            set. `dangerouslySetInnerHTML` is therefore the correct call, and the
            alternative — re-deriving structure from HTML in JSX — would discard
            exactly the semantics the editor authored.
          */}
          <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: page.body }} />
        </article>
      </Container>
    </Section>
  )
}