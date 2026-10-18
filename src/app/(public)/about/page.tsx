import type { Metadata } from 'next'

import { ContentPage, contentPageMetadata } from '@/components/layout/content-page'

/**
 * About page.
 *
 * The copy is database content (see migration 021); this file exists only to
 * bind a URL to a slug. See `docs/CHANGELOG.md` for why the header and footer
 * advertised this route before it had one.
 */

export async function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata('about')
}

export default function AboutPage() {
  return <ContentPage slug="about" />
}