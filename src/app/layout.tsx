import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import { getSiteUrl } from '@/lib/env'
import { ConsentManager } from '@/features/consent/consent-manager'

import './globals.css'

/*
 * Inter is the only family. The reference distinguishes headings by weight
 * (800) rather than by typeface, so the previous second display face
 * (Plus Jakarta Sans) has been removed rather than left loading unused.
 * See docs/REFERENCE_ANALYSIS.md.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#100826' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'GetScholarship — Find Scholarships, Grants & Financial Aid',
    template: '%s | GetScholarship',
  },
  description:
    'Search verified scholarships, grants and financial aid opportunities. Filter by education level, field of study and location.',
  applicationName: 'GetScholarship',
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    siteName: 'GetScholarship',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable}`}
      // Next.js 16 no longer overrides this automatically.
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ConsentManager>{children}</ConsentManager>
      </body>
    </html>
  )
}
