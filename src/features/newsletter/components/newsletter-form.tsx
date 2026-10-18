'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  describedBy,
  FormField,
  inputClasses,
} from '@/features/auth/components/form-field'

import { subscribeToNewsletter } from '../actions'
import { NEWSLETTER_HONEYPOT_FIELD } from '@/lib/validation/newsletter'

/**
 * Newsletter signup form.
 *
 * A single field, so the interaction budget is small: no client-side "is this
 * valid" noise, and the server decides. `aria-live` on the result region is what
 * makes the outcome perceivable without moving focus — this form sits in the
 * footer, so stealing focus would yank the visitor out of whatever they were
 * reading.
 *
 * The honeypot and the fill-time stamp follow the same pattern as the contact
 * form. See `src/features/newsletter/actions.ts` for what they do and do not
 * protect against.
 */
export function NewsletterForm() {
  const [state, action] = useActionState(subscribeToNewsletter, null)
  const startedAtRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (startedAtRef.current) {
      startedAtRef.current.value = String(Date.now())
    }
  }, [])

  /*
   * React resets a `<form action>` once the action resolves. On success the
   * address should disappear — it is now in the database and repeating it on
   * screen is noise. The documented "adjust during render" pattern is used rather
   * than an effect, to avoid a cascading render.
   */
  const [lastState, setLastState] = useState(state)
  if (state !== lastState) {
    setLastState(state)
    if (state?.ok) setDraft('')
    else if (state?.values) setDraft(state.values.email ?? draft)
  }

  return (
    <form action={action} className="relative" noValidate>
      <input
        ref={startedAtRef}
        type="hidden"
        name="renderedAt"
        defaultValue=""
      />

      {/* Honeypot: off-screen, `aria-hidden`, and removed from the tab order. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor={NEWSLETTER_HONEYPOT_FIELD}>
          Leave this field empty
        </label>
        <input
          id={NEWSLETTER_HONEYPOT_FIELD}
          name={NEWSLETTER_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <FormField
        id="newsletter-email"
        label="Email address"
        error={state?.ok === false ? state.fieldErrors?.email : undefined}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="newsletter-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={320}
            spellCheck={false}
            placeholder="you@example.org"
            className={inputClasses}
            aria-invalid={state?.ok === false && Boolean(state.fieldErrors?.email)}
            aria-describedby={describedBy(
              'newsletter-email',
              state?.ok === false ? state.fieldErrors?.email : undefined,
            )}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <SubmitButton />
        </div>
      </FormField>

      {/*
        `role="status"` on success is polite, so it is announced without
        interrupting; `Alert` uses `role="alert"` only for the error tone.
      */}
      {state ? (
        <div className="mt-3">
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      ) : null}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="sm:shrink-0">
      {pending ? 'Signing up…' : 'Sign up'}
    </Button>
  )
}