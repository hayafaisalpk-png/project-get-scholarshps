import type { Metadata } from 'next'

import { ContentPage, contentPageMetadata } from '@/components/layout/content-page'

export async function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata('help')
}

export default function HelpPage() {
  return <ContentPage slug="help" />
}