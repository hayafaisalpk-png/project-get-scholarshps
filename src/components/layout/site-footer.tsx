import type { ReactElement } from 'react'

import Link from 'next/link'

import { getLegalNavigation } from '@/lib/navigation'
import { getString } from '@/lib/settings'

/**
 * Site footer.
 *
 * Columns come from the database so editors can reorganise them. The privacy
 * policy is a first-class link: consent-gated advertising makes it a legal
 * requirement, not a nicety.
 *
 * Social profile URLs are edited under /admin/settings (the `social.*` keys).
 * They are rendered here as icons so a visitor can actually reach them; they are
 * also published as `sameAs` in the site's structured data.
 */

type SocialLink = {
  key: string
  label: string
  url: string
  icon: (props: { className?: string }) => ReactElement
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export async function SiteFooter() {
  const [legal, siteName, facebook, instagram, linkedin, youtube] = await Promise.all([
    getLegalNavigation(),
    getString('general.site_name', 'GetScholarship'),
    getString('social.facebook_url', ''),
    getString('social.instagram_url', ''),
    getString('social.linkedin_url', ''),
    getString('social.youtube_url', ''),
  ])

  const socialLinks: SocialLink[] = [
    { key: 'facebook', label: 'Facebook', url: facebook, icon: FacebookIcon },
    { key: 'instagram', label: 'Instagram', url: instagram, icon: InstagramIcon },
    { key: 'linkedin', label: 'LinkedIn', url: linkedin, icon: LinkedInIcon },
    { key: 'youtube', label: 'YouTube', url: youtube, icon: YouTubeIcon },
  ].filter((item) => item.url.trim() !== '')

  return (
    <footer className="mt-auto border-t border-ink-200 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:items-center sm:text-left">
          <p className="text-sm text-ink-500 sm:flex-1">
            &copy; {new Date().getUTCFullYear()} {siteName}.online
          </p>

          {socialLinks.length > 0 ? (
            <ul
              className="flex items-center justify-center gap-2 sm:flex-none"
              aria-label="Social media"
            >
              {socialLinks.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.key}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {legal.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:flex-1 sm:justify-end">
              {legal.filter((item) => item.href !== '/editorial-standards').map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="text-sm text-ink-600 hover:text-brand-800 hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
