import { describe, expect, it } from 'vitest'
import { slugify } from '@/lib/slugify'

describe('slugify', () => {
  it('creates lowercase hyphenated slugs', () => {
    expect(slugify('  Computer Science & Engineering  ')).toBe('computer-science-engineering')
  })

  it('normalises accented characters', () => {
    expect(slugify('Bursaries for Étudiants')).toBe('bursaries-for-etudiants')
  })

  it('removes punctuation and caps the result at 200 characters', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('a'.repeat(250))).toHaveLength(200)
  })
})
