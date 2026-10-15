import type { Metadata } from 'next'

import {
  TAXONOMY_KINDS,
  renderTaxonomyPage,
  taxonomyMetadata,
} from '@/features/scholarships/components/taxonomy-landing'
import type { RawSearchParams } from '@/features/scholarships/search-params'

/**
 * /scholarships/category/[slug] landing page.
 *
 * Thin route over the shared taxonomy renderer. All behaviour, including the
 * decision to 404 a thin page, lives in taxonomy-landing.tsx.
 */

const KIND = TAXONOMY_KINDS.category

export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ slug: string }>
  searchParams: Promise<RawSearchParams>
}

export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const [{ slug }, raw] = await Promise.all([params, searchParams])
  return taxonomyMetadata({ kind: KIND, slug, raw })
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const [{ slug }, raw] = await Promise.all([params, searchParams])
  return renderTaxonomyPage({ kind: KIND, slug, raw })
}
