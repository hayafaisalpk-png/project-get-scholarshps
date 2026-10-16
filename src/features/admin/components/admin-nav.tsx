'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ADMIN_ICONS, type AdminNavItem, isActiveNavItem } from '@/lib/admin/navigation'
import { cn } from '@/lib/utils/cn'

/**
 * Administration navigation links.
 *
 * Renders exactly the items it is given — it does NOT filter by permission.
 *
 * That split is deliberate and is what prevents a hydration mismatch. The
 * previous version re-derived the item list from the permission array inside
 * this client component, while the surrounding sidebar was a Server Component.
 * Server and client then ran the filter independently, and when they disagreed
 * the item count differed between the server HTML and the hydrated tree.
 *
 * A hydration mismatch is not cosmetic: React discards the server-rendered tree
 * and rebuilds it on the client, which destroys the Server Action reference
 * bound to any form inside it. That is why a mismatch on this component made
 * scholarship form submits 404 and sign the user out.
 *
 * The active item is still derived from `usePathname()`, which is stable across
 * the hydration boundary.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname()

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
        const active = isActiveNavItem(item, pathname)
        const Icon = ADMIN_ICONS[item.icon]

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors',
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