'use client'

import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import {
  BRAND_MARK,
  BRAND_MARK_HEADER_HEIGHT_PX,
  BRAND_MARK_MAX_WIDTH_PX,
  BRAND_NAME_SIZE_TOKEN,
  BRAND_WORDMARK,
} from '@/lib/brand'

/**
 * Administration shell.
 *
 * Client-side only because of the mobile drawer. The sidebar and header are
 * rendered on the server and passed in as nodes, so icons and navigation stay
 * server-rendered and cost nothing in the client bundle beyond this toggle.
 *
 * Accessibility notes:
 *   - the toggle is a real `<button>` with `aria-expanded` / `aria-controls`
 *   - the drawer closes on Escape and on route change
 *   - the page can always be reached by keyboard; nothing depends on hover
 */
export function AdminShell({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  /*
   * Close the drawer whenever navigation happens.
   *
   * Done as React's documented "adjust state during render" pattern rather than
   * in an effect: an effect that calls setState synchronously runs after the
   * DOM has already been painted, which the linter correctly flags as a
   * cascading render. Comparing against the previous pathname here keeps the
   * drawer from surviving a route change without the extra commit.
   */
  const [lastPathname, setLastPathname] = useState(pathname)

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (open) setOpen(false)
  }

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Stop the page behind the drawer from scrolling on small screens.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className="min-h-dvh bg-ink-50">
      <a href="#admin-content" className="skip-link">
        Skip to main content
      </a>

      {/*
        Persistent sidebar from `lg` upwards. Hidden below that, where the
        drawer takes over.
      */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-ink-200 lg:bg-white">
        {sidebar}
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/*
            Clicking the backdrop closes the drawer. It is a presentational
            <div> with an onClick rather than a <button>, because a full-screen
            invisible button would be announced to screen readers as a control
            covering the whole page. Escape and the close button provide the
            accessible equivalents.
          */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape and the toggle button cover keyboard access */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop only, not interactive content */}
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setOpen(false)}
          />

          <div
            id="admin-sidebar"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex justify-end border-b border-ink-200 p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-2 text-ink-600 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Close navigation</span>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {sidebar}
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="admin-sidebar"
              className="rounded-sm p-2 text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
              <span className="sr-only">Open navigation</span>
            </button>

            {header}
          </div>
        </header>

        <main
          id="admin-content"
          tabIndex={-1}
          className="px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

/**
 * Brand mark used in the sidebar and header.
 *
 * The name is set at the same size as the public footer's, from the same
 * `--text-brand-name-sm` token, so the two cannot drift apart. The mark is a `GS`
 * badge rather than the site's illustration: it keeps the admin sidebar compact
 * and avoids restyling the dashboard.
 */
export function AdminBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
    >
      <Image
        src={BRAND_MARK.src}
        alt=""
        width={BRAND_MARK.width}
        height={BRAND_MARK.height}
        className="flex-none object-contain"
        style={{
          height: BRAND_MARK_HEADER_HEIGHT_PX,
          width: 'auto',
          maxWidth: BRAND_MARK_MAX_WIDTH_PX,
        }}
      />
      <span className={`truncate font-normal ${BRAND_NAME_SIZE_TOKEN.admin} text-navy`}>
        {BRAND_WORDMARK.lead}
        <span className="font-extrabold">{BRAND_WORDMARK.bold}</span>
        <span className="text-sm font-normal">{BRAND_WORDMARK.suffix}</span>
      </span>
    </Link>
  )
}