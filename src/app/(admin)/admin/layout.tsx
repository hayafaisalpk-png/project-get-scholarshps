import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminSidebar } from '@/features/admin/components/admin-sidebar'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { requireCmsUser } from '@/lib/auth/guards'

/**
 * Administration layout.
 *
 * The guard runs once here for every route beneath `/admin`, so an
 * unauthenticated or unprivileged visitor is redirected before any markup is
 * produced.
 *
 * Protection is layered, and the order matters:
 *
 *   1. this guard          — a clean redirect instead of a broken page
 *   2. per-route checks    — a user with the wrong permission sees a real 403
 *   3. Row Level Security  — the actual boundary; correct even if 1 and 2 are
 *                            bypassed outright
 */
export const metadata: Metadata = {
  title: { default: 'Administration', template: '%s | Admin' },
  // Never index the administration area.
  robots: { index: false, follow: false, nocache: true },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, permissions, profile } = await requireCmsUser({
    redirectTo: '/admin',
  })

  const displayName = profile?.full_name ?? null

  return (
    <AdminShell
      sidebar={
        <AdminSidebar
          permissions={permissions}
          userEmail={user.email}
          displayName={displayName}
        />
      }
      header={<AdminHeader />}
    >
      {children}
    </AdminShell>
  )
}

function AdminHeader() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
      <Link
        href="/"
        className="shrink-0 text-sm font-medium text-ink-600 hover:text-brand-700 hover:underline"
      >
        View site
      </Link>
    </div>
  )
}