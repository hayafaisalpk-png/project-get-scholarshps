import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type TaxonomyKind = 'categories' | 'tags' | 'education_levels' | 'academic_fields' | 'locations'

export type TaxonomyRow = {
  id: string
  kind: TaxonomyKind
  slug: string
  name: string
  extra: string | null
  status: string
  sortOrder: number
}

const TABLE: Record<TaxonomyKind, string> = {
  categories: 'categories',
  tags: 'tags',
  education_levels: 'education_levels',
  academic_fields: 'academic_fields',
  locations: 'locations',
}

export const listTaxonomy = cache(
  async (kind: TaxonomyKind): Promise<TaxonomyRow[]> => {
    const supabase = await createClient()
    const table = TABLE[kind]
    const query = supabase
      .from(table as never)
      .select(kind === 'tags' ? 'id, slug, name, status' : 'id, slug, name, status, sort_order')
    const { data, error } = kind === 'tags'
      ? await query.order('name', { ascending: true })
      : await query.order('sort_order', { ascending: true })

    if (error || !data) return []

    return (data as { id: string; slug: string; name: string; status: string; sort_order?: number }[]).map(
      (row) => ({
        id: row.id,
        kind,
        slug: row.slug,
        name: row.name,
        extra: null,
        status: row.status,
        sortOrder: row.sort_order ?? 0,
      }),
    )
  },
)
