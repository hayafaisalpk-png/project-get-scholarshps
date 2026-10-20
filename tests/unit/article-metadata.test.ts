import { describe, expect, it } from 'vitest'

import {
  articleDescription,
  articleMetaTags,
  articleTitle,
} from '@/features/articles/metadata'
import type { PublicArticle } from '@/features/articles/queries'

/**
 * Social-card and description composition for article pages.
 *
 * These tags are consumed by foreign crawlers (Facebook, WhatsApp/X/LinkedIn),
 * so their shape is pinned here rather than trusted to integration. The
 * composition is deliberately a pure function so no database is needed.
 */

function articleFixture(overrides: Partial<PublicArticle> = {}): PublicArticle {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'test-article',
    title: 'Test Article',
    excerpt: null,
    content: '',
    publishedAt: '',
    readingTimeMinutes: 5,
    wordCount: 100,
    authorName: null,
    authorTitle: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    noindex: false,
    categories: [],
    tags: [],
    featuredImage: null,
    ...overrides,
  }
}

describe('articleTitle', () => {
  it('prefers the editor SEO title', () => {
    const article = articleFixture({
      seoTitle: 'SEO Title',
      title: 'Plain Title',
    })
    expect(articleTitle(article)).toEqual('SEO Title')
  })

  it('falls back to the plain title', () => {
    const article = articleFixture({ title: 'Plain Title' })
    expect(articleTitle(article)).toEqual('Plain Title')
  })
})

describe('articleDescription', () => {
  it('uses the SEO description first', () => {
    const article = articleFixture({
      seoDescription: 'The SEO copy.',
      excerpt: 'The standfirst.',
      content: '<p>Publishable body text that is long enough.</p>',
    })
    expect(articleDescription(article)).toEqual('The SEO copy.')
  })

  it('uses the excerpt when there is no SEO description', () => {
    const article = articleFixture({
      excerpt: 'The standfirst.',
      content: '<p>Publishable body text that is long enough.</p>',
    })
    expect(articleDescription(article)).toEqual('The standfirst.')
  })

  it('derives one from the published body as the last resort', () => {
    const article = articleFixture({
      content:
        '<p>Federal grants do not have to be repaid, which makes them the cheapest money a student can get.</p><p>A second paragraph follows the first one.</p>',
    })
    const description = articleDescription(article)

    expect(description).toContain(
      'Federal grants do not have to be repaid',
    )
    // Markup never leaks into the derived value.
    expect(description).not.toContain('<')
    expect(description).not.toContain('>')
  })

  it('marks the derived truncation with an ellipsis, at a word boundary', () => {
    const article = articleFixture({
      content: `<p>${'word '.repeat(120)}</p>`,
    })
    const description = articleDescription(article)
    expect(description).toBeDefined()
    expect(description?.endsWith('…')).toBe(true)
    expect(description?.length).toBeLessThanOrEqual(200)
  })

  it('yields nothing when neither editorial copy nor body text exists', () => {
    const article = articleFixture({ content: '' })
    expect(articleDescription(article)).toBeUndefined()
  })
})

describe('articleMetaTags', () => {
  const featuredImage = {
    url: 'https://project.supabase.co/storage/v1/object/public/public-media/articles/image.png',
    alt: 'Students walking to class',
    width: null,
    height: null,
  }

  /** OG images are typed `OGImage | OGImage[]`; every test emits exactly one. */
  function firstOgImage(images: NonNullable<
    ReturnType<typeof articleMetaTags>['openGraph']
  >['images']) {
    return Array.isArray(images) ? images[0] : images
  }

  it('declares an article with the site name and locale, dynamically', () => {
    const meta = articleMetaTags(
      articleFixture(),
      'GetScholarship',
    )

    expect(meta.openGraph).toMatchObject({
      type: 'article',
      siteName: 'GetScholarship',
      locale: 'en_US',
    })
  })

  it('titles, canons and dates the card from the article itself', () => {
    const meta = articleMetaTags(
      articleFixture({
        seoTitle: 'SEO Title',
        canonicalUrl: 'https://getscholarship.online/articles/canonical',
        publishedAt: '2026-10-20T00:00:00+00:00',
      }),
      'GetScholarship',
    )

    expect(meta.openGraph).toMatchObject({
      title: 'SEO Title',
      url: 'https://getscholarship.online/articles/canonical',
      publishedTime: '2026-10-20T00:00:00+00:00',
    })
  })

  it('falls back to the slugged path and the plain title', () => {
    const meta = articleMetaTags(
      articleFixture({ title: 'Plain Title' }),
      'GetScholarship',
    )

    expect(meta.openGraph).toMatchObject({
      title: 'Plain Title',
      url: '/articles/test-article',
    })
  })

  it('points og:image at the featured image, not the logo or a broken path', () => {
    const meta = articleMetaTags(
      articleFixture({ featuredImage }),
      'GetScholarship',
    )

    expect(meta.openGraph?.images).toEqual([
      {
        url: featuredImage.url,
        alt: featuredImage.alt,
      },
    ])
  })

  it('omits og:image dimensions that were never recorded', () => {
    const meta = articleMetaTags(
      articleFixture({ featuredImage }),
      'GetScholarship',
    )

    expect(firstOgImage(meta.openGraph?.images)).not.toHaveProperty('width')
    expect(firstOgImage(meta.openGraph?.images)).not.toHaveProperty('height')
  })

  it('carries recorded dimensions through to og:image', () => {
    const meta = articleMetaTags(
      articleFixture({
        featuredImage: { ...featuredImage, width: 1200, height: 675 },
      }),
      'GetScholarship',
    )

    expect(firstOgImage(meta.openGraph?.images)).toMatchObject({
      width: 1200,
      height: 675,
    })
  })

  it('omits an empty alt on a decorative featured image', () => {
    const meta = articleMetaTags(
      articleFixture({ featuredImage: { ...featuredImage, alt: '' } }),
      'GetScholarship',
    )

    expect(firstOgImage(meta.openGraph?.images)).not.toHaveProperty('alt')
  })

  it('states the large X card and the same image under twitter', () => {
    const meta = articleMetaTags(
      articleFixture({ featuredImage }),
      'GetScholarship',
    )

    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Test Article',
      images: [{ url: featuredImage.url, alt: featuredImage.alt }],
    })
  })

  it('leaves twitter to the root layout and the file card when there is no featured image', () => {
    // Inheriting `card: summary_large_image` from the root layout and the
    // generated `opengraph-image.tsx` card is the designed fallback. An
    // explicit `undefined` `twitter` key would overwrite the root's card, so
    // the key must be entirely absent.
    const meta = articleMetaTags(articleFixture(), 'GetScholarship')

    expect('twitter' in meta).toBe(false)
    expect('images' in meta.openGraph!).toBe(false)
  })

  it('quotes the same description under og and twitter', () => {
    const article = articleFixture({
      excerpt: 'The standfirst.',
      featuredImage,
    })
    const meta = articleMetaTags(article, 'GetScholarship')

    expect(meta.openGraph?.description).toEqual('The standfirst.')
    expect(meta.twitter?.description).toEqual('The standfirst.')
  })
})
