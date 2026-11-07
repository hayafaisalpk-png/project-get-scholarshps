import { describe, expect, it } from 'vitest'

import { selectUniqueScholarships } from '@/features/scholarships/homepage-selection'

describe('homepage scholarship selection', () => {
  it('excludes featured records while preserving recent query order', () => {
    const candidates = [
      { id: 'featured', title: 'Featured' },
      { id: 'recent-1', title: 'Newest unique' },
      { id: 'recent-2', title: 'Next unique' },
    ]

    expect(
      selectUniqueScholarships(candidates, new Set(['featured']), 2),
    ).toEqual([
      { id: 'recent-1', title: 'Newest unique' },
      { id: 'recent-2', title: 'Next unique' },
    ])
  })

  it('removes repeated candidates and respects the item limit', () => {
    const candidates = [
      { id: 'recent-1' },
      { id: 'recent-1' },
      { id: 'recent-2' },
      { id: 'recent-3' },
    ]

    expect(selectUniqueScholarships(candidates, new Set(), 2)).toEqual([
      { id: 'recent-1' },
      { id: 'recent-2' },
    ])
  })
})
