'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { describedBy, FormField, inputClasses } from '@/features/auth/components/form-field'

import { submitContactAction } from '../actions'
import {
  CONTACT_SUBJECTS,
  CONTACT_SUBJECT_LABELS,
  type ContactSubject,
  HONEYPOT_FIELD,
} from '@/lib/validation/contact'

/**
 * Contact form.
 *
 * A Server Action rather than a plain POST, so the visitor gets an inline result
 * without a page reload. It is the only interactive part of `/contact`; the rest
 * of the page is a Server Component.
 *
 * Accessibility notes that are easy to get wrong and therefore deliberate:
 *
 *   - the form-level error is in an `Alert`, i.e. `role="alert"`, so it is
 *     announced the moment it arrives instead of being found by tabbing;
 *   - the success message is `role="status"` — polite, so it does not interrupt;
 *   - each field error is linked by `aria-describedby` and flagged with
 *     `aria-invalid`, and the message text is always present, never conveyed by
 *     colour alone;
 *   - focus moves to the confirmation once a message is accepted, which is what
 *     a screen-reader user needs after a form disappears from under them.
 */
export function ContactForm({
  defaultSubject,
}: {
  defaultSubject?: ContactSubject
}) {
  const [state, action] = useActionState(submitContactAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<HTMLInputElement>(null)

  /*
   * The fields are CONTROLLED, and that is the whole fix for a data-loss bug.
   *
   * React resets a `<form action={…}>` once the action resolves, which is
   * desirable on success and destructive on failure: a visitor who mistypes their
   * email would otherwise lose the message they just wrote. React's own reset
   * sets the DOM values, so re-supplying the same values as `defaultValue`
   * afterwards does not help — the inputs are not remounted.
   *
   * Holding the draft in state means the next render puts the submitted text back,
   * which both survives the reset and keeps focus where the visitor left it.
   */
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    subject: defaultSubject ?? '',
    message: '',
  })

  const sent = state?.ok === true

  /*
   * React's documented "adjust state during render" pattern — the same one used
   * in `admin-shell.tsx`. Deriving the restored draft from the action result in
   * an effect would cascade a second render; doing it here lets React discard the
   * in-progress output and re-render once with the correct draft.
   */
  const [lastState, setLastState] = useState(state)
  if (state !== lastState) {
    setLastState(state)

    if (state?.ok) {
      setDraft({ name: '', email: '', subject: '', message: '' })
    } else if (state?.values) {
      setDraft((current) => ({
        name: state.values?.name ?? current.name,
        email: state.values?.email ?? current.email,
        subject: state.values?.subject ?? current.subject,
        message: state.values?.message ?? current.message,
      }))
    }
  }

  /*
   * Stamp the moment the form became usable.
   *
   * Written in an effect rather than during render: `Date.now()` is impure, and
   * a render-phase call would produce a different value on every re-render,
   * which is exactly what React's purity rule exists to prevent.
   *
   * Assigning through the ref reaches an uncontrolled input's live DOM value,
   * which is what the action actually reads when the form is serialised.
   */
  useEffect(() => {
    if (startedAtRef.current) {
      startedAtRef.current.value = String(Date.now())
    }
  }, [])

  // Clear the form after a successful send. Only the fields are reset — the
  // confirmation stays, because that is the answer to "did it work?".
  useEffect(() => {
    if (sent) formRef.current?.reset()
  }, [sent])

  /*
   * On rejection, focus the FIRST field that failed rather than the alert.
   * "Check the highlighted fields" is only actionable if the caret is already
   * somewhere near them. On success there is nothing to correct, so the
   * confirmation itself takes focus.
   */
  useEffect(() => {
    if (!state) return
    if (state.ok) {
      statusRef.current?.focus()
      return
    }
    const firstError = Object.keys(state.fieldErrors ?? {})[0]
    if (firstError) document.getElementById(firstError)?.focus()
    else statusRef.current?.focus()
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      className="relative space-y-5"
      noValidate
    >
      {/*
        Referenced by `startedAtRef` above. Empty until the effect runs, and the
        action treats an empty stamp as "no timing evidence" rather than as a
        failure, so the check can never block a genuine first submission.
      */}
      <input
        ref={startedAtRef}
        type="hidden"
        name="renderedAt"
        defaultValue=""
      />

      {/*
        Honeypot. Hidden from sight and from the accessibility tree, and removed
        from the tab order, so a person cannot reach it by accident while a bot
        will fill it in. `tabIndex={-1}` and `aria-hidden` together matter: CSS
        alone would leave it announced to a screen reader.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div
        ref={statusRef}
        tabIndex={-1}
        className="focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        {state ? (
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        ) : null}
      </div>

      {sent ? null : (
        <>
          <FormField
            id="name"
            label="Your name"
            error={state?.ok === false ? state.fieldErrors?.name : undefined}
          >
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              className={inputClasses}
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.name)
              }
              aria-describedby={describedBy(
                'name',
                state?.ok === false ? state.fieldErrors?.name : undefined,
              )}
              value={draft.name}
              onChange={(event) =>
                setDraft((d) => ({ ...d, name: event.target.value }))
              }
            />
          </FormField>

          <FormField
            id="email"
            label="Your email address"
            hint="We use this only to reply to you."
            error={state?.ok === false ? state.fieldErrors?.email : undefined}
          >
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={320}
              spellCheck={false}
              className={inputClasses}
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.email)
              }
              aria-describedby={describedBy(
                'email',
                state?.ok === false ? state.fieldErrors?.email : undefined,
                'We use this only to reply to you.',
              )}
              value={draft.email}
              onChange={(event) =>
                setDraft((d) => ({ ...d, email: event.target.value }))
              }
            />
          </FormField>

          <FormField
            id="subject"
            label="What is this about?"
            error={state?.ok === false ? state.fieldErrors?.subject : undefined}
          >
            <select
              id="subject"
              name="subject"
              required
              className={inputClasses}
              value={draft.subject}
              onChange={(event) =>
                setDraft((d) => ({ ...d, subject: event.target.value }))
              }
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.subject)
              }
              aria-describedby={describedBy(
                'subject',
                state?.ok === false ? state.fieldErrors?.subject : undefined,
              )}
            >
              <option value="" disabled>
                Choose a subject
              </option>
              {CONTACT_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {CONTACT_SUBJECT_LABELS[subject]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="message"
            label="Message"
            hint="If you are reporting something on the site, please name the record."
            error={state?.ok === false ? state.fieldErrors?.message : undefined}
          >
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              maxLength={5000}
              className={inputClasses}
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.message)
              }
              aria-describedby={describedBy(
                'message',
                state?.ok === false ? state.fieldErrors?.message : undefined,
                'If you are reporting something on the site, please name the record.',
              )}
              value={draft.message}
              onChange={(event) =>
                setDraft((d) => ({ ...d, message: event.target.value }))
              }
            />
          </FormField>

          <SubmitButton />
        </>
      )}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  )
}