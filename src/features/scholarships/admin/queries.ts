import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import {
  type ScholarshipStatus,
  SCHOLARSHIP_STATUSES,
} from '@/lib/validation/scholarship'
import { createClient } from '@/lib/supabase/server'

/**
 * Administration queries for scholarships.
 *
 * Two rules carried over from the public query layer:
 *
 *   1. Every read uses the SESSION client, never the service-role client, so
 *      RLS constrains our own reads exactly as it constrains everyone else's.
 *      Using the admin client here would be a quiet way to leak drafts.
 *   2. Filtering, search, sorting and pagination happen in PostgreSQL. The full
 *      result set is never pulled into memory to be filtered in the browser.
 */

export const ADMIN_PAGE_SIZE = 20

export type AdminScholarshipRow = {
  id: string
  slug: string
  title: string
  sponsor_name: string
  status: string
  verification_status: string
  featured: boolean
  deadline: string | null
  is_rolling: boolean
  published_at: string | null
  award_amount_min_cents: number | null
  award_amount_max_cents: number | null
  award_amount_text: string | null
  award_currency: string
  updated_at: string
  created_at: string
  created_by: string | null
}

export type AdminListResult = {
  items: AdminScholarshipRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminListParams = {
  q?: string | undefined
  status?: string | undefined
  page?: number | undefined
}

/**
 * Validate a status filter.
 *
 * An unknown value falls back to "no filter" rather than being interpolated
 * into a query, so a hand-edited URL cannot widen the result set.
 */
function parseStatus(value: string | undefined): ScholarshipStatus | null {
  if (!value) return null
  const match = SCHOLARSHIP_STATUSES.find((s) => s === value)
  return match ?? null
}

/** Escape PostgREST `or` syntax characters in a user-supplied search term. */
function escapeSearch(term: string): string {
  return term.replace(/[,()%]/g, ' ').trim()
}

export const listAdminScholarships = cache(
  async (params: AdminListParams): Promise<DbResult<AdminListResult>> => {
    const supabase = await createClient()
    const pageSize = ADMIN_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize
    const status = parseStatus(params.status)

    /*
     * Single string literal, never concatenation: PostgREST's type parser needs
     * the literal type to infer the row shape. Building the column list with
     * `+` or `Array.join` widens it to `string` and collapses the result to
     * GenericStringError.
     */
    let query = supabase
      .from('scholarships')
      .select(
        'id, slug, title, sponsor_name, status, verification_status, featured, deadline, is_rolling, published_at, award_amount_min_cents, award_amount_max_cents, award_amount_text, award_currency, updated_at, created_at, created_by',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const term = params.q?.trim()
    if (term) {
      const safe = escapeSearch(term)
      if (safe) {
        // `title` and `sponsor_name` both have trigram indexes; this stays
        // typo-tolerant without requiring a tsquery parse.
        query = query.or(
          `title.ilike.%${safe}%,sponsor_name.ilike.%${safe}%`,
        )
      }
    }

    const { data, error, count } = await query

    if (error) {
      return { ok: false, error: toDatabaseError(error) }
    }

    const total = count ?? 0

    return {
      ok: true,
      data: {
        items: (data ?? []) as AdminScholarshipRow[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/** Counts per status, for the filter chips. */
export const scholarshipStatusCounts = cache(
  async (): Promise<Record<string, number>> => {
    const supabase = await createClient()

    const { data, error } = await supabase.from('scholarships').select('status')

    const counts: Record<string, number> = {}
    for (const status of SCHOLARSHIP_STATUSES) counts[status] = 0
    if (error) return counts

    for (const row of data ?? []) {
      const key = row.status as string
      if (key in counts) counts[key] = (counts[key] ?? 0) + 1
    }

    return counts
  },
)

/* -------------------------------------------------------------------------- */
/* Single record                                                              */
/* -------------------------------------------------------------------------- */

export type AdminScholarshipDetail = {
  id: string
  slug: string
  title: string
  sponsor_name: string
  institution_id: string | null
  institution_logo_url: string | null
  institution_country: string | null
  summary: string | null
  description: string | null
  eligibility_requirements: string | null
  application_instructions: string | null
  required_documents: string | null
  application_url: string | null
  award_amount_min_cents: number | null
  award_amount_max_cents: number | null
  award_amount_text: string | null
  award_currency: string
  number_of_awards: number | null
  award_per_year: boolean
  application_fee_cents: number
  is_renewable: boolean
  renewal_details: string | null
  max_renewals: number | null
  opens_at: string | null
  deadline: string | null
  is_rolling: boolean
  status: string
  published_at: string | null
  archived_at: string | null
  verification_status: string
  verified_at: string | null
  last_reviewed_at: string | null
  featured: boolean
  featured_until: string | null
  internal_notes: string | null
  seo_title: string | null
  seo_description: string | null
  noindex: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ScholarshipTaxonomy = {
  category_ids: string[]
  education_level_ids: string[]
  field_ids: string[]
  location_ids: string[]
}

export type AdminScholarshipDetailResult = {
  record: AdminScholarshipDetail
  taxonomy: ScholarshipTaxonomy
}

/**
 * Load one scholarship for editing, with its taxonomy assignments.
 *
 * The joins are fetched in parallel rather than as a nested PostgREST embed:
 * four `in` filters are cheap and keep the row shape flat and predictable.
 */
export const getAdminScholarship = cache(
  async (id: string): Promise<DbResult<AdminScholarshipDetailResult | null>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('scholarships')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return { ok: false, error: toDatabaseError(error) }
    if (!data) return { ok: true, data: null }

    // Hydrate institution display fields (logo, country) from the related record.
    let institutionLogoUrl: string | null = null
    let institutionCountry: string | null = null
    if (data.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('logo_url, country')
        .eq('id', data.institution_id)
        .maybeSingle()
      institutionLogoUrl = inst?.logo_url ?? null
      institutionCountry = inst?.country ?? null
    }

    const [categories, levels, fields, locations] = await Promise.all([
      supabase
        .from('scholarship_categories')
        .select('category_id')
        .eq('scholarship_id', id),
      supabase
        .from('scholarship_education_levels')
        .select('education_level_id')
        .eq('scholarship_id', id),
      supabase
        .from('scholarship_fields')
        .select('academic_field_id')
        .eq('scholarship_id', id),
      supabase
        .from('scholarship_locations')
        .select('location_id')
        .eq('scholarship_id', id),
    ])

    return {
      ok: true,
      data: {
        record: {
          ...(data as unknown as AdminScholarshipDetail),
          institution_logo_url: institutionLogoUrl,
          institution_country: institutionCountry,
        },
        taxonomy: {
          category_ids: (categories.data ?? []).map((r) => r.category_id),
          education_level_ids: (levels.data ?? []).map(
            (r) => r.education_level_id,
          ),
          field_ids: (fields.data ?? []).map((r) => r.academic_field_id),
          location_ids: (locations.data ?? []).map((r) => r.location_id),
        },
      },
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Taxonomy options                                                           */
/* -------------------------------------------------------------------------- */

export type TaxonomyOption = { id: string; name: string; slug: string }
export type LocationOption = TaxonomyOption & { type: string }

export type TaxonomyOptions = {
  categories: TaxonomyOption[]
  educationLevels: TaxonomyOption[]
  fields: TaxonomyOption[]
  locations: LocationOption[]
}

/**
 * Active taxonomy values for the assignment controls.
 *
 * Only `status = 'active'` rows are offered. An inactive category can stay on
 * existing records (they are not rewritten) but cannot be newly assigned.
 */
export const getTaxonomyOptions = cache(
  async (): Promise<DbResult<TaxonomyOptions>> => {
    const supabase = await createClient()

    const [categories, levels, fields, locations] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('education_levels')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('sort_order'),
      supabase
        .from('academic_fields')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('locations')
        .select('id, name, slug, type')
        .eq('status', 'active')
        .order('name'),
    ])

    const firstError =
      categories.error ?? levels.error ?? fields.error ?? locations.error

    if (firstError) return { ok: false, error: toDatabaseError(firstError) }

    return {
      ok: true,
      data: {
        categories: categories.data ?? [],
        educationLevels: levels.data ?? [],
        fields: fields.data ?? [],
        locations: locations.data ?? [],
      },
    }
  },
)