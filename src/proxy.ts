import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getPublicEnv } from '@/lib/env'

/**
 * Supabase session refresh.
 *
 * In Next.js 16 the former `middleware` convention is `proxy`, and the runtime
 * is Node.js (the Edge runtime is not supported here). The file name and the
 * exported function name are both `proxy`.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth token via `auth.getClaims()`.
 *   2. Write the refreshed cookie onto both the outgoing request (so Server
 *      Components see a valid session) and the response (so the browser keeps
 *      it).
 *   3. Stamp cache headers that prevent a CDN from serving one user's
 *      Set-Cookie response to another user.
 *
 * This is a session *refresh* concern only. It is NOT an authorization layer —
 * every protected route and mutation is authorized server-side and by RLS.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv()

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          supabaseResponse = NextResponse.next({ request })

          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Verifies the JWT signature and refreshes the session when the token is
  // near expiry. It must be called — never `getSession()`, which trusts the
  // cookie without verification.
  await supabase.auth.getClaims()

  // Never let a shared cache store an authenticated response.
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = supabaseResponse.headers.get(header)
    if (value) supabaseResponse.headers.set(header, value)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and image optimization output,
     * so that authenticated Server Components always receive a fresh session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)',
  ],
}
