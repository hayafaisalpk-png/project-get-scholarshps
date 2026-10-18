'use client'

import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { signOutAction } from '@/features/auth/actions'

/**
 * Signed-in account menu for the public header.
 *
 * Shown in place of the "Sign in" link when there is a session. It deliberately
 * does NOT display the email address: the header is public-facing chrome shown
 * on every page, and putting an address in it on every screen adds nothing a
 * visitor needs.
 *
 * Pattern: a menu button per the ARIA APG, built on the same non-modal
 * disclosure ideas as `MobileNav` — the panel does not trap focus, because
 * trapping focus in a non-modal menu is a keyboard trap, not an accessibility
 * feature. What it does provide:
 *
 *   - `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` on the trigger.
 *   - Arrow Up/Down to move between items, Home/End to jump, Escape to close
 *     and return focus to the trigger.
 *   - `tabIndex={-1}` on the items, because this menu moves focus
 *     programmatically rather than letting Tab walk into it. Tab closes it.
 *   - Click outside closes.
 *
 * "Sign out" posts the existing `signOutAction` through a form rather than
 * linking anywhere, so the browser cannot trigger a sign-out by prefetching it.
 */

/** Shared row styling for both items, so the link and the submit match exactly. */
const ITEM =
  'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm font-medium text-ink-800 transition-colors duration-200 hover:bg-ink-100 hover:text-ink-900 focus-visible:bg-ink-100 focus-visible:text-ink-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500'

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const triggerId = useId()

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  /**
   * Which item to focus after opening. Null means "leave focus on the trigger",
   * which is what a plain click should do.
   *
   * A ref rather than state: it is read exactly once, at the moment the panel
   * appears, and must not itself trigger a render. State here would need
   * clearing inside the effect that consumes it, which is the cascading-render
   * pattern `react-hooks/set-state-in-effect` correctly rejects.
   */
  const pendingFocusRef = useRef<'first' | 'last' | null>(null)

  // Close on route change.
  //
  // Adjusted during render rather than in an effect, for the same reason as
  // `MobileNav`: React discourages calling setState synchronously inside an
  // effect because it forces a cascading second render.
  const [openedAt, setOpenedAt] = useState(pathname)

  if (open && pathname !== openedAt) {
    setOpenedAt(pathname)
    setOpen(false)
  }

  // Move focus into the menu when it was opened from the keyboard. Runs after
  // the panel has rendered, so the item refs are populated.
  useEffect(() => {
    const target = pendingFocusRef.current
    if (!open || !target) return

    const index = target === 'first' ? 0 : itemRefs.current.length - 1
    itemRefs.current[index]?.focus()
  }, [open])

  // Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Pointer press outside the component closes it.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const openAndFocus = (target: 'first' | 'last') => {
    if (open) {
      const index = target === 'first' ? 0 : itemRefs.current.length - 1
      itemRefs.current[index]?.focus()
      return
    }
    pendingFocusRef.current = target
    setOpen(true)
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAndFocus('first')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAndFocus('last')
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = itemRefs.current
    const last = items.length - 1
    const current = items.findIndex((el) => el === document.activeElement)

    let next: number | null = null

    if (event.key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (event.key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    // Tab moves on and dismisses the menu; it must not fall into it, because
    // every item is tabIndex={-1}.
    else if (event.key === 'Tab') setOpen(false)

    if (next !== null) {
      event.preventDefault()
      items[next]?.focus()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        id={triggerId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className="gap-1.5"
      >
        Admin
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </Button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-md border border-ink-200 bg-white py-1 shadow-lg"
        >
          <ul
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className="py-1"
          >
            {/* `role="none"` on each row: without it the list item would sit
                between `menu` and `menuitem` in the accessibility tree, which
                breaks the menu pattern. */}
            <li role="none">
              <Link
                ref={(el) => {
                  itemRefs.current[0] = el
                }}
                role="menuitem"
                tabIndex={-1}
                href="/admin"
                className={ITEM}
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                Dashboard
              </Link>
            </li>

            <li role="none">
              <form action={signOutAction}>
                <SignOutMenuItem
                  setRef={(el) => {
                    itemRefs.current[1] = el
                  }}
                />
              </form>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The sign-out row.
 *
 * Split out because `useFormStatus` only reports status for the form it is
 * rendered inside, so it cannot live in `AccountMenu` above the `<form>`.
 */
function SignOutMenuItem({ setRef }: { setRef: (el: HTMLButtonElement | null) => void }) {
  const { pending } = useFormStatus()

  return (
    <button
      ref={setRef}
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      aria-busy={pending || undefined}
      className={ITEM}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}