import { describe, expect, it } from 'vitest'

import {
  faqItemSchema,
  faqItemsSchema,
  MAX_FAQ_ITEMS,
  MAX_FAQ_QUESTION_LENGTH,
  normalizeFaqItems,
} from '@/lib/validation/faq'

/**
 * FAQ item validation and normalisation.
 *
 * `normalizeFaqItems` runs on BOTH sides of the boundary: it turns a form
 * payload into something the Zod schema can judge, and it turns the `jsonb`
 * column back into typed items. That second job is the reason it has to be
 * forgiving about shape and strict about content — a row written before a rule
 * changed must not take a page down, and a malformed item must not be able to
 * inject an empty `Question` into the structured data.
 */

describe('normalizeFaqItems', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(normalizeFaqItems(null)).toEqual([])
    expect(normalizeFaqItems(undefined)).toEqual([])
    expect(normalizeFaqItems('question')).toEqual([])
    expect(normalizeFaqItems({ question: 'Q', answer: 'A' })).toEqual([])
  })

  it('keeps a well-formed item and trims it', () => {
    expect(
      normalizeFaqItems([{ question: '  Who reads it?  ', answer: '  The panel.  ' }]),
    ).toEqual([{ question: 'Who reads it?', answer: 'The panel.' }])
  })

  it('drops an item whose question or answer is blank', () => {
    expect(
      normalizeFaqItems([
        { question: '   ', answer: 'An answer to nothing.' },
        { question: 'Real question?', answer: '   ' },
        { question: 'Real question?', answer: 'Real answer.' },
      ]),
    ).toEqual([{ question: 'Real question?', answer: 'Real answer.' }])
  })

  it('drops an item whose fields are not strings', () => {
    expect(
      normalizeFaqItems([
        { question: 42, answer: 'An answer.' },
        { question: 'A question?', answer: null },
        { question: 'A question?', answer: 'An answer.' },
      ]),
    ).toEqual([{ question: 'A question?', answer: 'An answer.' }])
  })

  it('drops an item that is not an object at all', () => {
    expect(normalizeFaqItems(['a string', null, 7])).toEqual([])
  })

  it('caps the list at the maximum, and does so before the malformed ones', () => {
    const many = Array.from({ length: MAX_FAQ_ITEMS + 5 }, (_, index) => ({
      question: `Question ${index}`,
      answer: `Answer ${index}`,
    }))

    const items = normalizeFaqItems(many)

    expect(items).toHaveLength(MAX_FAQ_ITEMS)
    expect(items[0]!.question).toBe('Question 0')
  })

  it('truncates an over-long question and answer rather than storing them', () => {
    const [item] = normalizeFaqItems([
      { question: 'q'.repeat(500), answer: 'a'.repeat(5000) },
    ])

    expect(item!.question.length).toBe(MAX_FAQ_QUESTION_LENGTH)
    expect(item!.answer.length).toBeLessThanOrEqual(2000)
  })
})

describe('faqItemSchema', () => {
  it('accepts a trimmed question and answer', () => {
    const parsed = faqItemSchema.parse({ question: '  Q?  ', answer: '  A.  ' })
    expect(parsed).toEqual({ question: 'Q?', answer: 'A.' })
  })

  it('rejects a blank question', () => {
    expect(faqItemSchema.safeParse({ question: '  ', answer: 'A.' }).success).toBe(false)
  })

  it('rejects a blank answer', () => {
    expect(faqItemSchema.safeParse({ question: 'Q?', answer: '' }).success).toBe(false)
  })

  it('rejects a question longer than the documented limit', () => {
    const parsed = faqItemSchema.safeParse({
      question: 'q'.repeat(MAX_FAQ_QUESTION_LENGTH + 1),
      answer: 'A.',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('faqItemsSchema', () => {
  it('accepts an empty list', () => {
    expect(faqItemsSchema.safeParse([]).success).toBe(true)
  })

  it('rejects more items than the maximum', () => {
    const many = Array.from({ length: MAX_FAQ_ITEMS + 1 }, (_, index) => ({
      question: `Question ${index}`,
      answer: `Answer ${index}`,
    }))

    expect(faqItemsSchema.safeParse(many).success).toBe(false)
  })

  it('rejects a list holding one malformed item', () => {
    const parsed = faqItemsSchema.safeParse([
      { question: 'Good question?', answer: 'Good answer.' },
      { question: '', answer: 'Answer with no question.' },
    ])

    expect(parsed.success).toBe(false)
  })
})
