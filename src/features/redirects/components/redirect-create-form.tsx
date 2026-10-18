'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  createRedirectAction,
  type RedirectActionResult,
} from '@/features/redirects/actions'

/**
 * Create form for a redirect rule.
 *
 * A `useActionState` form rather than a fetch, matching the other CMS forms in
 * this codebase. Field errors come back from the Server Action so the messages
 * are the ones the validator produced — the client never decides what is valid.
 *
 * The form clears itself only on success. Clearing on failure would discard the
 * editor's work at exactly the moment they need to correct it.
 */
export function RedirectCreateForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<RedirectActionResult | null>(null)
  const [resetKey, setResetKey] = useState(0)

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createRedirectAction(null, formData)
      setState(result)
      if (result.ok) {
        setResetKey((key) => key + 1)
        router.refresh()
      }
    })
  }

  return (
    <section
      aria-labelledby="add-redirect-heading"
      className="rounded-sm border border-ink-200 bg-white p-5"
    >
      <h2 id="add-redirect-heading" className="text-base font-semibold text-ink-900">
        Add a redirect
      </h2>

      <form
        key={resetKey}
        action={submit}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <Field
          id="from"
          label="Old path"
          hint="The address that has moved, e.g. /scholarships/old-award"
          error={state?.ok === false ? state.fieldErrors?.from : undefined}
        >
          <input
            id="from"
            name="from"
            type="text"
            required
            placeholder="/old-address"
            className={inputClasses}
          />
        </Field>

        <Field
          id="to"
          label="New path"
          hint="A path on this site, or a full https:// address."
          error={state?.ok === false ? state.fieldErrors?.to : undefined}
        >
          <input
            id="to"
            name="to"
            type="text"
            required
            placeholder="/new-address"
            className={inputClasses}
          />
        </Field>

        <Field id="statusCode" label="Type">
          <select
            id="statusCode"
            name="statusCode"
            defaultValue="301"
            className={inputClasses}
          >
            <option value="301">301 — Permanent (use for moved pages)</option>
            <option value="302">302 — Temporary (use while testing)</option>
            <option value="307">307 — Temporary, keeps the method</option>
            <option value="308">308 — Permanent, keeps the method</option>
          </select>
        </Field>

        <Field
          id="note"
          label="Note (optional)"
          hint="Why this redirect exists — kept in the audit log."
          error={state?.ok === false ? state.fieldErrors?.note : undefined}
        >
          <input id="note" name="note" type="text" className={inputClasses} />
        </Field>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Add redirect'}
          </button>
        </div>

        <div className="sm:col-span-2">
          <ResultMessage state={state} />
        </div>
      </form>
    </section>
  )
}

export function ResultMessage({ state }: { state: RedirectActionResult | null }) {
  if (!state) return null

  return (
    <p
      role={state.ok ? 'status' : 'alert'}
      className={`text-sm ${state.ok ? 'text-ink-600' : 'text-red-700'}`}
    >
      {state.message}
    </p>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string | undefined
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const inputClasses =
  'block w-full rounded-sm border border-ink-300 bg-white px-2.5 py-2 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none'