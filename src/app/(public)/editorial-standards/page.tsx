import type { Metadata } from 'next'

import { ContentPage, contentPageMetadata } from '@/components/layout/content-page'

export async function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata('editorial-standards')
}

export default function EditorialStandardsPage() {
  return <ContentPage slug="editorial-standards" />
}