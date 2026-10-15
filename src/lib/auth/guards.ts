import 'server-only'

import { redirect } from 'next/navigation'

import { type AppRole, type Permission } from '@/lib/auth/permissions'
import { getAuthState } from '@/lib/auth/session'

/**
 * Route and mutation guards.
 *
 * These run BEFORE any database call in a Server Action or Route Handler.
 *
 * They are a second line of defence, not the only one:
 *
 *   - Row Level Security is the real enforcement boundary. A guard that is
 *     forgotten does not expose data, because the policy still denies it.
 *   - A guard that is bypassed (for example by calling the function directly
 *     without going through the route) is caught by RLS.
 *
 * The reverse is also true and is why guards exist: RLS alone gives a poor user
 * experience. Hitting a permission error from the database is a bug report; a
 * clean redirect is not.
 */

/** Thrown when an authenticated user lacks a required role or permission. */
export class AuthorizationError extends Error {
  readonly status = 403
  constructor(
    message = 'You do not have permission to perform this action.',
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Require an authenticated user, or redirect to sign-in.
 *
 * Use in Server Components and route pages. `returnTo` lets the sign-in page
 * send the visitor back where they were headed.
 */
export async function requireUser(returnTo?: string): Promise<{
  id: string
  email: string | null
}> {
  const state = await getAuthState()

  if (!state.user) {
    const target = returnTo
      ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/auth/login'
    redirect(target)
  }

  // `redirect` throws, so this is unreachable, but TypeScript needs it.
  return state.user as { id: string; email: string | null }
}

/**
 * Require an authenticated user, or throw.
 *
 * Use in Server Actions and Route Handlers, where a redirect is not an
 * appropriate response.
 */
export async function requireUserOrThrow(): Promise<{
  id: string
  email: string | null
}> {
  const state = await getAuthState()

  if (!state.user) {
    throw new AuthorizationError('Authentication required.')
  }

  return state.user
}

/** Require any of the supplied roles. Redirects to sign-in or throws 403. */
export async function requireRole(
  allowed: readonly AppRole[],
  options: { redirectTo?: string } = {},
): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  const state = await requireAuthState(options)

  const permitted = state.roles.some((role) => allowed.includes(role))
  if (!permitted) throw new AuthorizationError()

  return state
}

/**
 * Require a permission. Redirects to sign-in or throws 403.
 *
 * This is the guard most CMS routes and actions should use.
 */
export async function requirePermission(
  permission: Permission,
  options: { redirectTo?: string } = {},
): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  const state = await requireAuthState(options)

  if (!state.permissions.includes(permission)) throw new AuthorizationError()

  return state
}

/**
 * Require ANY of the supplied permissions.
 *
 * Useful where several capabilities authorise the same action, for example
 * redirect management being available to either `seo.manage` or
 * `settings.manage`.
 */
export async function requireAnyPermission(
  permissions: readonly Permission[],
  options: { redirectTo?: string } = {},
): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  const state = await requireAuthState(options)

  const permitted = permissions.some((p) => state.permissions.includes(p))
  if (!permitted) throw new AuthorizationError()

  return state
}

/**
 * Require any administrative role.
 *
 * A student role NEVER satisfies this check, even if the account also somehow
 * held another role — that combination should not exist, and denying it is the
 * safe outcome.
 */
export async function requireCmsUser(
  options: { redirectTo?: string } = {},
): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  const state = await requireAuthState(options)

  const isAdmin = state.roles.some((role) => role !== 'student')
  if (!isAdmin) throw new AuthorizationError('Administrative access required.')

  return state
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                   */
/* -------------------------------------------------------------------------- */

async function requireAuthState(options: { redirectTo?: string } = {}) {
  const state = await getAuthState()

  if (!state.user) {
    const target = options.redirectTo
      ? `/auth/login?returnTo=${encodeURIComponent(options.redirectTo)}`
      : '/auth/login'
    redirect(target)
  }

  return state
}
