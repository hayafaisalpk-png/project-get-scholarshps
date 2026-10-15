import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SEARCH,
  MAX_PAGE_SIZE,
  type ScholarshipSearch,
  hasActiveFilters,
  parseScholarshipSearch,
  scholarshipSearchPath,
  serializeScholarshipSearch,
  toSearchRpcArgs,
} from '@/features/scholarships/search-params'
import type { Database } from '@/types/database'

const empty = (): ScholarshipSearch => ({ ...DEFAULT_SEARCH })

describe('parseScholarshipSearch', () => {
  it('returns a default search for an empty query', () => {
    const result = parseScholarshipSearch({})
    expect(result).toEqual({
      ...DEFAULT_SEARCH,
      // A relevance sort is meaningless with no query, so it degrades to newest.
      sort: 'newest',
    })
  })

  it('accepts repeated parameters as arrays', () => {
    const result = parseScholarshipSearch({ level: ['undergraduate', 'graduate'] })
    // Filter lists are canonicalised into sorted order so that the same logical
    // filter set always produces the same URL.
    expect(result.level).toEqual(['graduate', 'undergraduate'])
  })

  it('normalises filter order so equivalent URLs are identical', () => {
    const a = parseScholarshipSearch({ level: 'undergraduate,graduate' })
    const b = parseScholarshipSearch({ level: 'graduate,undergraduate' })
    expect(serializeScholarshipSearch(a).toString()).toBe(
      serializeScholarshipSearch(b).toString(),
    )
  })

  it('splits comma-separated values and de-duplicates', () => {
    const result = parseScholarshipSearch({ category: 'nursing,stem,NURSING' })
    expect(result.category).toEqual(['nursing', 'stem'])
  })

  it('lowercases and trims slugs', () => {
    expect(parseScholarshipSearch({ field: ' STEM ' }).field).toEqual(['stem'])
  })

  it('rejects values that are not slug-shaped', () => {
    // An injected value must be dropped, not passed through to the query.
    const result = parseScholarshipSearch({ level: ['undergrad; DROP TABLE'] })
    expect(result.level).toEqual([])
  })

  it('caps the number of values per filter', () => {
    const many = Array.from({ length: 50 }, (_, i) => `tag-${i}`)
    expect(parseScholarshipSearch({ tag: many }).tag.length).toBeLessThanOrEqual(10)
  })

  it('falls back to newest when relevance is requested without a query', () => {
    expect(parseScholarshipSearch({ sort: 'relevance' }).sort).toBe('newest')
  })

  it('keeps relevance when a query is present', () => {
    expect(parseScholarshipSearch({ q: 'nursing', sort: 'relevance' }).sort).toBe(
      'relevance',
    )
  })

  it('falls back to newest for an unknown sort value', () => {
    expect(parseScholarshipSearch({ sort: 'DROP TABLE' }).sort).toBe('newest')
  })

  it('parses amounts into integer cents', () => {
    const result = parseScholarshipSearch({ minAmount: '5000', maxAmount: '20000' })
    expect(result.minAmount).toBe(500_000)
    expect(result.maxAmount).toBe(2_000_000)
  })

  it('rejects negative and non-numeric amounts', () => {
    const result = parseScholarshipSearch({ minAmount: '-5', maxAmount: 'abc' })
    expect(result.minAmount).toBeNull()
    expect(result.maxAmount).toBeNull()
  })

  it('drops an inverted amount range rather than returning nothing', () => {
    const result = parseScholarshipSearch({ minAmount: '9000', maxAmount: '1000' })
    expect(result.minAmount).toBeNull()
    expect(result.maxAmount).toBeNull()
  })

  it('parses booleanish values', () => {
    expect(parseScholarshipSearch({ renewable: '1' }).renewable).toBe(true)
    expect(parseScholarshipSearch({ renewable: 'true' }).renewable).toBe(true)
    expect(parseScholarshipSearch({ renewable: 'yes' }).renewable).toBe(true)
    expect(parseScholarshipSearch({ renewable: '0' }).renewable).toBe(false)
    expect(parseScholarshipSearch({ renewable: 'maybe' }).renewable).toBe(false)
    expect(parseScholarshipSearch({}).renewable).toBe(false)
  })

  it('falls back to "any" for an unknown deadline window', () => {
    expect(parseScholarshipSearch({ deadline: 'whenever' }).deadline).toBe('any')
  })

  it('clamps the page number into range', () => {
    expect(parseScholarshipSearch({ page: '0' }).page).toBe(1)
    expect(parseScholarshipSearch({ page: '-3' }).page).toBe(1)
    expect(parseScholarshipSearch({ page: '99999' }).page).toBe(500)
    expect(parseScholarshipSearch({ page: 'abc' }).page).toBe(1)
  })

  it('truncates an over-long query', () => {
    const result = parseScholarshipSearch({ q: 'a'.repeat(500) })
    expect(result.q.length).toBeLessThanOrEqual(120)
  })
})

describe('serializeScholarshipSearch', () => {
  it('produces an empty string for the default search', () => {
    expect(serializeScholarshipSearch(empty()).toString()).toBe('')
  })

  it('omits default values', () => {
    const search = { ...empty(), deadline: 'any' as const, sort: 'relevance' as const, page: 1 }
    expect(serializeScholarshipSearch(search).toString()).toBe('')
  })

  it('is deterministic regardless of value ordering', () => {
    const a = serializeScholarshipSearch({ ...empty(), level: ['undergraduate', 'graduate'] }).toString()
    const b = serializeScholarshipSearch({ ...empty(), level: ['graduate', 'undergraduate'] }).toString()
    expect(a).toBe(b)
  })

  it('round-trips through the parser', () => {
    const original: ScholarshipSearch = {
      ...empty(),
      q: 'nursing scholarship',
      // Canonical (sorted) filter order.
      level: ['graduate', 'undergraduate'],
      field: ['nursing'],
      category: ['merit-based'],
      location: ['united-states'],
      tag: ['renewable'],
      minAmount: 500_000,
      maxAmount: 2_000_000,
      deadline: 'month',
      renewable: true,
      freeApplication: true,
      international: true,
      sort: 'deadline',
      page: 3,
    }

    const qs = serializeScholarshipSearch(original).toString()
    const parsed = parseScholarshipSearch(Object.fromEntries(new URLSearchParams(qs)))

    expect(parsed).toEqual(original)
  })

  it('emits amounts in dollars for readability', () => {
    const qs = serializeScholarshipSearch({ ...empty(), minAmount: 500_000 })
    expect(qs.get('minAmount')).toBe('5000')
  })

  it('builds a canonical path', () => {
    expect(scholarshipSearchPath(empty())).toBe('/scholarships')
    expect(scholarshipSearchPath({ ...empty(), q: 'nursing' })).toBe(
      '/scholarships?q=nursing',
    )
  })
})

describe('hasActiveFilters', () => {
  it('is false for a bare search', () => {
    expect(hasActiveFilters(empty())).toBe(false)
  })

  it('is false when only sorting and paging differ', () => {
    expect(hasActiveFilters({ ...empty(), sort: 'newest', page: 4 })).toBe(false)
  })

  it('is true for any real filter', () => {
    expect(hasActiveFilters({ ...empty(), q: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...empty(), level: ['undergraduate'] })).toBe(true)
    expect(hasActiveFilters({ ...empty(), deadline: 'week' })).toBe(true)
    expect(hasActiveFilters({ ...empty(), renewable: true })).toBe(true)
    expect(hasActiveFilters({ ...empty(), minAmount: 100 })).toBe(true)
  })
})


describe('toSearchRpcArgs', () => {
  it('omits inactive filters rather than sending null', () => {
    const args = toSearchRpcArgs(empty())
    expect(args.p_q).toBeUndefined()
    expect(args.p_levels).toBeUndefined()
    expect(args.p_min_amount_cents).toBeUndefined()
  })

  it('passes the query term through unescaped', () => {
    // The SQL function applies websearch_to_tsquery, which is safe against
    // operator injection. Sanitising here would corrupt legitimate terms.
    expect(toSearchRpcArgs({ ...empty(), q: 'a | b' }).p_q).toBe('a | b')
  })

  it('passes taxonomy groups as arrays', () => {
    const args = toSearchRpcArgs({
      ...empty(),
      level: ['graduate', 'undergraduate'],
      field: ['nursing'],
      category: ['merit-based'],
      location: ['texas'],
      tag: ['renewable'],
    })
    expect(args.p_levels).toEqual(['graduate', 'undergraduate'])
    expect(args.p_fields).toEqual(['nursing'])
    expect(args.p_categories).toEqual(['merit-based'])
    expect(args.p_locations).toEqual(['texas'])
    expect(args.p_tags).toEqual(['renewable'])
  })

  it('converts amounts to integer cents', () => {
    const args = toSearchRpcArgs({ ...empty(), minAmount: 500_000, maxAmount: 2_000_000 })
    expect(args.p_min_amount_cents).toBe(500_000)
    expect(args.p_max_amount_cents).toBe(2_000_000)
  })

  it('clamps the page size to the documented ceiling', () => {
    expect(toSearchRpcArgs(empty(), { pageSize: 5000 }).p_page_size).toBe(
      MAX_PAGE_SIZE,
    )
    expect(toSearchRpcArgs(empty(), { pageSize: 0 }).p_page_size).toBe(1)
    expect(toSearchRpcArgs(empty(), { pageSize: 12 }).p_page_size).toBe(12)
  })

  it('always forwards the sort, deadline window and page', () => {
    const args = toSearchRpcArgs({ ...empty(), sort: 'deadline', deadline: 'week', page: 4 })
    expect(args.p_sort).toBe('deadline')
    expect(args.p_deadline).toBe('week')
    expect(args.p_page).toBe(4)
  })

  it('forwards boolean filters', () => {
    const args = toSearchRpcArgs({
      ...empty(),
      renewable: true,
      freeApplication: true,
      international: true,
    })
    expect(args.p_renewable).toBe(true)
    expect(args.p_free_application).toBe(true)
    expect(args.p_international).toBe(true)
  })

  it('never emits an unchecked sort value', () => {
    for (const raw of ['; DROP TABLE scholarships', 'published_at asc', 'x']) {
      const args = toSearchRpcArgs(parseScholarshipSearch({ sort: raw }))
      expect(args.p_sort).toBe('newest')
    }
  })

  it('produces args that match the generated Database type', () => {
    // Compile-time guarantee: if the SQL signature changes, this line fails.
    const args = toSearchRpcArgs(parseScholarshipSearch({ q: 'nursing', level: 'undergraduate' }))
    const typed: Database['public']['Functions']['search_scholarships']['Args'] = args
    expect(typed.p_levels).toEqual(['undergraduate'])
  })
})