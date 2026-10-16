import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/features/auth/components/password-forms'

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-ink-900">Reset your password</h1>
      <p className="mt-2 mb-7 text-sm text-ink-600">
        Enter the email address for your account and we will send you a link to
        choose a new password.
      </p>

      <ForgotPasswordForm />
    </div>
  )
}