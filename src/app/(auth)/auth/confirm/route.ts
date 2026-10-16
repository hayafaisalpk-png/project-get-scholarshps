import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { safeReturnPath } from '@/lib/validation/auth'

/**
 * OAuth / recovery callback.
 *
 * Supabase's recovery email links here with a one-time `code` query parameter
 * (PKCE). This handler exchanges that code for a session and writes the session
 * cookies, then forwards the user to the destination page.
 *
 * It has to be a Route Handler rather than a Server Component because the
 * cookie write only succeeds outside the Server Component render pass.
 *
 * Failure handling is deliberately blunt: any problem redirects to a page that
 * explains the link expired. Error detail is logged, never echoed into the
 * URL, so a failure cannot leak the code or internal state through the
 * address bar, a referrer header or the browser history.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = safeReturnPath(request.nextUrl.searchParams.get('next'), '')

  const failureUrl = new URL('/auth/reset-password', request.url)
  failureUrl.searchParams.set('error', 'expired')

  // No code: nothing to exchange.
  if (!code) return NextResponse.redirect(failureUrl)

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth] code exchange failed:', error.message)
    return NextResponse.redirect(failureUrl)
  }

  // `safeReturnPath` already rejected anything that was not a safe internal
  // path, so this cannot become an open redirect.
  const destination = new URL(next || '/auth/reset-password', request.url)

  return NextResponse.redirect(destination)
}