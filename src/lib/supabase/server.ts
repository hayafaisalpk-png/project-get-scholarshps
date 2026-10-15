import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicEnv } from '@/lib/env'

/**
 * Supabase server client for Server Components, Server Actions and Route
 * Handlers.
 *
 * IMPORTANT: a new client is created per request, because the cookie jar is
 * request-scoped. Never cache the returned client across requests.
 *
 * The `setAll` callback cannot write cookies from a Server Component (Next.js
 * forbids it), so it is wrapped in a try/catch. The `proxy` (formerly
 * `middleware`) is responsible for actually persisting refreshed tokens on
 * every request.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv()

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component. Cookie writes are handled by the
            // proxy; ignoring here is the documented Supabase pattern.
          }
        },
      },
    },
  )
}
