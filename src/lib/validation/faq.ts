import { z } from 'zod'

/**
 * FAQ items — the question-and-answer pairs an article may publish.
 *
 * One shape, three consumers: the CMS form that collects them, the public page
 * that renders them, and the JSON-LD builder that describes them. They all read
 * this module, so "what counts as a valid FAQ item" is decided once.
 *
 * The answers are PLAIN TEXT, not HTML. Two reasons:
 *
 *   - Google's `FAQPage` markup accepts HTML in an answer, but the text has to
 *     match what is visible on the page. Keeping the stored answer plain makes
 *     that a structural guarantee rather than a promise: the same string is
 *     rendered in the accordion and in the `acceptedAnswer.text`, so they
 *     cannot drift apart.
 *   - A plain string cannot carry a script tag, so the answer needs no
 *     sanitising at render time. The JSON-LD serializer still escapes `<`,
 *     `>` and `&` — see `serializeJsonLd` — but there is nothing to escape.
 *
 * Limits mirror the database CHECK constraint in migration 039. The database
 * remains the authority; this is here so an editor gets a field message instead
 * of a raw Postgres error.
 */

/** Maximum number of questions on one article. */
export const MAX_FAQ_ITEMS = 20

/** Maximum length of a question. */
export const MAX_FAQ_QUESTION_LENGTH = 300

/** Maximum length of an answer. */
export const MAX_FAQ_ANSWER_LENGTH = 2000

/** One question and its answer. */
export type FAQItem = {
  question: string
  answer: string
}

/** A single FAQ item, as validated on the way in. */
export const faqItemSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'A question is required.')
    .max(MAX_FAQ_QUESTION_LENGTH, `A question must be ${MAX_FAQ_QUESTION_LENGTH} characters or fewer.`),
  answer: z
    .string()
    .trim()
    .min(1, 'An answer is required.')
    .max(MAX_FAQ_ANSWER_LENGTH, `An answer must be ${MAX_FAQ_ANSWER_LENGTH} characters or fewer.`),
})

/** A list of FAQ items. */
export const faqItemsSchema = z
  .array(faqItemSchema)
  .max(MAX_FAQ_ITEMS, `An article can carry at most ${MAX_FAQ_ITEMS} questions.`)

/**
 * Coerce unknown input into a clean list of FAQ items.
 *
 * This is the reader used on BOTH sides of the boundary:
 *
 *   - the CMS action, turning a `FormData` payload into something the Zod
 *     schema can judge;
 *   - the public query, turning the `jsonb` column back into typed items.
 *
 * It is deliberately forgiving about SHAPE (a missing key, a number where a
 * string was expected, a stray `null` in the array) and strict about CONTENT
 * (both fields must be non-blank strings). The reason is that this function
 * also runs against data already in the database: a row written before a rule
 * changed must not take a page down, and a malformed item must not be able to
 * inject an empty `Question` into the structured data.
 *
 * Items that fail are DROPPED rather than repaired. An FAQ with one broken
 * entry is still a true statement about the questions that are left; an FAQ
 * with a blank question is not a statement at all.
 */
export function normalizeFaqItems(input: unknown): FAQItem[] {
  if (!Array.isArray(input)) return []

  const items: FAQItem[] = []

  for (const entry of input) {
    if (items.length >= MAX_FAQ_ITEMS) break

    if (typeof entry !== 'object' || entry === null) continue

    const record = entry as Record<string, unknown>
    const question = record.question
    const answer = record.answer

    if (typeof question !== 'string' || typeof answer !== 'string') continue

    const trimmedQuestion = question.trim()
    const trimmedAnswer = answer.trim()

    if (trimmedQuestion.length === 0 || trimmedAnswer.length === 0) continue

    items.push({
      question: trimmedQuestion.slice(0, MAX_FAQ_QUESTION_LENGTH),
      answer: trimmedAnswer.slice(0, MAX_FAQ_ANSWER_LENGTH),
    })
  }

  return items
}
