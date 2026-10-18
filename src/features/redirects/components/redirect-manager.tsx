'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  deleteRedirectAction,
  type RedirectActionResult,
  setRedirectActiveAction,
  updateRedirectAction,
} from '@/features/redirects/actions'
import type { RedirectRow } from '@/features/redirects/queries'
import {
  inputClasses,
  RedirectCreateForm,
  ResultMessage,
} from './redirect-create-form'

/**
 * Redirect list, plus the create form.
 *
 * Three controls per rule, each doing a different thing and each labelled for
 * what it actually does:
 *
 *   Pause / Resume — stops the rule firing without losing it or its audit trail.
 *   Edit          — changes where it points and how permanent it is. The SOURCE
 *                   path is fixed: `from_path` is the primary key, so changing it
 *                   would be a different rule, not an edit.
 *   Delete        — a real delete, behind a two-step inline confirmation.
 *
 * The destructive action uses two real buttons rather than `window.confirm`, so
 * the destructive choice is never the default and the interaction stays
 * keyboard-operable — the same pattern as the article and media screens.
 *
 * Permission checks are NOT here. Every action re-checks `seo.manage` and RLS
 * re-checks it again on the write; this component only decides what to offer.
 */
export function RedirectManager({ initial }: { initial: RedirectRow[] }) {
  return (
    <div className="space-y-6">
      <RedirectCreateForm />

      <section aria-labelledby="redirect-list-heading" className="space-y-3">
        <h2 id="redirect-list-heading" className="text-base font-semibold text-ink-900">
          {initial.length === 0
            ? 'No redirects yet'
            : `${initial.length} redirect${initial.length === 1 ? '' : 's'}`}
        </h2>

        {initial.length === 0 ? (
          <p className="text-sm text-ink-600">
            Nothing is being redirected. Add one above when a record moves address.
          </p>
        ) : (
          <ul className="space-y-3">
            {initial.map((rule) => (
              <li key={rule.from_path}>
                <RedirectCard rule={rule} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function RedirectCard({ rule }: { rule: RedirectRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<RedirectActionResult | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  function run(action: () => Promise<RedirectActionResult>) {
    setState(null)
    startTransition(async () => {
      const result = await action()
      setState(result)
      if (result.ok) router.refresh()
    })
  }

  const isExternal = rule.to_path.startsWith('https://')

  return (
    <article className="rounded-sm border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <code className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-ink-800">
              {rule.from_path}
            </code>
            <span aria-hidden="true" className="text-ink-400">
              →
            </span>
            {isExternal ? (
              <a
                href={rule.to_path}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="truncate text-brand-700 underline underline-offset-4"
              >
                {rule.to_path}
              </a>
            ) : (
              <code className="truncate rounded-sm bg-brand-50 px-1.5 py-0.5 text-brand-800">
                {rule.to_path}
              </code>
            )}
          </p>

          <p className="mt-1.5 text-xs text-ink-500">
            {rule.status_code}
            {rule.is_active ? '' : ' · paused'}
            {rule.note ? ` · ${rule.note}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {editing ? null : (
            <>
              <Action
                label="Edit"
                disabled={pending}
                onClick={() => setEditing(true)}
              />
              <Action
                label={rule.is_active ? 'Pause' : 'Resume'}
                disabled={pending}
                onClick={() =>
                  run(() => setRedirectActiveAction(rule.from_path, !rule.is_active))
                }
              />
              <Action
                label="Delete"
                disabled={pending}
                tone="danger"
                onClick={() => setConfirmingDelete(true)}
              />
            </>
          )}

          {confirmingDelete ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmingDelete(false)
                  run(() => deleteRedirectAction(rule.from_path))
                }}
                className="rounded-sm bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                Cancel
              </button>
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        {editing ? (
          /*
           * The SOURCE path is shown as fixed text rather than an input.
           * `from_path` is the primary key, so editing it would be deleting this
           * rule and creating another one — and offering an input that silently
           * ignored what the editor typed is exactly the kind of control that
           * looks real and does nothing.
           */
          <form
            action={(formData) =>
              run(async () => {
                const result = await updateRedirectAction(null, formData)
                if (result.ok) setEditing(false)
                return result
              })
            }
            className="grid gap-3 border-t border-ink-100 pt-3 sm:grid-cols-2"
          >
            <input type="hidden" name="from" value={rule.from_path} />

            <div className="sm:col-span-2">
              <span className="block text-sm font-medium text-ink-800">
                Old path (cannot be changed)
              </span>
              <code className="mt-1.5 block rounded-sm bg-ink-100 px-2 py-1.5 text-sm text-ink-700">
                {rule.from_path}
              </code>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor={`to-${rule.from_path}`}
                className="block text-sm font-medium text-ink-800"
              >
                New path
              </label>
              <input
                id={`to-${rule.from_path}`}
                name="to"
                type="text"
                required
                defaultValue={rule.to_path}
                className={`mt-1.5 ${inputClasses}`}
              />
            </div>

            <div>
              <label
                htmlFor={`status-${rule.from_path}`}
                className="block text-sm font-medium text-ink-800"
              >
                Type
              </label>
              <select
                id={`status-${rule.from_path}`}
                name="statusCode"
                defaultValue={String(rule.status_code)}
                className={`mt-1.5 ${inputClasses}`}
              >
                <option value="301">301 — Permanent</option>
                <option value="302">302 — Temporary</option>
                <option value="307">307 — Temporary, keeps the method</option>
                <option value="308">308 — Permanent, keeps the method</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`note-${rule.from_path}`}
                className="block text-sm font-medium text-ink-800"
              >
                Note
              </label>
              <input
                id={`note-${rule.from_path}`}
                name="note"
                type="text"
                defaultValue={rule.note ?? ''}
                className={`mt-1.5 ${inputClasses}`}
              />
            </div>

            <div className="flex items-center gap-1.5 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setState(null)
                }}
                className="rounded-sm border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <ResultMessage state={state} />
      </div>
    </article>
  )
}

function Action({
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled: boolean
  tone?: 'default' | 'danger'
}) {
  const tones = {
    default:
      'border border-ink-300 text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500',
    danger:
      'border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  )
}