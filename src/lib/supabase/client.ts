import { createBrowserClient } from '@supabase/ssr'

import { getPublicEnv } from '@/lib/env'

/**
 * Supabase browser client.
 *
 * Uses the *publishable* key only. All authorization is enforced by Row Level
 * Security policies in the database — this client cannot bypass them.
 *
 * `createBrowserClient` is internally memoised, so calling this repeatedly
 * returns the same instance.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv()

  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
