'use client'

import { LogOut } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { signOutAction } from '@/features/auth/actions'

/**
 * Sign-out control.
 *
 * Uses a form posting a Server Action rather than a link, so the sign-out is a
 * state-changing request the browser cannot trigger by prefetching.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitSignOut />
    </form>
  )
}

function SubmitSignOut() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
    >
      <LogOut className="size-3.5" aria-hidden="true" />
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}