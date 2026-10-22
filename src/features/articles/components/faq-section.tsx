import type { FAQItem } from '@/lib/validation/faq'

/**
 * The visible FAQ block on an article page.
 *
 * ## Why this exists next to the JSON-LD
 *
 * Google requires the text inside a `FAQPage` markup block to be **visible to
 * the user on the page**. Marking up questions that a reader cannot see is a
 * policy violation, not an optimisation. So the schema and the visible block
 * are driven by the SAME array of `FAQItem`s: whatever the page renders is
 * exactly what `faqLd()` describes.
 *
 * ## Why `<details>` and not a JavaScript accordion
 *
 * `<details>`/`<summary>` is native HTML. It opens with the keyboard, it
 * works with JavaScript disabled, it is announced correctly by screen
 * readers, and the answer text is present in the document rather than being
 * fetched on click — which is what a crawler reads. A custom accordion built
 * from buttons and `aria-expanded` would be more code to get wrong and would
 * hide the answers from anything that does not execute JavaScript.
 *
 * The homepage FAQ block (`src/app/(public)/page.tsx`) uses the same pattern,
 * so the two read as one system.
 *
 * A Server Component: there is no state, no effect and no event handler here.
 */

export function FAQSection({
  faqs,
  heading = 'Frequently asked questions',
}: {
  faqs: FAQItem[]
  heading?: string
}) {
  // Nothing to show, so nothing is rendered. The JSON-LD builder declines in
  // the same case, and the two must agree — a visible heading with no
  // questions under it would look broken.
  if (faqs.length === 0) return null

  return (
    <section
      aria-labelledby="article-faq-heading"
      className="mt-10 border-t border-ink-200 pt-8"
    >
      <h2
        id="article-faq-heading"
        className="text-xl font-bold tracking-tight text-ink-900"
      >
        {heading}
      </h2>

      <div className="mt-4 divide-y divide-ink-200 rounded-xl bg-white ring-1 ring-ink-200">
        {faqs.map((item, index) => (
          <details key={`${index}-${item.question}`} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.question}
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-ink-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            {/*
              The answer is plain text, stored that way on purpose, so it is
              rendered as a text node — there is no markup here to sanitise.
            */}
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
