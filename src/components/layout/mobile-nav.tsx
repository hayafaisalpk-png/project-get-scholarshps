'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import type { NavigationItem } from '@/lib/navigation'
import { cn } from '@/lib/utils/cn'

/**
 * Header navigation, including the mobile menu.
 *
 * Client component because the menu needs open/closed state. It receives plain
 * data from the server component above, so no data fetching crosses the boundary.
 *
 * Accessibility:
 *   - The toggle is a real button with `aria-expanded` and `aria-controls`.
 *   - The panel is a `<dialog>`-style disclosure, not a focus trap, because a
 *     non-modal menu should not trap focus.
 *   - Escape closes it, and the route change closes it.
 *   - The current page is marked with `aria-current="page"`.
 */

export function MobileNav({
  items,
  authSlot,
}: {
  items: NavigationItem[]
  authSlot?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Close the menu when the route changes.
  //
  // Done by adjusting state during render rather than in an effect: React
  // explicitly discourages calling setState synchronously inside an effect,
  // because it causes a cascading second render. Tracking the pathname the
  // menu was opened on is the documented pattern for "reset when a prop
  // changes".
  const [openedAt, setOpenedAt] = useState(pathname)

  if (open && pathname !== openedAt) {
    setOpenedAt(pathname)
    setOpen(false)
  }

  // Escape closes and returns focus to the toggle.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Prevent the page scrolling behind the open panel.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        <span className="sr-only-focusable">
          {open ? 'Close main menu' : 'Open main menu'}
        </span>
        {open ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="fixed inset-x-0 top-[4.5rem] z-40 max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-ink-200 bg-white px-4 py-6 shadow-lg"
        >
          <nav aria-label="Mobile">
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} className="block" />
                </li>
              ))}
            </ul>
          </nav>

          {authSlot ? (
            <div className="mt-6 border-t border-ink-200 pt-6">{authSlot}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * One navigation link, marking the current page.
 *
 * Shared by the desktop and mobile menus so `aria-current` behaves identically
 * in both. `usePathname` is a client hook, so `aria-current` resolves after
 * hydration rather than during the server render.
 */
export function NavLink({
  item,
  className,
}: {
  item: NavigationItem
  className?: string
}) {
  const pathname = usePathname()

  const isCurrent =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(`${item.href}/`))

  const external = item.opens_in_new_tab || /^https?:\/\//.test(item.href)

  const classes = cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isCurrent
      ? 'bg-brand-50 text-brand-800'
      : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
    className,
  )

  if (external) {
    return (
      <a
        href={item.href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.label}
        <span className="sr-only-focusable"> (opens in a new tab)</span>
      </a>
    )
  }

  return (
    <Link href={item.href} className={classes} aria-current={isCurrent || undefined}>
      {item.label}
    </Link>
  )
}
