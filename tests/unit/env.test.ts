import { describe, expect, it } from 'vitest'

import { absoluteUrl, getSiteUrl } from '@/lib/env'

describe('env helpers', () => {
  it('returns the canonical origin without a trailing slash', () => {
    const siteUrl = getSiteUrl()
    expect(siteUrl.endsWith('/')).toBe(false)
  })

  it('builds absolute URLs from site-relative paths', () => {
    expect(absoluteUrl('/scholarships')).toBe(`${getSiteUrl()}/scholarships`)
  })

  it('normalises paths that are missing a leading slash', () => {
    expect(absoluteUrl('robots.txt')).toBe(`${getSiteUrl()}/robots.txt`)
  })
})
