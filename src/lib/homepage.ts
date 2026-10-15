import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/**
 * Homepage composition reader.
 *
 * The homepage is assembled from `homepage_sections` rows so editors control
 * which blocks appear, in what order, and with what headings and item limits —
 * without a redeploy. Section `config` is JSON; it is parsed defensively because
 * an editor typing a bad limit must not break the page.
 */

export type HomepageSection = {
  id: string
  key: string
  heading: string | null
  subheading: string | null
  is_visible: boolean
  sort_order: number
  config: HomepageSectionConfig
}

export type HomepageSectionConfig = {
  /** How many items to show. Clamped to a sane range. */
  limit: number
  /** Layout hint for the renderer. */
  layout?: string
  /** Optional explicit scholarship slugs, for hand-picked blocks. */
  slugs?: string[]
}

const DEFAULT_LIMIT = 6
const MAX_LIMIT = 24

export const getHomepageSections = cache(
  async (): Promise<HomepageSection[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('homepage_sections')
      .select('id, key, heading, subheading, is_visible, sort_order, config')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[homepage] sections query failed:', error.message)
      return []
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      heading: row.heading,
      subheading: row.subheading,
      is_visible: row.is_visible,
      sort_order: row.sort_order,
      config: parseConfig(row.config),
    }))
  },
)

function parseConfig(raw: unknown): HomepageSectionConfig {
  if (typeof raw !== 'object' || raw === null) return { limit: DEFAULT_LIMIT }

  const record = raw as Record<string, unknown>

  const rawLimit = record.limit
  const limit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
      : DEFAULT_LIMIT

  const rawSlugs = record.slugs

  return {
    limit,
    layout: typeof record.layout === 'string' ? record.layout : undefined,
    slugs: Array.isArray(rawSlugs)
      ? rawSlugs.filter((s): s is string => typeof s === 'string').slice(0, MAX_LIMIT)
      : undefined,
  }
}
