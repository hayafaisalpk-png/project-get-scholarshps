import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getServerEnv } from '@/lib/env'

/**
 * Supabase admin client (service-role).
 *
 * DANGEROUS: the returned client bypasses Row Level Security entirely. It must
 * only be used on the server, only for narrowly-scoped privileged operations
 * (audit logging, scheduled publishing, administrative maintenance), and never
 * for anything that serves a public request body directly.
 *
 * Never import this module from a Client Component. The service-role key is
 * intentionally absent from the `NEXT_PUBLIC_` namespace.
 */
export function createAdminClient() {
  const env = getServerEnv()

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Privileged server operations ' +
        'cannot run without it. Refusing to fall back to the publishable key.',
    )
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}

/**
 * True when privileged server operations are available.
 *
 * Call sites should degrade gracefully (and tell the operator) rather than
 * crash a whole page render.
 */
export function hasAdminClient(): boolean {
  return Boolean(getServerEnv().SUPABASE_SERVICE_ROLE_KEY)
}
