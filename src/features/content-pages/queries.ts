import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type ContentPageRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string | null
  status: string
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string | null
}

const SELECT =
  'id, slug, title, excerpt, body, status, sort_order, seo_title, seo_description, updated_at'

export const listContentPages = cache(async (): Promise<ContentPageRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_pages')
    .select(SELECT)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status,
    sortOrder: row.sort_order,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: row.updated_at,
  }))
})

export const getContentPage = cache(
  async (slug: string): Promise<ContentPageRow | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('content_pages')
      .select(SELECT)
      .eq('slug', slug)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      status: data.status,
      sortOrder: data.sort_order,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      updatedAt: data.updated_at,
    }
  },
)