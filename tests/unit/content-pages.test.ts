import { describe, expect, it } from 'vitest'

import {
  CONTENT_PAGE_SLUGS,
  isContentPageSlug,
} from '@/lib/content-pages'

/**
 * Content-page slug vocabulary.
 *
 * `isContentPageSlug` is the guard that keeps a URL segment from becoming a
 * database filter verbatim, so it is worth pinning: a value that is not in the
 * vocabulary must never be treated as a valid slug.
 *
 * The list itself is the contract with `navigation_items`, which ships rows
 * pointing at `/about`, `/help`, `/privacy`, `/terms` and
 * `/editorial-standards`. A slug added here without a matching route would
 * render the 404 page, and a route added without a slug here would be
 * unreachable through `ContentPage`.
 */
describe('content page slugs', () => {
  it('covers every path the navigation links to', () => {
    expect([...CONTENT_PAGE_SLUGS]).toEqual([
      'about',
      'help',
      'privacy',
      'terms',
      'editorial-standards',
    ])
  })

  it('recognises its own slugs', () => {
    for (const slug of CONTENT_PAGE_SLUGS) {
      expect(isContentPageSlug(slug), slug).toBe(true)
    }
  })

  it('rejects anything outside the vocabulary', () => {
    expect(isContentPageSlug('admin')).toBe(false)
    expect(isContentPageSlug('nonexistent')).toBe(false)
    expect(isContentPageSlug('../../etc/passwd')).toBe(false)
    expect(isContentPageSlug('')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isContentPageSlug(undefined)).toBe(false)
    expect(isContentPageSlug(null)).toBe(false)
    expect(isContentPageSlug(42)).toBe(false)
    expect(isContentPageSlug(['about'])).toBe(false)
  })

  it('does not match on a prefix or a different case', () => {
    // The navigation hrefs are lowercase, and `content_pages.slug` is `citext`.
    // Matching is exact so a near-miss cannot silently render the wrong page.
    expect(isContentPageSlug('about-us')).toBe(false)
    expect(isContentPageSlug('abouts')).toBe(false)
    expect(isContentPageSlug('editorial_standards')).toBe(false)
  })
})