import { describe, expect, it } from 'vitest'
import { consentSchema } from '@/features/consent/validation'

const valid = {
  visitorId: '00000000-0000-4000-8000-000000000001',
  analytics: false,
  ads: false,
  functionality: true,
  version: '1',
  source: 'banner' as const,
}

describe('consentSchema', () => {
  it('accepts an explicit essential-only choice', () => {
    expect(consentSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts settings as a consent source', () => {
    expect(consentSchema.safeParse({ ...valid, source: 'settings', analytics: true }).success).toBe(true)
  })

  it('rejects a non-UUID visitor identifier', () => {
    expect(consentSchema.safeParse({ ...valid, visitorId: 'visitor-1' }).success).toBe(false)
  })

  it('rejects an unknown consent source', () => {
    expect(consentSchema.safeParse({ ...valid, source: 'cookie' }).success).toBe(false)
  })
})
