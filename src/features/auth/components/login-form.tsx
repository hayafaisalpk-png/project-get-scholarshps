'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { describedBy, FormField, inputClasses } from './form-field'

import { type AuthActionResult, signInAction } from '../actions'

/**
 * Sign-in form.
 *
 * The only interactive part of the sign-in page; everything else is a Server
 * Component. `useActionState` keeps the submit, pending and error handling in
 * one place and gives the form a stable identity across re-renders.
 */
export function LoginForm({ returnTo }: { returnTo?: string | undefined }) {
  const [state, action] = useActionState<AuthActionResult | null, FormData>(
    signInAction,
    null,
  )

  return (
    <form action={action} className="space-y-5" noValidate>
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      {/*
        `role="alert"` announces the failure as soon as it arrives. It sits
        above the fields because a keyboard user should not have to tab
        through them to discover that sign-in failed.
      */}
      {state && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <FormField
        id="email"
        label="Email address"
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
          )}
          defaultValue=""
        />
      </FormField>

      <FormField
        id="password"
        label="Password"
        error={state?.ok === false ? state.fieldErrors?.password : undefined}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClasses}
          aria-invalid={
            state?.ok === false && Boolean(state.fieldErrors?.password)
          }
          aria-describedby={describedBy(
            'password',
            state?.ok === false ? state.fieldErrors?.password : undefined,
          )}
        />
      </FormField>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}