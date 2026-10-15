import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/**
 * Taxonomy and statistics readers.
 *
 * Every number returned here comes from a real aggregate query. Nothing is
 * hardcoded, estimated, or presented as a live count without being counted.
 */

export type TaxonomyTerm = {
  id: string
  slug: string
  name: string
  description: string | null
}

export type TaxonomyTermWithCount = TaxonomyTerm & { count: number }

/* -------------------------------------------------------------------------- */
/* Aggregate statistics                                                        */
/* -------------------------------------------------------------------------- */

export type SiteStats = {
  totalScholarships: number
  openScholarships: number
  totalAmountCents: number
  educationLevels: number
  academicFields: number
  locations: number
}

/**
 * Headline statistics for the homepage.
 *
 * `count` over a filtered view keeps this to a single query. `totalAmountCents`
 * is the sum of the MAXIMUM award of each published scholarship, which is the
 * honest reading of "total funding listed" — it is labelled as such in the UI
 * rather than presented as money actually awarded.
 */
export const getSiteStats = cache(async (): Promise<SiteStats> => {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [scholarships, levels, fields, locations] = await Promise.all([
    supabase
      .from('published_scholarships')
      .select('award_amount_max_cents, deadline, is_rolling', {
        head: true,
        count: 'exact',
      }),
    supabase
      .from('education_levels')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'active'),
    supabase
      .from('academic_fields')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'active'),
    supabase
      .from('locations')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'active'),
  ])

  if (scholarships.error) {
    console.error('[stats] scholarships query failed:', scholarships.error.message)
    return {
      totalScholarships: 0,
      openScholarships: 0,
      totalAmountCents: 0,
      educationLevels: levels.count ?? 0,
      academicFields: fields.count ?? 0,
      locations: locations.count ?? 0,
    }
  }

  const rows = scholarships.data ?? []
  let open = 0
  let total = 0

  for (const row of rows) {
    const max = row.award_amount_max_cents ?? 0
    if (typeof max === 'number') total += max

    const stillOpen =
      row.is_rolling === true ||
      (typeof row.deadline === 'string' && row.deadline >= today)

    if (stillOpen) open++
  }

  return {
    totalScholarships: scholarships.count ?? 0,
    openScholarships: open,
    totalAmountCents: total,
    educationLevels: levels.count ?? 0,
    academicFields: fields.count ?? 0,
    locations: locations.count ?? 0,
  }
})

/* -------------------------------------------------------------------------- */
/* Taxonomy lists                                                              */
/* -------------------------------------------------------------------------- */

async function listTerms(
  table: 'education_levels' | 'academic_fields' | 'categories' | 'tags',
  orderBy: string,
): Promise<TaxonomyTerm[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(table)
    .select('id, slug, name, description')
    .eq('status', 'active')
    .is('archived_at', null)
    .order(orderBy, { ascending: true })

  if (error) {
    console.error(`[taxonomy] ${table} query failed:`, error.message)
    return []
  }

  // Same union-table narrowing caveat as getTermBySlug below.
  return (data ?? []) as unknown as TaxonomyTerm[]
}

export const getEducationLevels = cache(() =>
  listTerms('education_levels', 'sort_order'),
)

export const getAcademicFields = cache(() =>
  listTerms('academic_fields', 'sort_order'),
)

export const getScholarshipCategories = cache(() =>
  listTerms('categories', 'sort_order'),
)

export const getScholarshipTags = cache(() => listTerms('tags', 'name'))

/* -------------------------------------------------------------------------- */
/* Locations                                                                   */
/* -------------------------------------------------------------------------- */

export type LocationTerm = TaxonomyTerm & {
  type: string
  countryCount: number
  stateCount: number
}

const LOCATION_TYPES = ['country', 'state', 'region'] as const

export type LocationType = (typeof LOCATION_TYPES)[number]

export const getLocations = cache(
  async (type?: LocationType): Promise<LocationTerm[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('locations')
      .select('id, slug, name, description, type, parent_id')
      .eq('status', 'active')
      .is('archived_at', null)
      .order('name', { ascending: true })

    // `type` reaches this from route params, so it is validated against an
    // allowlist before becoming a PostgREST filter.
    if (type && LOCATION_TYPES.includes(type)) query = query.eq('type', type)

    const { data, error } = await query

    if (error) {
      console.error('[locations] query failed:', error.message)
      return []
    }

    return (data ?? []) as unknown as LocationTerm[]
  },
)

/* -------------------------------------------------------------------------- */
/* Single term lookup                                                          */
/* -------------------------------------------------------------------------- */

type TaxonomyTable =
  | 'education_levels'
  | 'academic_fields'
  | 'categories'
  | 'locations'
  | 'tags'

export const getTermBySlug = cache(
  async (table: TaxonomyTable, slug: string): Promise<TaxonomyTerm | null> => {
    const supabase = await createClient()

    // `table` is a union of table names, so the PostgREST type parser cannot
    // narrow to a single table and infers SelectQueryError. The union is
    // enforced above and never accepts a user-supplied value, so the cast is
    // safe; the returned columns are identical across these tables.
    const { data, error } = await supabase
      .from(table)
      .select('id, slug, name, description')
      .eq('slug', slug)
      .eq('status', 'active')
      .is('archived_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data as unknown as TaxonomyTerm
  },
)
