import { describe, expect, it } from 'vitest'

import {
  daysUntil,
  formatAwardAmount,
  formatCurrency,
  formatDate,
  formatDeadlineNote,
  formatDateShort,
  getDeadlineState,
  parseDateOnly,
  readingTime,
} from '@/lib/format'
import { cn } from '@/lib/utils/cn'

const TODAY = new Date(Date.UTC(2026, 9, 15)) // 15 October 2026

describe('formatCurrency', () => {
  it('formats integer cents as dollars', () => {
    expect(formatCurrency(500_000)).toBe('$5,000')
    expect(formatCurrency(2_500_000)).toBe('$25,000')
  })

  it('returns an empty string for unusable input', () => {
    expect(formatCurrency(null)).toBe('')
    expect(formatCurrency(undefined)).toBe('')
    expect(formatCurrency(Number.NaN)).toBe('')
  })

  it('compacts large amounts', () => {
    expect(formatCurrency(1_000_000_00, { compact: true })).toBe('$1M')
    expect(formatCurrency(500_000_00, { compact: true })).toBe('$500k')
    expect(formatCurrency(2_500_000_00, { compact: true })).toBe('$2.5M')
  })
})

describe('formatAwardAmount', () => {
  it('prefers free text over a computed range', () => {
    expect(formatAwardAmount(100, 200, 'Full tuition')).toBe('Full tuition')
  })

  it('renders a range when min and max differ', () => {
    expect(formatAwardAmount(500_000, 1_000_000, null)).toBe(
      '$5,000 - $10,000',
    )
  })

  it('renders a single value when min equals max', () => {
    expect(formatAwardAmount(500_000, 500_000, null)).toBe('$5,000')
  })

  it('uses max when only max is known', () => {
    expect(formatAwardAmount(null, 750_000, null)).toBe('$7,500')
  })

  it('says so plainly when nothing is known', () => {
    expect(formatAwardAmount(null, null, null)).toBe('Amount not specified')
    expect(formatAwardAmount(null, null, '   ')).toBe('Amount not specified')
  })
})

describe('parseDateOnly', () => {
  it('parses a plain calendar date as UTC', () => {
    const d = parseDateOnly('2026-10-15')
    expect(d?.getUTCFullYear()).toBe(2026)
    expect(d?.getUTCMonth()).toBe(9)
    expect(d?.getUTCDate()).toBe(15)
  })

  it('rejects roll-over dates', () => {
    // 31 February must not silently become 3 March.
    expect(parseDateOnly('2026-02-31')).toBeNull()
  })

  it('rejects malformed and missing input', () => {
    expect(parseDateOnly(null)).toBeNull()
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('not-a-date')).toBeNull()
    expect(parseDateOnly('15/10/2026')).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats in a readable long form', () => {
    expect(formatDate('2026-10-15')).toBe('15 October 2026')
    expect(formatDateShort('2026-10-15')).toBe('15 Oct 2026')
  })

  it('returns an empty string for invalid input', () => {
    expect(formatDate('nope')).toBe('')
    expect(formatDate(null)).toBe('')
  })
})

describe('getDeadlineState', () => {
  it('treats rolling awards as always open', () => {
    expect(getDeadlineState(null, true, TODAY)).toBe('rolling')
    expect(getDeadlineState('2020-01-01', true, TODAY)).toBe('rolling')
  })

  it('classifies past deadlines as closed', () => {
    expect(getDeadlineState('2026-10-14', false, TODAY)).toBe('closed')
  })

  it('classifies today separately', () => {
    expect(getDeadlineState('2026-10-15', false, TODAY)).toBe('today')
  })

  it('classifies three days or fewer as soon', () => {
    expect(getDeadlineState('2026-10-16', false, TODAY)).toBe('soon')
    expect(getDeadlineState('2026-10-18', false, TODAY)).toBe('soon')
    expect(getDeadlineState('2026-10-19', false, TODAY)).toBe('open')
  })

  it('classifies a missing deadline as unknown', () => {
    expect(getDeadlineState(null, false, TODAY)).toBe('unknown')
  })
})

describe('daysUntil', () => {
  it('counts forward and backward', () => {
    expect(daysUntil('2026-10-25', TODAY)).toBe(10)
    expect(daysUntil('2026-10-10', TODAY)).toBe(-5)
    expect(daysUntil('2026-10-15', TODAY)).toBe(0)
  })

  it('returns null when unknown', () => {
    expect(daysUntil(null, TODAY)).toBeNull()
  })
})

describe('formatDeadlineNote', () => {
  it('describes each state in plain language', () => {
    expect(formatDeadlineNote(null, true, TODAY)).toBe(
      'Applications open all year',
    )
    expect(formatDeadlineNote('2026-10-15', false, TODAY)).toBe('Closes today')
    expect(formatDeadlineNote('2026-10-16', false, TODAY)).toBe(
      'Closes tomorrow',
    )
    expect(formatDeadlineNote('2026-10-25', false, TODAY)).toBe(
      'Closes in 10 days',
    )
    expect(formatDeadlineNote('2026-10-14', false, TODAY)).toBe(
      'Closed 1 day ago',
    )
    expect(formatDeadlineNote('2026-10-10', false, TODAY)).toBe(
      'Closed 5 days ago',
    )
  })

  it('never says "null days"', () => {
    for (const value of [null, '', 'garbage', undefined]) {
      expect(formatDeadlineNote(value, false, TODAY)).not.toContain('null')
    }
  })
})

describe('readingTime', () => {
  it('rounds to whole minutes with a floor of one', () => {
    expect(readingTime(0)).toBe('1 min read')
    expect(readingTime(220)).toBe('1 min read')
    expect(readingTime(660)).toBe('3 min read')
  })
})

describe('cn', () => {
  it('joins strings and drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('flattens arrays and supports conditional objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })

  it('supports Tailwind-style overrides', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('px-2 py-1 px-4')
  })
})
