import type { Metadata } from 'next'

import { ContentPage, contentPageMetadata } from '@/components/layout/content-page'

export async function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata('terms')
}

export default function TermsPage() {
  return <ContentPage slug="terms" />
}