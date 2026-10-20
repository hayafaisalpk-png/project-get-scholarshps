import { describe, expect, it } from 'vitest'

import { storedConsentAllowsAnalytics } from '@/features/analytics/consent'

describe('storedConsentAllowsAnalytics', () => {
  it('refuses when nothing is stored — the visitor has not chosen yet', () => {
    expect(storedConsentAllowsAnalytics(null)).toBe(false)
  })

  it('refuses storage that is not valid JSON', () => {
    expect(storedConsentAllowsAnalytics('{oops')).toBe(false)
  })

  it('refuses stored values that are not an object', () => {
    expect(storedConsentAllowsAnalytics('"analytics"')).toBe(false)
    expect(storedConsentAllowsAnalytics('true')).toBe(false)
  })

  it('refuses the reject-optional decision', () => {
    expect(
      storedConsentAllowsAnalytics(
        '{"analytics":false,"ads":false,"functionality":true}',
      ),
    ).toBe(false)
  })

  it('refuses a stored object with no analytics flag at all', () => {
    expect(storedConsentAllowsAnalytics('{"ads":true,"functionality":true}')).toBe(false)
  })

  it('accepts the accept-all decision', () => {
    expect(
      storedConsentAllowsAnalytics(
        '{"analytics":true,"ads":true,"functionality":true}',
      ),
    ).toBe(true)
  })

  it('accepts analytics while the other optional flags stay off', () => {
    expect(
      storedConsentAllowsAnalytics(
        '{"analytics":true,"ads":false,"functionality":true}',
      ),
    ).toBe(true)
  })
})
