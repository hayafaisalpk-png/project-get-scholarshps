import 'server-only'

import { cache } from 'react'

import {
  type AppRole,
  PERMISSIONS,
  type Permission,
  isAppRole,
  isPermission,
} from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Identity and authorization, server-side.
 *
 * Two rules govern everything in this file:
 *
 *   1. Identity comes from `auth.getClaims()`, which VERIFIES the JWT
 *      signature. `auth.getSession()` must never gate authorization: it reads
 *      the session straight out of the cookie without verification, so a forged
 *      cookie would be trusted.
 *
 *   2. The role and permission sets returned here are for GATING (route guards,
 *      navigation, deciding which form to render). They are NOT the enforcement
 *      boundary. Enforcement happens in the database via Row Level Security, and
 *      every mutation must still call a guard before it queries.
 */

export type AuthUser = {
  id: string
  email: string | null
}

export type AuthState = {
  user: AuthUser | null
  roles: AppRole[]
  permissions: Permission[]
  profile: {
    full_name: string | null
    avatar_url: string | null
    status: string | null
  } | null
}

/**
 * Resolve the current user from a signature-verified JWT.
 *
 * Memoised per request with React `cache`, so a page that calls it from several
 * components issues exactly one verification.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()

  // getClaims() verifies the signature and refreshes an expiring token.
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) return null

  const email =
    typeof data.claims.email === 'string' ? data.claims.email : null

  return { id: data.claims.sub, email }
})

/**
 * Load roles, permissions and profile for the current user in ONE query.
 *
 * The nested embed traverses user_roles -> roles -> role_permissions ->
 * permissions, which Supabase resolves through foreign keys.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const user = await getAuthUser()

  if (!user) {
    return { user: null, roles: [], permissions: [], profile: null }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_roles')
    .select(
      'role:roles(key, role_permissions(permission:permissions(key)))',
    )
    .eq('user_id', user.id)

  if (error || !data) {
    // A failure here must not be treated as "has no permissions" silently in a
    // way that grants access. Returning empty sets denies everything, which is
    // the safe direction, but we make the failure explicit for logging.
    console.error('[auth] failed to load roles/permissions:', error?.message)
    return { user, roles: [], permissions: [], profile: null }
  }

  const roles = new Set<AppRole>()
  const permissions = new Set<Permission>()

  for (const row of data) {
    const role = row.role as
      | { key: string; role_permissions: { permission: { key: string } | null }[] }
      | null

    if (!role) continue
    if (isAppRole(role.key)) roles.add(role.key)

    for (const rp of role.role_permissions ?? []) {
      const key = rp.permission?.key
      if (key && isPermission(key)) permissions.add(key)
    }
  }

  // super_admin implicitly holds everything, matching has_permission() in the
  // database.
  if (roles.has('super_admin')) {
    for (const key of PERMISSIONS) permissions.add(key)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, status')
    .eq('id', user.id)
    .maybeSingle()

  return {
    user,
    roles: [...roles],
    permissions: [...permissions],
    profile: profile
      ? {
          full_name: profile.full_name ?? null,
          avatar_url: profile.avatar_url ?? null,
          status: profile.status ?? null,
        }
      : null,
  }
})

/* -------------------------------------------------------------------------- */
/* Non-throwing checks — for conditional UI                                    */
/* -------------------------------------------------------------------------- */

export async function hasRole(role: AppRole): Promise<boolean> {
  const state = await getAuthState()
  return state.roles.includes(role)
}

export async function hasAnyRole(roles: readonly AppRole[]): Promise<boolean> {
  const state = await getAuthState()
  return roles.some((r) => state.roles.includes(r))
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const state = await getAuthState()
  return state.permissions.includes(permission)
}

export async function hasAnyPermission(
  permissions: readonly Permission[],
): Promise<boolean> {
  const state = await getAuthState()
  return permissions.some((p) => state.permissions.includes(p))
}

/** True when the user holds any administrative role. Students never qualify. */
export async function isCmsUser(): Promise<boolean> {
  const state = await getAuthState()
  return state.roles.some((r) => r !== 'student')
}
