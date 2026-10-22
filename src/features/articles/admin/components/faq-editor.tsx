'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormField, inputClasses } from '@/features/auth/components/form-field'
import { type FAQItem, MAX_FAQ_ITEMS } from '@/lib/validation/faq'

/**
 * The FAQ editor for an article.
 *
 * A client component: the editor needs to add and remove rows, and the rows
 * have to be removed from the DOM (not merely hidden) so the browser stops
 * submitting them. Each row posts one `faq_question` and one `faq_answer`
 * input; the Server Action pairs them by index.
 *
 * The two field names are deliberately shared by every row rather than being
 * indexed (`faq_question[0]`). `FormData.getAll()` returns values in document
 * order, so one list of questions and one list of answers zip back into the
 * same rows they came from — and a row that is removed from the DOM removes its
 * entry from BOTH lists, so the two can never drift out of step.
 *
 * The stored answers are plain text. This component renders them in a
 * `<textarea>`, not a rich-text editor, on purpose: Google requires the text
 * inside a `FAQPage` markup block to be visible on the page, and a plain
 * string is the only way to guarantee the marked-up answer and the visible
 * answer are the same characters.
 */

type FaqRow = {
  /** Stable key, so React does not reuse an input's DOM node when a row moves. */
  key: number
  question: string
  answer: string
}

export function FaqEditor({ initial }: { initial: FAQItem[] }) {
  const [rows, setRows] = useState<FaqRow[]>(() =>
    initial.map((item, index) => ({
      key: index,
      question: item.question,
      answer: item.answer,
    })),
  )

  // A counter, not `rows.length`: removing a row and adding one back must not
  // reuse a key, or React will keep the old input's DOM node and the caret
  // will jump.
  const nextKey = useRef(initial.length)

  const addRow = () => {
    setRows((current) => {
      if (current.length >= MAX_FAQ_ITEMS) return current
      const key = nextKey.current
      nextKey.current += 1
      return [...current, { key, question: '', answer: '' }]
    })
  }

  const removeRow = (key: number) => {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  const updateRow = (key: number, field: 'question' | 'answer', value: string) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    )
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">
          No questions yet. A published article with questions gets FAQ
          structured data and a visible question-and-answer block.
        </p>
      ) : null}

      {rows.map((row, index) => {
        const questionId = `faq-question-${row.key}`
        const answerId = `faq-answer-${row.key}`

        return (
          <fieldset
            key={row.key}
            className="rounded-sm border border-ink-200 bg-ink-50/60 p-4"
          >
            <legend className="px-1 text-xs font-semibold tracking-wide text-ink-600 uppercase">
              Question {index + 1}
            </legend>

            <div className="mt-2 space-y-3">
              <FormField id={questionId} label="Question">
                <input
                  id={questionId}
                  name="faq_question"
                  type="text"
                  maxLength={300}
                  className={inputClasses}
                  value={row.question}
                  onChange={(event) =>
                    updateRow(row.key, 'question', event.target.value)
                  }
                />
              </FormField>

              <FormField
                id={answerId}
                label="Answer"
                hint="Plain text. It appears on the page exactly as written here."
              >
                <textarea
                  id={answerId}
                  name="faq_answer"
                  rows={4}
                  maxLength={2000}
                  className={inputClasses}
                  value={row.answer}
                  onChange={(event) =>
                    updateRow(row.key, 'answer', event.target.value)
                  }
                />
              </FormField>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeRow(row.key)}
                >
                  Remove question {index + 1}
                </Button>
              </div>
            </div>
          </fieldset>
        )
      })}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          disabled={rows.length >= MAX_FAQ_ITEMS}
        >
          Add question
        </Button>
        <p className="text-xs text-ink-500">
          {rows.length} of {MAX_FAQ_ITEMS} used.
        </p>
      </div>
    </div>
  )
}
