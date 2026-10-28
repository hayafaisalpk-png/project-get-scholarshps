import { describe, expect, it } from 'vitest'

import {
  resolveScholarshipSocialImage,
  scholarshipMetaTags,
} from '@/features/scholarships/metadata'
import type { ScholarshipMetaInput } from '@/features/scholarships/metadata'

function fixture(overrides: Partial<ScholarshipMetaInput> = {}): ScholarshipMetaInput {
  return {
    title: 'Test Scholarship',
    slug: 'test-scholarship',
    ...overrides,
  }
}

describe('resolveScholarshipSocialImage', () => {
  it('uses the custom URL first', () => {
    const url = resolveScholarshipSocialImage({
      social_media_share_image_url: 'https://example.com/custom.jpg',
      institution: { logo_url: 'https://example.com/logo.png' },
    })
    expect(url).toBe('https://example.com/custom.jpg')
  })

  it('falls back to the branded banner when no custom URL', () => {
    const url = resolveScholarshipSocialImage(
      { institution: { logo_url: 'https://example.com/logo.png' } },
      'https://example.com/banner.jpg',
    )
    expect(url).toBe('https://example.com/banner.jpg')
  })

  it('falls back to the institution logo when no banner', () => {
    const url = resolveScholarshipSocialImage({
      institution: { logo_url: 'https://example.com/logo.png' },
    })
    expect(url).toBe('https://example.com/logo.png')
  })

  it('returns null when nothing is available', () => {
    const url = resolveScholarshipSocialImage({})
    expect(url).toBeNull()
  })

  it('rejects malformed and unsupported schemes', () => {
    expect(
      resolveScholarshipSocialImage({
        social_media_share_image_url: 'javascript:alert(1)',
      }),
    ).toBeNull()
    expect(
      resolveScholarshipSocialImage({
        social_media_share_image_url: 'not a url',
      }),
    ).toBeNull()
    expect(
      resolveScholarshipSocialImage({
        social_media_share_image_url: '',
      }),
    ).toBeNull()
  })

  it('does not use a relative URL', () => {
    const url = resolveScholarshipSocialImage({
      social_media_share_image_url: '/images/x.jpg',
    })
    expect(url).toBeNull()
  })
})

describe('scholarshipMetaTags', () => {
  it('emits og:image and twitter:image for a custom URL', () => {
    const meta = scholarshipMetaTags(
      fixture({ social_media_share_image_url: 'https://example.com/custom.jpg' }),
      'GetScholarship',
    )
    expect(meta.openGraph?.images).toEqual([{ url: 'https://example.com/custom.jpg' }])
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [{ url: 'https://example.com/custom.jpg' }],
    })
  })

  it('omits images when nothing is available', () => {
    const meta = scholarshipMetaTags(fixture(), 'GetScholarship')
    expect('images' in (meta.openGraph ?? {})).toBe(false)
    expect('twitter' in meta).toBe(false)
  })
})