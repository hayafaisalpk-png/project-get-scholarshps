import { describe, expect, it } from 'vitest'

import {
  CONTACT_SUBJECTS,
  HONEYPOT_FIELD,
  REPORT_REASONS,
  contactSchema,
  reportSchema,
} from '@/lib/validation/contact'

/**
 * Contact and report validation.
 *
 * The two forms write to different tables with different guarantees, and these
 * tests pin the boundaries an attacker would probe:
 *
 *   - the honeypot must reject anything filled in, so the field cannot be used
 *     as a free-text smuggling channel;
 *   - length caps must hold, because the contact action inserts through the
 *     SERVICE-ROLE client, which bypasses RLS and therefore has no database-side
 *     bound of its own to catch an oversized body;
 *   - the reason and subject vocabularies must be closed, so a value that is not
 *     a real enum member can never reach an insert.
 */

const VALID_CONTACT = {
  name: 'Ama Boateng',
  email: 'ama@example.org',
  subject: 'general',
  message: 'I would like to ask about the engineering scholarship listing.',
  [HONEYPOT_FIELD]: '',
}

const VALID_REPORT = {
  target: 'scholarship',
  reason: 'incorrect_deadline',
  details: 'The deadline says 30 March but the awarding body says 14 April.',
  email: '',
  [HONEYPOT_FIELD]: '',
}

describe('contactSchema', () => {
  it('accepts a well-formed message', () => {
    const parsed = contactSchema.safeParse(VALID_CONTACT)
    expect(parsed.success).toBe(true)
  })

  it('trims surrounding whitespace before validating length', () => {
    const parsed = contactSchema.safeParse({
      ...VALID_CONTACT,
      name: '   Ama Boateng   ',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.name).toBe('Ama Boateng')
    }
  })

  it('requires every field the action inserts', () => {
    for (const key of ['name', 'email', 'subject', 'message'] as const) {
      const parsed = contactSchema.safeParse({ ...VALID_CONTACT, [key]: '' })
      expect(parsed.success, `${key} should be required`).toBe(false)
    }
  })

  it('rejects a message shorter than a sentence', () => {
    const parsed = contactSchema.safeParse({ ...VALID_CONTACT, message: 'hi' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an oversized message', () => {
    const parsed = contactSchema.safeParse({
      ...VALID_CONTACT,
      message: 'a'.repeat(5001),
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an oversized name', () => {
    const parsed = contactSchema.safeParse({
      ...VALID_CONTACT,
      name: 'a'.repeat(121),
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts only subjects in the closed vocabulary', () => {
    for (const subject of CONTACT_SUBJECTS) {
      const parsed = contactSchema.safeParse({ ...VALID_CONTACT, subject })
      expect(parsed.success, subject).toBe(true)
    }

    // Free text would land in a `subject not null` column with no constraint,
    // so the vocabulary has to be enforced here.
    expect(
      contactSchema.safeParse({ ...VALID_CONTACT, subject: 'anything else' })
        .success,
    ).toBe(false)
  })

  it('rejects a malformed email', () => {
    expect(
      contactSchema.safeParse({ ...VALID_CONTACT, email: 'not-an-email' })
        .success,
    ).toBe(false)
  })

  it('rejects a filled honeypot', () => {
    const parsed = contactSchema.safeParse({
      ...VALID_CONTACT,
      [HONEYPOT_FIELD]: 'http://spam.example',
    })
    expect(parsed.success).toBe(false)
  })

  it('treats an absent honeypot as empty', () => {
    const withoutHoneypot: Record<string, unknown> = { ...VALID_CONTACT }
    delete withoutHoneypot[HONEYPOT_FIELD]
    expect(contactSchema.safeParse(withoutHoneypot).success).toBe(true)
  })
})

describe('reportSchema', () => {
  it('accepts a well-formed report', () => {
    expect(reportSchema.safeParse(VALID_REPORT).success).toBe(true)
  })

  it('accepts a report with no detail and no email', () => {
    const parsed = reportSchema.safeParse({
      target: 'article',
      reason: 'other',
      [HONEYPOT_FIELD]: '',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a supplied email address', () => {
    const parsed = reportSchema.safeParse({
      ...VALID_REPORT,
      email: 'someone@example.org',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts every reason in the closed vocabulary', () => {
    for (const reason of REPORT_REASONS) {
      const parsed = reportSchema.safeParse({ ...VALID_REPORT, reason })
      expect(parsed.success, reason).toBe(true)
    }
  })

  it('rejects an unknown reason', () => {
    expect(
      reportSchema.safeParse({ ...VALID_REPORT, reason: 'because' }).success,
    ).toBe(false)
  })

  it('rejects an unknown target', () => {
    expect(
      reportSchema.safeParse({ ...VALID_REPORT, target: 'user' }).success,
    ).toBe(false)
  })

  it('rejects oversized detail', () => {
    const parsed = reportSchema.safeParse({
      ...VALID_REPORT,
      details: 'a'.repeat(2001),
    })
    expect(parsed.success).toBe(false)
  })

  it('requires a reason', () => {
    expect(reportSchema.safeParse({ ...VALID_REPORT, reason: '' }).success).toBe(
      false,
    )
  })

  it('rejects a filled honeypot', () => {
    const parsed = reportSchema.safeParse({
      ...VALID_REPORT,
      [HONEYPOT_FIELD]: 'spam',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('vocabularies', () => {
  /*
   * These literals are duplicated in the database (`public.report_reason` and
   * the `contact_submissions.subject` column has no enum). If the enum gains a
   * value and this list does not, the insert fails at runtime for a visitor, so
   * the assertion below is the tripwire.
   */
  it('keeps report reasons in sync with the database enum', () => {
    expect([...REPORT_REASONS]).toEqual([
      'incorrect_deadline',
      'incorrect_amount',
      'not_eligible',
      'no_longer_available',
      'broken_link',
      'duplicate',
      'other',
    ])
  })

  it('keeps contact subjects free of duplicates or empty labels', () => {
    expect(new Set(CONTACT_SUBJECTS).size).toBe(CONTACT_SUBJECTS.length)
    for (const subject of CONTACT_SUBJECTS) {
      expect(subject.trim().length).toBeGreaterThan(0)
    }
  })
})