import { describe, expect, it } from 'vitest'

import { altAttributeFor, parseImageId } from '@/features/media/selection'

/**
 * Featured-image selection rules.
 *
 * `altAttributeFor` is the single place the rule lives, so the picker, the editor
 * and any future renderer cannot disagree about what a screen reader will be
 * told. The distinction that matters is between an EMPTY alt and a MISSING one:
 *
 *   - `alt=""` tells assistive technology to SKIP the image;
 *   - omitting `alt` leaves the browser to expose the file name as the
 *     accessible name.
 *
 * Getting that backwards is the most common way decorative images end up
 * announced as "chart.png".
 */

describe('parseImageId', () => {
  it('treats an empty value as "no image"', () => {
    // Most articles have no featured image, so this must not be an error.
    expect(parseImageId('')).toEqual({ ok: true, id: null })
    expect(parseImageId('   ')).toEqual({ ok: true, id: null })
    expect(parseImageId(null)).toEqual({ ok: true, id: null })
    expect(parseImageId(undefined)).toEqual({ ok: true, id: null })
  })

  it('accepts a real uuid', () => {
    const id = '3f1a1f9e-2c2b-4a51-9d3e-8f2a1c4b5d6e'
    expect(parseImageId(id)).toEqual({ ok: true, id })
  })

  it.each([
    ['not a uuid', 'abc'],
    ['an injected filter', '3f1a1f9e-2c2b-4a51-9d3e-8f2a1c4b5d6e?select=*'],
    ['a path traversal', '../../etc/passwd'],
  ])('refuses %s', (_label, raw) => {
    expect(parseImageId(raw).ok).toBe(false)
  })
})

describe('altAttributeFor', () => {
  const base = { fileName: 'award-ceremony.jpg', altText: 'Students at an award ceremony', isDecorative: false }

  it('returns the alt text verbatim for a described image', () => {
    expect(altAttributeFor(base)).toBe('Students at an award ceremony')
  })

  it('trims surrounding whitespace', () => {
    expect(altAttributeFor({ ...base, altText: '  A caption.  ' })).toBe('A caption.')
  })

  it('returns an EMPTY string for a decorative image, not the file name', () => {
    // `alt=""` means "skip me". Returning the file name would announce
    // "award-ceremony.jpg" to a screen reader.
    expect(altAttributeFor({ ...base, isDecorative: true, altText: null })).toBe('')
  })

  it('still prefers decorative over a stray alt text', () => {
    // The flag is the decision. If an image is decorative, any text left over
    // from when it was described must not start being announced again.
    expect(altAttributeFor({ ...base, isDecorative: true })).toBe('')
  })

  /**
   * Unreachable since migration 030, and kept as a backstop: a meaningful image
   * with no accessible name is worse than one named badly.
   */
  it('falls back to the file name rather than silently hiding an undescribed image', () => {
    expect(altAttributeFor({ ...base, altText: null })).toBe('award-ceremony.jpg')
    expect(altAttributeFor({ ...base, altText: '   ' })).toBe('award-ceremony.jpg')
  })
})