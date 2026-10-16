'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AuthorizationError } from '@/lib/auth/guards'
import { isCmsRole } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/env'
import {
  fieldErrorsFrom,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  safeReturnPath,
} from '@/lib/validation/auth'

/**
 * Authentication Server Actions.
 *
 * Rules that apply to everything in this file:
 *
 *   - Input is validated with Zod on the server. Client-side validation is a
 *     convenience and is never trusted.
 *   - Error messages never reveal whether an account exists.
 *   - `returnTo` is passed through `safeReturnPath` before it is ever used as a
 *     redirect target.
 *   - Every privileged branch is authorised server-side; RLS is the backstop.
 */

/** Uniform message for any failed sign-in. */
const GENERIC_SIGN_IN_ERROR =
  'That email address and password combination was not recognised.'

export type AuthActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function signInAction(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    // Deliberately identical for "no such user" and "wrong password".
    return { ok: false, message: GENERIC_SIGN_IN_ERROR }
  }

  /*
   * Authentication is not authorisation.
   *
   * A valid Supabase account is not by itself permission to use the CMS: a
   * freshly invited user has a session but no role until an administrator
   * assigns one. Refusing here, rather than letting them reach a dashboard
   * that would 403 on every query, keeps the boundary in one obvious place.
   */
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role:roles(key)')
    .eq('user_id', data.user.id)

  const roles = (roleRows ?? [])
    .map((row) => {
      const role = row.role as { key: string } | null
      return role?.key ?? null
    })
    .filter((key): key is string => typeof key === 'string')

  const hasCmsRole = roles.some((key) => isCmsRole(key as never))

  if (!hasCmsRole) {
    // Do not leave an authenticated but unprivileged session lying around.
    await supabase.auth.signOut()
    return {
      ok: false,
      message:
        'Your account is not yet approved for administrative access. Contact an administrator.',
    }
  }

  // Best-effort bookkeeping. Failure here must never block a valid sign-in.
  await supabase
    .from('profiles')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('id', data.user.id)

  await supabase.rpc('write_audit_log', {
    p_action: 'auth.sign_in',
    p_entity_type: 'profile',
    p_entity_id: data.user.id,
  })

  const target = safeReturnPath(formData.get('returnTo'), '/admin')
  revalidatePath('/admin', 'layout')
  redirect(target)
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                    */
/* -------------------------------------------------------------------------- */

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()

  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub

  if (userId) {
    await supabase.rpc('write_audit_log', {
      p_action: 'auth.sign_out',
      p_entity_type: 'profile',
      p_entity_id: userId,
    })
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}

/* -------------------------------------------------------------------------- */
/* Password reset request                                                      */
/* -------------------------------------------------------------------------- */

export async function requestPasswordResetAction(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    // Must land on the code-exchange handler, not the form itself: the
    // one-time PKCE code has to be turned into session cookies first.
    { redirectTo: `${getSiteUrl()}/auth/confirm?next=/auth/reset-password` },
  )

  if (error) {
    // Still report success. Telling a caller that the address is unknown turns
    // this form into an account-enumeration oracle.
    console.error('[auth] password reset request failed:', error.message)
  }

  return {
    ok: true,
    message:
      'If that address belongs to an account, a password reset link is on its way.',
  }
}

/* -------------------------------------------------------------------------- */
/* Set a new password                                                          */
/* -------------------------------------------------------------------------- */

export async function updatePasswordAction(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const supabase = await createClient()

  /*
   * Re-establish the boundary explicitly.
   *
   * If this runs without a recovery session we must NOT fall back to the
   * request cookie, because that would let anyone who can reach the page
   * rewrite an arbitrary account's password.
   */
  const { data, error: sessionError } = await supabase.auth.getUser()

  if (sessionError || !data.user) {
    return {
      ok: false,
      message:
        'This password reset link is invalid or has expired. Request a new one.',
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return {
      ok: false,
      message: 'The password could not be changed. Please try again.',
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'auth.password_changed',
    p_entity_type: 'profile',
    p_entity_id: data.user.id,
  })

  return { ok: true }
}

export { AuthorizationError }