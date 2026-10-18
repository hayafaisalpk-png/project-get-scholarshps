import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { resolveRedirect } from '@/features/redirects/resolution'
import { getRedirectRules } from '@/features/redirects/store'
import { getPublicEnv } from '@/lib/env'

/**
 * Supabase session refresh, and redirect enforcement.
 *
 * In Next.js 16 the former `middleware` convention is `proxy`, and the runtime
 * is Node.js (the Edge runtime is not supported here). The file name and the
 * exported function name are both `proxy`.
 *
 * Responsibilities:
 *   0. Honour the `redirects` table (added in Phase 5 increment 2).
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
  /*
   * Redirects first, and before any auth work.
   *
   * A redirected request never renders a page, so refreshing a session for it is
   * pure waste — and this ordering means a redirect costs one cached map lookup
   * on the common case of "no rule matches", with no cookie work at all.
   */
  const redirect = await matchRedirect(request)
  if (redirect) return redirect

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

/**
 * Resolve a redirect for this request, if one applies.
 *
 * Returns `null` when no rule matches, which is the case for effectively every
 * request and must stay cheap.
 *
 * A failure inside `getRedirectRules` is already contained — it serves the last
 * known good map, or an empty one — so there is nothing to catch here. That is
 * deliberate: a redirect table outage must not become a site outage.
 */
async function matchRedirect(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname

  /*
   * Skip the framework's own routes. They are not user-facing URLs and can never
   * be the target of a content migration, and a redirect table is free to grow
   * one that would otherwise shadow a build asset.
   */
  if (pathname.startsWith('/_next/')) return null

  const rules = await getRedirectRules()
  if (rules.size === 0) return null

  const resolved = resolveRedirect(rules, pathname, request.nextUrl.search)
  if (!resolved) return null

  /*
   * The Location has to be ABSOLUTE.
   *
   * `NextResponse.redirect` parses the URL it is given (`new URL(...)`), so a
   * relative `/new-address` throws ERR_INVALID_URL and the request 500s. Passing
   * a relative Location by hand in a raw `NextResponse` fails the same way one
   * layer down, so the destination is resolved against an origin first.
   *
   * The origin is the REQUEST's, not `NEXT_PUBLIC_SITE_URL`. A preview
   * deployment must not redirect a visitor onto production: the path is the same
   * on both, and only the origin differs. An external `https://` destination is
   * used as-is — it is already absolute, and `validateRedirectRule` refuses
   * anything that is not `https://` before it can be stored.
   */
  const target = resolved.to.startsWith('/')
    ? new URL(resolved.to, request.nextUrl.origin)
    : new URL(resolved.to)

  const response = NextResponse.redirect(target, resolved.statusCode)

  // The mapping is stable once an editor sets it, so it may be cached hard. A
  // browser and an intermediary both benefit from not re-asking on every hit.
  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')

  return response
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
