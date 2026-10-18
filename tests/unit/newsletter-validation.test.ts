import { describe, expect, it } from 'vitest'

import {
  NEWSLETTER_HONEYPOT_FIELD,
  NEWSLETTER_STATUSES,
  newsletterSchema,
} from '@/lib/validation/newsletter'

/**
 * Newsletter signup validation.
 *
 * The honeypot matters more here than in the contact form: this action writes
 * through the SERVICE-ROLE client, which bypasses Row Level Security entirely, so
 * the Zod schema is the only thing between a bot and a row in a table of real
 * people's email addresses. There is no policy to catch a bad value.
 */
describe('newsletterSchema', () => {
  it('accepts a valid address', () => {
    const parsed = newsletterSchema.safeParse({
      email: 'reader@example.org',
      [NEWSLETTER_HONEYPOT_FIELD]: '',
    })
    expect(parsed.success).toBe(true)
  })

  it('trims whitespace around the address', () => {
    const parsed = newsletterSchema.safeParse({
      email: '  reader@example.org  ',
      [NEWSLETTER_HONEYPOT_FIELD]: '',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.email).toBe('reader@example.org')
  })

  it('rejects a malformed address', () => {
    expect(
      newsletterSchema.safeParse({
        email: 'not-an-email',
        [NEWSLETTER_HONEYPOT_FIELD]: '',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty address', () => {
    expect(
      newsletterSchema.safeParse({
        email: '',
        [NEWSLETTER_HONEYPOT_FIELD]: '',
      }).success,
    ).toBe(false)
  })

  it('rejects a filled honeypot', () => {
    expect(
      newsletterSchema.safeParse({
        email: 'bot@example.org',
        [NEWSLETTER_HONEYPOT_FIELD]: 'http://spam.example',
      }).success,
    ).toBe(false)
  })

  it('treats an absent honeypot as empty', () => {
    const parsed = newsletterSchema.safeParse({ email: 'reader@example.org' })
    expect(parsed.success).toBe(true)
  })
})

describe('newsletter lifecycle vocabulary', () => {
  /*
   * Mirrors the `public.newsletter_status` enum. The signup action branches on
   * these exact strings, so a rename on either side must break the build rather
   * than silently change behaviour.
   */
  it('matches the database enum', () => {
    expect([...NEWSLETTER_STATUSES]).toEqual([
      'pending',
      'subscribed',
      'unsubscribed',
      'bounced',
    ])
  })
})