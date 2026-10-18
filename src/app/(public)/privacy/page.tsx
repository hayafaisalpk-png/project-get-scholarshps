import type { Metadata } from 'next'

import { ContentPage, contentPageMetadata } from '@/components/layout/content-page'

export async function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata('privacy')
}

export default function PrivacyPage() {
  return <ContentPage slug="privacy" />
}