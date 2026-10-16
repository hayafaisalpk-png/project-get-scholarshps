import Link from 'next/link'

import type { Permission } from '@/lib/auth/permissions'

import { AdminBrand } from './admin-shell'
import { AdminNav } from './admin-nav'
import { SignOutButton } from './sign-out-button'

/**
 * Administration sidebar.
 *
 * A Server Component. Navigation is filtered by permission for usability, but
 * that is never the enforcement boundary — every destination authorises its
 * own access server-side, with RLS underneath.
 */
export function AdminSidebar({
  permissions,
  userEmail,
  displayName,
}: {
  permissions: readonly Permission[]
  userEmail: string | null
  displayName: string | null
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-ink-200 p-4">
        <AdminBrand />
        <p className="mt-1 pl-10 text-xs font-medium tracking-wide text-ink-500 uppercase">
          Administration
        </p>
      </div>

      <nav aria-label="Administration" className="flex-1 overflow-y-auto p-3">
        <AdminNav permissions={permissions} />
      </nav>

      <div className="border-t border-ink-200 p-4">
        <p className="truncate text-sm font-medium text-ink-900">
          {displayName ?? 'Signed in'}
        </p>
        {userEmail ? (
          <p className="truncate text-xs text-ink-500">{userEmail}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <SignOutButton />
          <Link
            href="/"
            className="text-xs font-medium text-ink-600 hover:text-brand-700 hover:underline"
          >
            View site
          </Link>
        </div>
      </div>
    </div>
  )
}