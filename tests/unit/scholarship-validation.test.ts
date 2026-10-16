import { describe, expect, it } from 'vitest'

import {
  fromCents,
  parseRequiredDocuments,
  scholarshipSchema,
  slugify,
  toCents,
} from '@/lib/validation/scholarship'

/**
 * Scholarship validation.
 *
 * The money tests matter most: award amounts are integer cents in the database,
 * and a naive `parseFloat(x) * 100` would turn 1234.56 into 123455.9999… and
 * store a wrong number that looks plausible on screen.
 */

/** A minimal record that passes validation. */
function valid(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Example Scholarship',
    slug: 'example-scholarship',
    sponsor_name: 'Example Foundation',
    award_currency: 'USD',
    application_url: 'https://example.org/apply',
    ...overrides,
  }
}

describe('toCents', () => {
  it('converts whole amounts', () => {
    expect(toCents('100')).toBe(10_000)
    expect(toCents('0')).toBe(0)
  })

  it('converts decimal amounts exactly', () => {
    expect(toCents('1234.56')).toBe(123_456)
    expect(toCents('0.01')).toBe(1)
    expect(toCents('9.9')).toBe(990)
  })

  it('never introduces a floating point remainder', () => {
    // The classic float trap: 1234.56 * 100 === 123455.99999999999
    expect(toCents('1234.56')).toBe(123_456)
    expect(toCents('19.99')).toBe(1999)
    expect(toCents('0.07')).toBe(7)
  })

  it('ignores thousands separators and stray spaces', () => {
    expect(toCents('12,345.67')).toBe(1_234_567)
    expect(toCents(' 500 ')).toBe(50_000)
  })

  it('treats empty input as no value', () => {
    expect(toCents('')).toBeNull()
    expect(toCents('   ')).toBeNull()
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
  })

  it('returns NaN for input it cannot interpret', () => {
    // NaN is deliberate: the schema reports it with a real message rather than
    // silently coercing a typo to zero.
    expect(Number.isNaN(toCents('abc'))).toBe(true)
    expect(Number.isNaN(toCents('12.345'))).toBe(true)
    expect(Number.isNaN(toCents('-5'))).toBe(true)
  })
})

describe('fromCents', () => {
  it('round-trips through toCents', () => {
    for (const value of ['0.00', '9.99', '1234.56', '1000000.00']) {
      expect(fromCents(toCents(value))).toBe(value)
    }
  })

  it('renders null and undefined as an empty string', () => {
    expect(fromCents(null)).toBe('')
    expect(fromCents(undefined)).toBe('')
  })
})

describe('slugify', () => {
  it('produces a URL-safe slug', () => {
    expect(slugify('Fully Funded Scholarship 2026')).toBe(
      'fully-funded-scholarship-2026',
    )
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Chevalier de la Barre — Scholarship!')).toBe(
      'chevalier-de-la-barre-scholarship',
    )
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Hello--  ')).toBe('hello')
  })
})

describe('parseRequiredDocuments', () => {
  it('splits on newlines and commas', () => {
    expect(parseRequiredDocuments('Passport\nTranscript, Certificate')).toEqual([
      'Passport',
      'Transcript',
      'Certificate',
    ])
  })

  it('drops blanks', () => {
    expect(parseRequiredDocuments('Passport\n\n  \nTranscript')).toEqual([
      'Passport',
      'Transcript',
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(parseRequiredDocuments('')).toEqual([])
    expect(parseRequiredDocuments(null)).toEqual([])
  })
})

describe('scholarshipSchema', () => {
  it('accepts a minimal valid record', () => {
    const result = scholarshipSchema.safeParse(valid())
    expect(result.success).toBe(true)
  })

  it('requires a title and sponsor', () => {
    expect(scholarshipSchema.safeParse(valid({ title: '  ' })).success).toBe(
      false,
    )
    expect(
      scholarshipSchema.safeParse(valid({ sponsor_name: '' })).success,
    ).toBe(false)
  })

  it('rejects an http application link', () => {
    const result = scholarshipSchema.safeParse(
      valid({ application_url: 'http://example.org/apply' }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('HTTPS'))).toBe(true)
    }
  })

  it('rejects a malformed URL', () => {
    expect(
      scholarshipSchema.safeParse(valid({ application_url: 'not a url' })).success,
    ).toBe(false)
  })

  it('normalises the slug to lower case', () => {
    const result = scholarshipSchema.safeParse(valid({ slug: 'My-Slug' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('my-slug')
  })

  it('rejects slugs with invalid characters', () => {
    expect(scholarshipSchema.safeParse(valid({ slug: 'My Slug' })).success).toBe(
      false,
    )
    expect(scholarshipSchema.safeParse(valid({ slug: 'a--b' })).success).toBe(
      false,
    )
    expect(scholarshipSchema.safeParse(valid({ slug: 'ab' })).success).toBe(
      false,
    )
  })

  it('rejects a maximum award below the minimum', () => {
    const result = scholarshipSchema.safeParse(
      valid({ award_amount_min: '5000', award_amount_max: '1000' }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a deadline on a rolling scholarship', () => {
    const result = scholarshipSchema.safeParse(
      valid({ is_rolling: true, deadline: '2030-01-01' }),
    )
    expect(result.success).toBe(false)
  })

  it('allows a rolling scholarship with no deadline', () => {
    expect(
      scholarshipSchema.safeParse(valid({ is_rolling: true, deadline: '' }))
        .success,
    ).toBe(true)
  })

  it('rejects a deadline before the opening date', () => {
    const result = scholarshipSchema.safeParse(
      valid({ opens_at: '2030-06-01', deadline: '2030-01-01' }),
    )
    expect(result.success).toBe(false)
  })

  it('requires an application link before publishing', () => {
    const result = scholarshipSchema.safeParse(
      valid({ status: 'published', application_url: '' }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes('official application link'),
        ),
      ).toBe(true)
    }
  })

  it('blocks publishing while verification is pending', () => {
    const result = scholarshipSchema.safeParse(
      valid({ status: 'published', verification_status: 'pending' }),
    )
    expect(result.success).toBe(false)
  })

  it('blocks publishing while verification is disputed', () => {
    const result = scholarshipSchema.safeParse(
      valid({ status: 'published', verification_status: 'disputed' }),
    )
    expect(result.success).toBe(false)
  })

  it('allows publishing when explicitly unverified', () => {
    // The schema permits 'unverified' deliberately: an honest "we have not
    // checked this yet" state is different from an unresolved one.
    expect(
      scholarshipSchema.safeParse(
        valid({ status: 'published', verification_status: 'unverified' }),
      ).success,
    ).toBe(true)
  })

  it('does not require an application link for a draft', () => {
    expect(
      scholarshipSchema.safeParse(
        valid({ status: 'draft', application_url: '' }),
      ).success,
    ).toBe(true)
  })

  it('rejects a non-ISO date', () => {
    expect(
      scholarshipSchema.safeParse(valid({ deadline: '01/01/2030' })).success,
    ).toBe(false)
  })

  it('rejects a zero or negative award count', () => {
    expect(
      scholarshipSchema.safeParse(valid({ number_of_awards: '0' })).success,
    ).toBe(false)
  })

  it('defaults optional booleans to false', () => {
    const result = scholarshipSchema.safeParse(valid())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.featured).toBe(false)
      expect(result.data.noindex).toBe(false)
      expect(result.data.is_rolling).toBe(false)
      expect(result.data.status).toBe('draft')
    }
  })

  it('defaults taxonomy arrays to empty', () => {
    const result = scholarshipSchema.safeParse(valid())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category_ids).toEqual([])
      expect(result.data.location_ids).toEqual([])
    }
  })

  it('rejects a non-UUID taxonomy id', () => {
    expect(
      scholarshipSchema.safeParse(valid({ category_ids: ['not-a-uuid'] }))
        .success,
    ).toBe(false)
  })
})