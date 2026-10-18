'use client'

import { type ReactNode, useRef } from 'react'

/**
 * Filter form that submits itself when a control changes.
 *
 * PROGRESSIVE ENHANCEMENT, NOT A REPLACEMENT
 *
 * This renders a plain `<form action="/scholarships" method="get">`. Nothing
 * about filtering moved into the browser: the form still submits normally, the
 * results still come from a server round trip, and every state is still a
 * shareable URL. The only thing added is that with JavaScript available, ticking
 * a checkbox submits immediately instead of waiting for a button press.
 *
 * The "Apply filters" button is therefore wrapped in `<noscript>` by the caller.
 * Removing it outright would break filtering for anyone without JavaScript,
 * which is the one case where a submit button is not redundant.
 *
 * `requestSubmit()` rather than `form.submit()`: the latter skips constraint
 * validation and fires no `submit` event, so the browser's own invalid-state UI
 * would be bypassed. With no submitter argument the form submits without a
 * pressed button, which is what makes the noscript-only button viable.
 *
 * Note on what this does NOT do: it does not debounce, and it does not filter
 * client-side. Ticking three boxes in quick succession starts three navigations;
 * the App Router discards superseded ones, so the last one wins. A `useTransition`
 * pending indicator would need to own the navigation, and doing that here would
 * mean no longer using a real form.
 */
export function AutoSubmitForm({
  action,
  className,
  children,
}: {
  /** Same-origin GET target. A full navigation, so Back and sharing work. */
  action: string
  className?: string
  children: ReactNode
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      className={className}
      onChange={(event) => {
        // Only real controls drive this. `event.target` is the element that
        // changed; typing into a text input that is debounced upstream, or any
        // future non-control child, must not submit.
        const target = event.target
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLSelectElement)
        ) {
          return
        }

        formRef.current?.requestSubmit()
      }}
    >
      {children}
    </form>
  )
}