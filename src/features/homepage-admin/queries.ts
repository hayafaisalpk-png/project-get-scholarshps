import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type HomepageSectionRow = {
  key: string
  heading: string | null
  subheading: string | null
  sortOrder: number
  isVisible: boolean
  config: string
}

export const listHomepageSections = cache(async (): Promise<HomepageSectionRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('homepage_sections')
    .select('key, heading, subheading, sort_order, is_visible, config')
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    key: row.key,
    heading: row.heading,
    subheading: row.subheading,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    config: JSON.stringify(row.config ?? {}),
  }))
})