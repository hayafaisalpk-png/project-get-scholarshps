import 'server-only'

import { cache } from 'react'

import type { Permission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Dashboard aggregates.
 *
 * Every figure is produced by a real query against the database. Nothing here
 * is a placeholder or a demonstration number: on an empty installation these
 * legitimately read zero.
 *
 * Two deliberate choices:
 *
 *   1. Each group is fetched only when the viewer holds a relevant permission,
 *      because a denied query would otherwise surface as an error rather than
 *      an absent card.
 *   2. A failed query resolves to `null` instead of throwing. A dashboard that
 *      renders an error page because one counter failed is worse than one that
 *      honestly omits that card.
 *
 * Row Level Security remains the enforcement boundary; these queries are
 * additionally scoped by the viewer's session, so a count can never include
 * rows the viewer could not read directly.
 */

export type StatusBreakdown = {
  total: number
  draft: number
  inReview: number
  published: number
  scheduled: number
  expired: number
  archived: number
}

export type RecentActivity = {
  id: number
  action: string
  entityType: string
  entityId: string | null
  actorEmail: string | null
  createdAt: string
}

export type DashboardStats = {
  scholarships: StatusBreakdown | null
  articles: StatusBreakdown | null
  taxonomy: {
    categories: number | null
    tags: number | null
    educationLevels: number | null
    academicFields: number | null
    locations: number | null
  }
  media: { total: number | null }
  users: { total: number | null }
  recentActivity: RecentActivity[]
  /** Tables that could not be read, so the UI can be honest about gaps. */
  unavailable: string[]
}

const EMPTY_BREAKDOWN: StatusBreakdown = {
  total: 0,
  draft: 0,
  inReview: 0,
  published: 0,
  scheduled: 0,
  expired: 0,
  archived: 0,
}

/** Count rows, returning null when the table is not readable by this viewer. */
async function count(
  table: 'scholarships' | 'articles' | 'media_assets',
  column: string,
): Promise<number | null> {
  const supabase = await createClient()
  const { count: value, error } = await supabase
    .from(table)
    .select(column, { count: 'exact', head: true })

  if (error) return null
  return value ?? 0
}

/** Group scholarships by status in a single round trip. */
async function scholarshipBreakdown(): Promise<StatusBreakdown | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scholarships')
    .select('status')

  if (error) return null

  const breakdown: StatusBreakdown = { ...EMPTY_BREAKDOWN }

  for (const row of data) {
    breakdown.total += 1
    switch (row.status) {
      case 'draft':
        breakdown.draft += 1
        break
      case 'pending_review':
        breakdown.inReview += 1
        break
      case 'published':
        breakdown.published += 1
        break
      case 'expired':
        breakdown.expired += 1
        break
      case 'archived':
        breakdown.archived += 1
        break
    }
  }

  return breakdown
}

/** Group articles by status in a single round trip. */
async function articleBreakdown(): Promise<StatusBreakdown | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('articles').select('status')

  if (error) return null

  const breakdown: StatusBreakdown = { ...EMPTY_BREAKDOWN }

  for (const row of data) {
    breakdown.total += 1
    switch (row.status) {
      case 'draft':
        breakdown.draft += 1
        break
      case 'in_review':
        breakdown.inReview += 1
        break
      case 'scheduled':
        breakdown.scheduled += 1
        break
      case 'published':
        breakdown.published += 1
        break
      case 'archived':
        breakdown.archived += 1
        break
      // 'expired' is not a scholarship concept; articles never reach it.
    }
  }

  return breakdown
}

async function taxonomyCounts() {
  const supabase = await createClient()

  const tables = [
    'categories',
    'tags',
    'education_levels',
    'academic_fields',
    'locations',
  ] as const

  const results = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      return [table, error ? null : (count ?? 0)] as const
    }),
  )

  return Object.fromEntries(results) as Record<string, number | null>
}

async function recentActivity(): Promise<RecentActivity[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, actor_email, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
  }))
}

/**
 * Load everything the dashboard shows.
 *
 * Memoised per request so the layout and the page share one set of queries.
 */
export const getDashboardStats = cache(
  async (
    permissions: readonly Permission[],
  ): Promise<DashboardStats> => {
    const can = (p: Permission) => permissions.includes(p)

    const wantsScholarships = can('scholarship.manage')
    const wantsArticles =
      can('article.manage') ||
      can('article.create') ||
      can('article.edit_own')
    const wantsTaxonomy = can('taxonomy.manage')
    const wantsMedia = can('media.manage') || can('media.upload')
    const wantsUsers = can('user.manage')
    const wantsAudit = can('audit.view')

    const [
      scholarships,
      articles,
      taxonomy,
      mediaTotal,
      userTotal,
      activity,
    ] = await Promise.all([
      wantsScholarships ? scholarshipBreakdown() : Promise.resolve(null),
      wantsArticles ? articleBreakdown() : Promise.resolve(null),
      wantsTaxonomy
        ? taxonomyCounts()
        : Promise.resolve({
            categories: null,
            tags: null,
            education_levels: null,
            academic_fields: null,
            locations: null,
          }),
      wantsMedia ? count('media_assets', 'id') : Promise.resolve(null),
      wantsUsers ? countUsers() : Promise.resolve(null),
      wantsAudit ? recentActivity() : Promise.resolve([]),
    ])

    const unavailable: string[] = []
    if (wantsScholarships && scholarships === null)
      unavailable.push('scholarships')
    if (wantsArticles && articles === null) unavailable.push('articles')
    if (wantsMedia && mediaTotal === null) unavailable.push('media_assets')

    return {
      scholarships,
      articles,
      taxonomy: {
        categories: taxonomy.categories ?? null,
        tags: taxonomy.tags ?? null,
        educationLevels: taxonomy.education_levels ?? null,
        academicFields: taxonomy.academic_fields ?? null,
        locations: taxonomy.locations ?? null,
      },
      media: { total: mediaTotal },
      users: { total: userTotal },
      recentActivity: activity,
      unavailable,
    }
  },
)

/** Count user accounts. Requires `user.manage`; RLS blocks everyone else. */
async function countUsers(): Promise<number | null> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('user_role_summary')
    .select('*', { count: 'exact', head: true })

  if (error) return null
  return count ?? 0
}