import { describe, expect, it } from 'vitest'

import { findSeoIssues, resolveIndexChange, type IndexSubject } from '@/features/seo/guardrails'
import {
  EDITABLE_SETTING_KEYS,
  isEditableSettingKey,
  parseSettingValue,
  settingValueToInput,
} from '@/lib/validation/settings'

/**
 * SEO guardrails and settings value handling.
 *
 * Two failure modes are being guarded against, and they are opposites:
 *
 *   - the guardrail letting something through that must not be indexed;
 *   - the settings conversion storing a value the page will then read wrongly.
 *
 * The second is easy to underestimate. `value` is JSONB, so a boolean written as
 * the string `"false"` is TRUTHY in JavaScript — a newsletter or ad switch would
 * read as on while the screen showed it off.
 */

const subject = (over: Partial<IndexSubject> = {}): IndexSubject => ({
  kind: 'scholarship',
  id: '3f1a1f9e-2c2b-4a51-9d3e-8f2a1c4b5d6e',
  title: 'A scholarship',
  status: 'published',
  noindex: false,
  ...over,
})

/* -------------------------------------------------------------------------- */
/* Rule 1 — unreachable content cannot be forced indexable                     */
/* -------------------------------------------------------------------------- */

describe('resolveIndexChange — making a record indexable', () => {
  it('allows a published record to be indexed', () => {
    const verdict = resolveIndexChange(subject(), true)
    expect(verdict).toEqual({ ok: true, patch: { noindex: false, allow_sitemap: null } })
  })

  it('allows an active content page to be indexed', () => {
    const verdict = resolveIndexChange(
      subject({ kind: 'content_page', status: 'active' }),
      true,
    )
    expect(verdict.ok).toBe(true)
  })

  it.each(['draft', 'in_review', 'scheduled', 'archived', 'inactive'])(
    'REFUSES a %s record, and says why in words',
    (status) => {
      const verdict = resolveIndexChange(subject({ status }), true)
      expect(verdict.ok).toBe(false)
      // The message has to be readable by an editor, not a code.
      expect(verdict.ok === false && verdict.message).toMatch(/publish/i)
    },
  )

  it('names the actual status rather than a generic message', () => {
    const verdict = resolveIndexChange(subject({ status: 'archived' }), true)
    expect(verdict.ok === false && verdict.message).toMatch(/archived/i)
  })
})

/* -------------------------------------------------------------------------- */
/* Rule 3 — noindex and sitemap inclusion move together                        */
/* -------------------------------------------------------------------------- */

describe('resolveIndexChange — excluding a record', () => {
  it('sets noindex and clears sitemap inclusion together', () => {
    // Setting one without the other is the contradiction the sitemap is built
    // to avoid, and the database CHECK on articles forbids it outright.
    const verdict = resolveIndexChange(subject({ kind: 'article' }), false)
    expect(verdict).toEqual({ ok: true, patch: { noindex: true, allow_sitemap: false } })
  })

  it('reports null for kinds with no allow_sitemap column', () => {
    // `scholarships` has no such column: writing it would be a runtime error.
    const verdict = resolveIndexChange(subject({ kind: 'scholarship' }), false)
    expect(verdict.ok && verdict.patch.allow_sitemap).toBeNull()
  })

  it('allows excluding an unpublished record without complaint', () => {
    // Turning indexing OFF is always safe. Only turning it on needs a guard.
    const verdict = resolveIndexChange(subject({ status: 'draft' }), false)
    expect(verdict.ok).toBe(true)
  })

  it('re-enables sitemap inclusion for an article when it is made indexable again', () => {
    // Otherwise a record excluded once could never rejoin the sitemap.
    const verdict = resolveIndexChange(subject({ kind: 'article', noindex: true }), true)
    expect(verdict.ok && verdict.patch).toEqual({ noindex: false, allow_sitemap: true })
  })
})

/* -------------------------------------------------------------------------- */
/* The audit                                                                   */
/* -------------------------------------------------------------------------- */

describe('findSeoIssues', () => {
  const base = {
    kind: 'scholarship' as const,
    id: 'id-1',
    title: 'A record',
    status: 'published',
    noindex: false,
    seoTitle: 'A title',
    seoDescription: 'A description',
  }

  it('finds nothing wrong with a complete record', () => {
    expect(findSeoIssues(base)).toEqual([])
  })

  it('flags a record that is no-index but still in the sitemap', () => {
    const issues = findSeoIssues({ ...base, kind: 'article', noindex: true, allowSitemap: true })
    expect(issues.some((i) => i.severity === 'warning' && /sitemap/i.test(i.message))).toBe(true)
  })

  it('does NOT flag that contradiction for a kind with no sitemap column', () => {
    // `allowSitemap: null` means "there is no such column", not "excluded".
    const issues = findSeoIssues({ ...base, noindex: true, allowSitemap: null })
    expect(issues.some((i) => /sitemap/i.test(i.message))).toBe(false)
  })

  it('flags missing SEO fields only on records that can actually rank', () => {
    const published = findSeoIssues({
      ...base,
      seoTitle: null,
      seoDescription: null,
    })
    expect(published.some((i) => /SEO title/i.test(i.message))).toBe(true)
    expect(published.some((i) => /description/i.test(i.message))).toBe(true)

    // A draft has nothing to tell a crawler, so nagging about its metadata is
    // noise rather than a finding.
    const draft = findSeoIssues({
      ...base,
      status: 'draft',
      seoTitle: null,
      seoDescription: null,
    })
    expect(draft).toEqual([])
  })

  it('does not nag about metadata on a record that is deliberately excluded', () => {
    expect(findSeoIssues({ ...base, noindex: true, seoTitle: null })).toEqual([])
  })

  it('flags a canonical URL that is not https', () => {
    const issues = findSeoIssues({ ...base, canonicalUrl: 'http://example.org/x' })
    expect(issues.some((i) => i.severity === 'warning' && /https/i.test(i.message))).toBe(true)
  })

  it('gives every issue a unique key', () => {
    const issues = findSeoIssues({
      ...base,
      kind: 'article',
      noindex: true,
      allowSitemap: true,
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: 'http://example.org/x',
    })
    expect(new Set(issues.map((i) => i.key)).size).toBe(issues.length)
  })
})

/* -------------------------------------------------------------------------- */
/* Settings values                                                             */
/* -------------------------------------------------------------------------- */

describe('parseSettingValue', () => {
  it('stores a boolean as a boolean, not the string "false"', () => {
    // The bug this whole file exists to prevent: "false" is truthy in JS.
    const result = parseSettingValue({ raw: 'false', valueType: 'boolean' })
    expect(result).toEqual({ ok: true, value: false })
    expect(typeof (result as { value: unknown }).value).toBe('boolean')
  })

  it('stores a string as a string', () => {
    expect(parseSettingValue({ raw: 'GetScholarship', valueType: 'string' })).toEqual({
      ok: true,
      value: 'GetScholarship',
    })
  })

  it('refuses a boolean it cannot interpret', () => {
    expect(parseSettingValue({ raw: 'yes', valueType: 'boolean' }).ok).toBe(false)
    expect(parseSettingValue({ raw: '', valueType: 'boolean' }).ok).toBe(false)
  })

  it('stores a number as a number', () => {
    expect(parseSettingValue({ raw: '42', valueType: 'number' })).toEqual({ ok: true, value: 42 })
    expect(parseSettingValue({ raw: '-1.5', valueType: 'number' })).toEqual({
      ok: true,
      value: -1.5,
    })
  })

  it.each(['abc', '', '12abc', '1.2.3'])('refuses %o as a number', (raw) => {
    expect(parseSettingValue({ raw, valueType: 'number' }).ok).toBe(false)
  })

  it('requires https for a URL, and permits an empty one', () => {
    expect(parseSettingValue({ raw: 'https://facebook.com/x', valueType: 'url' }).ok).toBe(true)
    expect(parseSettingValue({ raw: '', valueType: 'url' })).toEqual({ ok: true, value: '' })
    expect(parseSettingValue({ raw: 'http://facebook.com/x', valueType: 'url' }).ok).toBe(false)
    expect(parseSettingValue({ raw: 'facebook.com/x', valueType: 'url' }).ok).toBe(false)
  })

  it('treats an unknown type as text rather than refusing to save', () => {
    // Refusing to save a setting because its type drifted would be worse than
    // storing it as a string.
    expect(parseSettingValue({ raw: 'anything', valueType: 'colour' })).toEqual({
      ok: true,
      value: 'anything',
    })
  })
})

describe('settingValueToInput', () => {
  it('round-trips every stored type back into a form value', () => {
    expect(settingValueToInput('hello')).toBe('hello')
    expect(settingValueToInput(true)).toBe('true')
    expect(settingValueToInput(false)).toBe('false')
    expect(settingValueToInput(42)).toBe('42')
    expect(settingValueToInput(null)).toBe('')
    expect(settingValueToInput(undefined)).toBe('')
  })

  it('shows stored JSON rather than an empty box', () => {
    expect(settingValueToInput({ a: 1 })).toBe('{"a":1}')
  })
})

describe('EDITABLE_SETTING_KEYS', () => {
  it('never includes a private feature switch', () => {
    // `newsletter.enabled`, `ads.enabled` and `site.maintenance_mode` live in the
    // same table. A generic settings form is how a maintenance switch gets
    // flipped by accident.
    for (const forbidden of [
      'newsletter.enabled',
      'ads.enabled',
      'site.maintenance_mode',
      'privacy.require_consent',
      'publishing.default_author_id',
    ]) {
      expect(EDITABLE_SETTING_KEYS).not.toContain(forbidden)
      expect(isEditableSettingKey(forbidden)).toBe(false)
    }
  })

  it('allows the SEO and social defaults it is meant to allow', () => {
    expect(isEditableSettingKey('seo.default_title')).toBe(true)
    expect(isEditableSettingKey('social.facebook_url')).toBe(true)
    expect(isEditableSettingKey('not.a.setting')).toBe(false)
  })
})