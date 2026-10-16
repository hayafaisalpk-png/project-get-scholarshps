'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button, ButtonLink } from '@/components/ui/button'
import { describedBy, FormField, inputClasses } from './form-field'

import {
  type AuthActionResult,
  requestPasswordResetAction,
  updatePasswordAction,
} from '../actions'

/**
 * "Forgot password" form.
 *
 * The confirmation is deliberately identical whether or not the address is
 * registered. Reporting "no account with that email" would turn this page into
 * an account-enumeration oracle for anyone who cares to try addresses.
 */
export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthActionResult | null, FormData>(
    requestPasswordResetAction,
    null,
  )

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Alert tone="success">{state.message}</Alert>
        <p className="text-sm text-ink-600">
          The link expires after a short time. If it does not arrive, check your
          spam folder before requesting another.
        </p>
        <ButtonLink variant="outline" href="/auth/login" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

      <FormField
        id="email"
        label="Email address"
        hint="We will send a link to set a new password."
        error={state?.ok === false ? state.fieldErrors?.email : undefined}
      >
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          spellCheck={false}
          className={inputClasses}
          aria-invalid={state?.ok === false && Boolean(state.fieldErrors?.email)}
          aria-describedby={describedBy(
            'email',
            state?.ok === false ? state.fieldErrors?.email : undefined,
            'We will send a link to set a new password.',
          )}
        />
      </FormField>

      <SubmitButton label="Send reset link" />

      <p className="text-center text-sm">
        <Link
          href="/auth/login"
          className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  )
}

/** Set-a-new-password form, reached from the emailed recovery link. */
export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthActionResult | null, FormData>(
    updatePasswordAction,
    null,
  )

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Alert tone="success">
          Your password has been changed. You can now sign in.
        </Alert>
        <ButtonLink href="/auth/login" className="w-full">
          Go to sign in
        </ButtonLink>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

      <FormField
        id="password"
        label="New password"
        hint="At least 12 characters."
        error={state?.ok === false ? state.fieldErrors?.password : undefined}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={inputClasses}
          aria-invalid={state?.ok === false && Boolean(state.fieldErrors?.password)}
          aria-describedby={describedBy(
            'password',
            state?.ok === false ? state.fieldErrors?.password : undefined,
            'At least 12 characters.',
          )}
        />
      </FormField>

      <FormField
        id="confirmPassword"
        label="Confirm new password"
        error={
          state?.ok === false ? state.fieldErrors?.confirmPassword : undefined
        }
      >
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClasses}
          aria-invalid={
            state?.ok === false && Boolean(state.fieldErrors?.confirmPassword)
          }
          aria-describedby={describedBy(
            'confirmPassword',
            state?.ok === false ? state.fieldErrors?.confirmPassword : undefined,
          )}
        />
      </FormField>

      <SubmitButton label="Update password" />
    </form>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  )
}