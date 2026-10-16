import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAuthUser } from '@/lib/auth/session'
import { safeReturnPath } from '@/lib/validation/auth'

import { LoginForm } from '@/features/auth/components/login-form'

/**
 * Sign-in page.
 *
 * An already-authenticated visitor is sent straight to the admin area rather
 * than being shown a form they do not need.
 *
 * `searchParams` is a Promise in Next.js 16 — it must be awaited.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const user = await getAuthUser()

  if (user) {
    redirect('/admin')
  }

  const params = await searchParams
  const raw = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo

  /*
   * Normalised here as well as in the action. The action's check is the
   * security boundary; this one keeps the hidden field itself honest, so the
   * form never round-trips a hostile URL back to the browser.
   */
  const returnTo = raw ? safeReturnPath(raw, '') : undefined

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
          GetScholarship
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Sign in</h1>
        <p className="mt-2 text-sm text-ink-600">
          Access to the administration area is by invitation only. If you need
          an account, please contact an administrator.
        </p>
      </div>

      <LoginForm returnTo={returnTo || undefined} />

      <p className="mt-6 border-t border-ink-200 pt-5 text-xs text-ink-500">
        <Link
          href="/"
          className="font-medium text-ink-600 hover:text-brand-700 hover:underline"
        >
          ← Back to the public site
        </Link>
      </p>
    </div>
  )
}