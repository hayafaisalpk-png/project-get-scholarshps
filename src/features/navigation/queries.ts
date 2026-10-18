import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type NavItemRow = {
  id: string
  label: string
  href: string
  location: string
  sortOrder: number
  isVisible: boolean
}

export const listNavigationItems = cache(async (): Promise<NavItemRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('navigation_items')
    .select('id, label, href, location, sort_order, is_visible')
    .order('location', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    label: row.label,
    href: row.href,
    location: row.location,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  }))
})