import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Labelled form control.
 *
 * Accessibility is structural, not cosmetic here:
 *   - the `<label>` is a real `<label>` bound via `htmlFor`
 *   - the error is linked with `aria-describedby` AND `aria-invalid`, so it is
 *     announced rather than merely coloured
 *   - errors are announced through the alert region in the parent form, so a
 *     screen-reader user hears them without hunting for the field
 *
 * Colour is never the only signal: the message text is always present.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  error?: string | undefined
  hint?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-ink-800"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Shared input styling, so every control in the CMS matches. */
export const inputClasses =
  'block w-full rounded-sm border border-ink-300 bg-white px-3 py-2.5 text-sm ' +
  'text-ink-900 placeholder:text-ink-400 ' +
  'focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none ' +
  'aria-invalid:border-red-500 aria-invalid:ring-red-200 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500'

/** Props that wire a control to its label, hint and error. */
export function describedBy(
  id: string,
  error?: string | undefined,
  hint?: string | undefined,
): InputHTMLAttributes<HTMLInputElement>['aria-describedby'] {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}