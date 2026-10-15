import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/**
 * Navigation reader.
 *
 * Navigation is database-driven so editors can reorder or hide items without a
 * redeploy. Items are hierarchical (`parent_id`), and this reader returns a tree.
 */

export type NavigationItem = {
  id: string
  label: string
  href: string
  parent_id: string | null
  location: string
  sort_order: number
  is_visible: boolean
  opens_in_new_tab: boolean
  children: NavigationItem[]
}

const VALID_LOCATIONS = [
  'header',
  'footer_column_1',
  'footer_column_2',
  'footer_column_3',
  'footer_column_4',
  'legal',
] as const

export type NavigationLocation = (typeof VALID_LOCATIONS)[number]

/**
 * Load one navigation area.
 *
 * `location` is validated against an allowlist because it comes from the URL in
 * the footer case; the value becomes a PostgREST filter and must never be
 * interpolated unvalidated.
 */
export const getNavigation = cache(
  async (location: NavigationLocation): Promise<NavigationItem[]> => {
    if (!VALID_LOCATIONS.includes(location)) return []

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('navigation_items')
      .select(
        'id, label, href, parent_id, location, sort_order, is_visible, opens_in_new_tab',
      )
      .eq('location', location)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[navigation] load failed:', error.message)
      return []
    }

    const rows = (data ?? []).filter((r) => r.is_visible)

    // Build the tree in one pass rather than querying per parent.
    const byParent = new Map<string | null, NavigationItem[]>()

    for (const row of rows) {
      const item: NavigationItem = { ...row, children: [] }
      const siblings = byParent.get(item.parent_id) ?? []
      siblings.push(item)
      byParent.set(item.parent_id, siblings)
    }

    const attachChildren = (parentId: string | null): NavigationItem[] =>
      (byParent.get(parentId) ?? []).map((item) => ({
        ...item,
        children: attachChildren(item.id),
      }))

    return attachChildren(null)
  },
)

/** Header navigation. */
export const getHeaderNavigation = cache(() => getNavigation('header'))

/** Footer columns, each in its configured order. */
export const getFooterNavigation = cache(async (): Promise<
  Record<string, NavigationItem[]>
> => {
  const columns: NavigationItem[][] = await Promise.all([
    getNavigation('footer_column_1'),
    getNavigation('footer_column_2'),
    getNavigation('footer_column_3'),
    getNavigation('footer_column_4'),
  ])

  return {
    footer_column_1: columns[0] ?? [],
    footer_column_2: columns[1] ?? [],
    footer_column_3: columns[2] ?? [],
    footer_column_4: columns[3] ?? [],
  }
})

/** Legal links (privacy, terms, editorial standards). */
export const getLegalNavigation = cache(() => getNavigation('legal'))
