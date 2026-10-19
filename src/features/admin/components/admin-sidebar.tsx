import type { Permission } from '@/lib/auth/permissions'
import { adminNavigation } from '@/lib/admin/navigation'
import {
  contactUnreadCount,
  reportStatusCounts,
} from '@/features/contact/admin/queries'

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
export async function AdminSidebar({
  permissions,
  userEmail,
  displayName,
}: {
  permissions: readonly Permission[]
  userEmail: string | null
  displayName: string | null
}) {
  const items = adminNavigation(permissions)
  const [contactUnread, reportCounts] = await Promise.all([
    permissions.includes('contact.manage') ? contactUnreadCount() : null,
    permissions.includes('report.manage') ? reportStatusCounts() : null,
  ])

  const itemsWithCounts = items.map((item) => ({
    ...item,
    ...(item.href === '/admin/contact' && contactUnread !== null
      ? { unreadCount: contactUnread }
      : item.href === '/admin/reports' && reportCounts
        ? { unreadCount: reportCounts.open ?? 0 }
        : {}),
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-ink-200 p-4">
        <AdminBrand />
      </div>

      <nav aria-label="Administration" className="flex-1 overflow-y-auto p-3">
        {/*
          Filtering happens HERE, once, on the server. The client component
          renders exactly this list, so both sides always agree on how many
          items exist.
        */}
        <AdminNav items={itemsWithCounts} />
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
        </div>
      </div>
    </div>
  )
}
