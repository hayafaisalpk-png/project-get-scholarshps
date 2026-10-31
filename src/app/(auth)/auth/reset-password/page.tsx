import type { Metadata } from 'next'
import Link from 'next/link'

import { getAuthUser } from '@/lib/auth/session'
import { Alert } from '@/components/ui/alert'
import { ResetPasswordForm } from '@/features/auth/components/password-forms'

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
  other: {
    bingbot: 'noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  },
}

/**
 * Set a new password.
 *
 * Reached only after `/auth/confirm` has exchanged the emailed code for a
 * session. Without that session there is nothing to update, so the page says
 * so plainly instead of rendering a form that would fail on submit.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const [user, params] = await Promise.all([getAuthUser(), searchParams])

  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-ink-900">Choose a new password</h1>

      <div className="mt-2 mb-7">
        {error ? (
          <Alert tone="error">
            This password reset link is invalid or has expired. Recovery links
            are single-use and time-limited.
          </Alert>
        ) : (
          <p className="text-sm text-ink-600">
            Pick something you have not used elsewhere. At least 12 characters.
          </p>
        )}
      </div>

      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Open the most recent link from your inbox on this device, or request
            a new one.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      )}
    </div>
  )
}