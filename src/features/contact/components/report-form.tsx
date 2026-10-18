'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  describedBy,
  FormField,
  inputClasses,
} from '@/features/auth/components/form-field'

import { submitReportAction } from '../actions'
import {
  HONEYPOT_FIELD,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTarget,
} from '@/lib/validation/contact'

/**
 * "Report incorrect information" form.
 *
 * Reached from every scholarship and article page as
 * `/contact?type=report&slug=…`, so the record being reported is identified
 * before anything is typed. The slug is carried in a hidden input and resolved to
 * a row id server-side through the session client, so an RLS-invisible record
 * cannot be reported, and cannot be probed for by guessing slugs.
 *
 * The email address is OPTIONAL here, unlike the contact form. A report about a
 * wrong deadline should not require an account or an address to file, and the
 * report is still actionable without one.
 */
export function ReportForm({
  target,
  slug,
  recordTitle,
}: {
  target: ReportTarget
  slug: string
  /** The record's own title, so the visitor can see what they are reporting. */
  recordTitle: string | null
}) {
  const [state, action] = useActionState(submitReportAction, null)
  const statusRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<HTMLInputElement>(null)

  const sent = state?.ok === true

  // See the longer explanation in contact-form.tsx: controlled fields are what
  // survive React's post-action form reset, so a rejected report does not wipe
  // what the visitor typed.
  const [draft, setDraft] = useState({ reason: '', details: '', email: '' })

  // See the longer explanation in contact-form.tsx: the documented
  // "adjust state during render" pattern, not a setState-in-effect cascade.
  const [lastState, setLastState] = useState(state)
  if (state !== lastState) {
    setLastState(state)
    if (state?.ok) {
      setDraft({ reason: '', details: '', email: '' })
    } else if (state?.values) {
      setDraft((current) => ({
        reason: state.values?.reason ?? current.reason,
        details: state.values?.details ?? current.details,
        email: state.values?.email ?? current.email,
      }))
    }
  }

  // See the equivalent note in contact-form.tsx: an effect, not a render-phase
  // `Date.now()`, because render must stay idempotent.
  useEffect(() => {
    if (startedAtRef.current) {
      startedAtRef.current.value = String(Date.now())
    }
  }, [])

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      statusRef.current?.focus()
      return
    }
    const firstError = Object.keys(state.fieldErrors ?? {})[0]
    // The email input's element id is `report-email`, not `email`, because the
    // contact form on the same page family also uses `email`. Mapping explicitly
    // beats assuming the schema key is the DOM id.
    const elementId = firstError === 'email' ? 'report-email' : firstError
    if (elementId) document.getElementById(elementId)?.focus()
    else statusRef.current?.focus()
  }, [state])

  return (
    <form action={action} className="relative space-y-5" noValidate>
      <input
        ref={startedAtRef}
        type="hidden"
        name="renderedAt"
        defaultValue=""
      />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="slug" value={slug} />

      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor={`${HONEYPOT_FIELD}-report`}>
          Leave this field empty
        </label>
        <input
          id={`${HONEYPOT_FIELD}-report`}
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
          <FormField id="reason" label="What is wrong?">
            <select
              id="reason"
              name="reason"
              required
              className={inputClasses}
              value={draft.reason}
              onChange={(event) =>
                setDraft((d) => ({ ...d, reason: event.target.value }))
              }
            >
              <option value="" disabled>
                Choose the closest match
              </option>
              {REPORT_REASONS.map((reason: ReportReason) => (
                <option key={reason} value={reason}>
                  {REPORT_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="details"
            label="Tell us what we should change"
            hint="Please include the correct detail if you know it."
            error={state?.ok === false ? state.fieldErrors?.details : undefined}
          >
            <textarea
              id="details"
              name="details"
              rows={5}
              maxLength={2000}
              className={inputClasses}
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.details)
              }
              aria-describedby={describedBy(
                'details',
                state?.ok === false ? state.fieldErrors?.details : undefined,
                'Please include the correct detail if you know it.',
              )}
              value={draft.details}
              onChange={(event) =>
                setDraft((d) => ({ ...d, details: event.target.value }))
              }
            />
          </FormField>

          <FormField
            id="report-email"
            label="Your email address"
            hint="Optional. Only so we can tell you what we changed."
            error={state?.ok === false ? state.fieldErrors?.email : undefined}
          >
            <input
              id="report-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={320}
              spellCheck={false}
              className={inputClasses}
              aria-invalid={
                state?.ok === false && Boolean(state.fieldErrors?.email)
              }
              aria-describedby={describedBy(
                'report-email',
                state?.ok === false ? state.fieldErrors?.email : undefined,
                'Optional. Only so we can tell you what we changed.',
              )}
              value={draft.email}
              onChange={(event) =>
                setDraft((d) => ({ ...d, email: event.target.value }))
              }
            />
          </FormField>

          <SubmitButton />

          <p className="text-sm text-ink-600">
            Reporting{' '}
            {recordTitle ? (
              <span className="font-medium text-ink-800">{recordTitle}</span>
            ) : (
              'this record'
            )}{' '}
            is the fastest way to get it corrected.{' '}
            <Link
              href="/contact"
              className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
            >
              Send a general message
            </Link>{' '}
            instead if this is not a correction.
          </p>
        </>
      )}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send report'}
    </Button>
  )
}