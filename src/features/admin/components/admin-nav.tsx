'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ADMIN_NAV } from '@/lib/admin/navigation'
import type { Permission } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils/cn'

/**
 * Administration navigation links.
 *
 * Client-side only because it marks the active item from `usePathname()`.
 * `ADMIN_NAV` is static data with icon references, so it is imported directly
 * here rather than passed across the server/client boundary — component
 * references are not serialisable props.
 *
 * Filtering by permission is presentation. Every route re-ch authorisation
 * server-side, and RLS is the enforcement boundary.
 */
export function AdminNav({
  permissions,
}: {
  permissions: readonly Permission[]
}) {
  const pathname = usePathname()

  const items = ADMIN_NAV.filter((item) =>
    item.permissions.some((p) => permissions.includes(p)),
  )

  if (items.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-ink-500">
        No sections are available to your role yet.
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active =
          item.match === 'exact'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

        const Icon = item.icon

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                active
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
              )}
            >
              <Icon
                className={cn(
                  'size-5 shrink-0',
                  active ? 'text-brand-700' : 'text-ink-500',
                )}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}