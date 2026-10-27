import 'server-only'

import { cache } from 'react'

import {
  type ScholarshipSearch,
  toSearchRpcArgs,
} from '@/features/scholarships/search-params'
import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'
import { sanitizeArticleHtml } from '@/lib/sanitize'

/**
 * Scholarship queries.
 *
 * Every read uses the SESSION client, never the service-role client, so Row
 * Level Security applies to our own queries exactly as it does to anyone else's.
 * Using the admin client here would be an easy way to silently leak drafts.
 *
 * Filtering, search, sorting and pagination all happen in PostgreSQL. The full
 * result set is never fetched and filtered in the browser.
 */

/** Shape consumed by scholarship cards. Kept narrow to limit payload size. */
export type InstitutionSummary = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  country: string | null
}

export type ScholarshipCard = {
  id: string
  slug: string
  title: string
  sponsor_name: string
  institution: InstitutionSummary | null
  summary: string | null
  award_amount_min_cents: number | null
  award_amount_max_cents: number | null
  award_amount_text: string | null
  award_currency: string
  number_of_awards: number | null
  is_renewable: boolean
  application_fee_cents: number
  deadline: string | null
  is_rolling: boolean
  verification_status: string
  verified_at: string | null
  last_reviewed_at: string | null
  featured: boolean
  published_at: string | null
}

export type SearchResult = {
  items: ScholarshipCard[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Column list for scholarship cards.
 *
 * Declared as a single `as const` literal rather than built with `Array.join`:
 * the PostgREST type parser needs the literal type to infer row shapes, and
 * `join()` widens to `string`, which collapses the result to GenericStringError.
 */
export const CARD_FIELDS =
  'id,slug,title,sponsor_name,institution_id,summary,award_amount_min_cents,award_amount_max_cents,award_amount_text,award_currency,number_of_awards,is_renewable,application_fee_cents,deadline,is_rolling,verification_status,verified_at,last_reviewed_at,featured,published_at' as const

/** Column list for the detail page, including embedded taxonomy. */
const DETAIL_SELECT =
  'id,slug,title,sponsor_name,institution_id,institutions(id,name,slug,logo_url,country),summary,description,eligibility_requirements,application_instructions,required_documents,application_url,opens_at,deadline,is_rolling,award_amount_min_cents,award_amount_max_cents,award_amount_text,award_currency,number_of_awards,award_per_year,application_fee_cents,is_renewable,renewal_details,max_renewals,status,verification_status,verified_at,last_reviewed_at,seo_title,seo_description,published_at,noindex,updated_at,scholarship_categories(categories(slug,name)),scholarship_education_levels(education_levels(slug,name)),scholarship_fields(academic_fields(slug,name)),scholarship_locations(locations(slug,name)),scholarship_tags(tags(slug,name))' as const

/* -------------------------------------------------------------------------- */
/* Derived deadline state                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whether a published, non-rolling scholarship is past its deadline.
 *
 * Mirrors `public.scholarship_is_expired()` in PostgreSQL. The database
 * function stays authoritative for anything computed in SQL (facet counts, the
 * public views); this exists so the card component can render a status badge
 * without a second round trip.
 */
export function isScholarshipExpired(
  status: string,
  deadline: string | null,
  isRolling: boolean,
  today: Date = new Date(),
): boolean {
  if (status !== 'published' || isRolling || !deadline) return false
  return deadline < toIsoDate(today)
}

/** Days until the deadline. Negative once passed, null for rolling awards. */
export function daysRemaining(
  deadline: string | null,
  today: Date = new Date(),
): number | null {
  if (!deadline) return null

  const target = Date.parse(`${deadline}T00:00:00Z`)
  const base = Date.parse(`${toIsoDate(today)}T00:00:00Z`)

  if (Number.isNaN(target) || Number.isNaN(base)) return null

  return Math.round((target - base) / 86_400_000)
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Run a scholarship search.
 *
 * Delegates to `public.search_scholarships()`, which owns taxonomy joins,
 * weighted full-text relevance, deadline windows, sorting and pagination.
 * Keeping that in SQL means one round trip and a correct total count.
 *
 * The function is SECURITY INVOKER, so the caller's Row Level Security applies:
 * a draft or pending record can never be returned, even though the function
 * itself does not re-check status beyond its own WHERE clause.
 */
export async function searchScholarships(
  search: ScholarshipSearch,
  options: { pageSize?: number } = {},
): Promise<DbResult<SearchResult>> {
  const args = toSearchRpcArgs(search, options)

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('search_scholarships', args)

  if (error) {
    return { ok: false, error: toDatabaseError(error) }
  }

  const rows = (data ?? []) as SearchRpcRow[]

  // total_count comes back on every row via a window function. On an empty
  // result there is no row to read it from, so the total is correctly zero.
  const total = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0

  // Batch-fetch institution records for the sponsors on this page so cards can
  // render a shared logo without an N+1 query. Matched by exact name, mirroring
  // the migration that created one institution per distinct sponsor_name.
  const sponsorNames = Array.from(
    new Set(rows.map((r) => r.sponsor_name).filter(Boolean)),
  )
  const institutionByName = new Map<string, InstitutionSummary>()
  if (sponsorNames.length > 0) {
    const { data: instData } = await supabase
      .from('institutions')
      .select('id,name,slug,logo_url,country')
      .in('name', sponsorNames)
    for (const inst of instData ?? []) {
      institutionByName.set(inst.name, inst as InstitutionSummary)
    }
  }

  return {
    ok: true,
    data: {
      items: rows.map((row) =>
        toCard(row, institutionByName.get(row.sponsor_name) ?? null),
      ),
      total,
      page: search.page,
      pageSize: args.p_page_size,
      totalPages: Math.ceil(total / args.p_page_size),
    },
  }
}

/** Row shape returned by public.search_scholarships(). */
type SearchRpcRow = {
  id: string
  slug: string
  title: string
  sponsor_name: string
  summary: string | null
  award_amount_min_cents: number | null
  award_amount_max_cents: number | null
  award_amount_text: string | null
  award_currency: string
  number_of_awards: number | null
  is_renewable: boolean
  application_fee_cents: number
  deadline: string | null
  is_rolling: boolean
  verification_status: string
  verified_at: string | null
  last_reviewed_at: string | null
  featured: boolean
  published_at: string | null
  is_expired: boolean
  days_remaining: number | null
  search_rank: number | null
  total_count: number
}

/**
 * Strip the two SQL-only columns from a search result row.
 *
 * `search_rank` is an internal sort signal and `total_count` is pagination
 * metadata; neither belongs on a card.
 */
function toCard(
  row: SearchRpcRow,
  institution: InstitutionSummary | null,
): ScholarshipCard & {
  is_expired: boolean
  days_remaining: number | null
} {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sponsor_name: row.sponsor_name,
    institution,
    summary: row.summary,
    award_amount_min_cents: row.award_amount_min_cents,
    award_amount_max_cents: row.award_amount_max_cents,
    award_amount_text: row.award_amount_text,
    award_currency: row.award_currency,
    number_of_awards: row.number_of_awards,
    is_renewable: row.is_renewable,
    application_fee_cents: row.application_fee_cents,
    deadline: row.deadline,
    is_rolling: row.is_rolling,
    verification_status: row.verification_status,
    verified_at: row.verified_at,
    last_reviewed_at: row.last_reviewed_at,
    featured: row.featured,
    published_at: row.published_at,
    is_expired: row.is_expired,
    days_remaining: row.days_remaining,
  }
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

export type ScholarshipDetail = {
  id: string
  slug: string
  title: string
  sponsor_name: string
  institution: InstitutionSummary | null
  summary: string | null
  description: string | null
  eligibility_requirements: string | null
  application_instructions: string | null
  required_documents: string | null
  application_url: string | null
  opens_at: string | null
  deadline: string | null
  is_rolling: boolean
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
  status: string
  verification_status: string
  verified_at: string | null
  last_reviewed_at: string | null
  seo_title: string | null
  seo_description: string | null
  published_at: string | null
  /**
   * Set by an editor to keep a published record out of search results.
   *
   * It has to be selected here or the page cannot honour it: the sitemap skips
   * `noindex` rows, but a sitemap is only one discovery path. Any crawler
   * following an inbound link reads the page's own robots meta, and before this
   * column was added that meta said nothing at all — so the record was excluded
   * from the sitemap and simultaneously advertised as indexable.
   */
  noindex: boolean
  updated_at: string
  sources: { source_url: string; source_name: string; retrieved_at: string | null }[]
  categories: { slug: string; name: string }[]
  education_levels: { slug: string; name: string }[]
  fields: { slug: string; name: string }[]
  locations: { slug: string; name: string }[]
  tags: { slug: string; name: string }[]
}

/**
 * Load one published scholarship by slug, or null.
 *
 * Returns null both when the record does not exist and when it exists but is
 * not published — an anonymous visitor must not be able to distinguish the two
 * by response time or error, so the page should 404 either way.
 */
export const getScholarshipBySlug = cache(
  async (slug: string): Promise<ScholarshipDetail | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('scholarships')
      .select(DETAIL_SELECT)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (error) {
      console.error('[scholarships] detail query failed:', error.message)
      return null
    }

    if (!data) return null

    // Provenance comes from a second query rather than an embed.
    //
    // `scholarship_sources` is CMS-only (its `notes` column is editorial), so
    // an anonymous visitor cannot read it at all and embedding it fails with
    // 42501. The `published_scholarship_sources` view exposes exactly the three
    // public columns for published scholarships. Views have no foreign keys, so
    // it cannot be embedded either — hence a second round trip.
    const { data: sourceRows } = await supabase
      .from('published_scholarship_sources')
      .select('source_url,source_name,retrieved_at')
      .eq('scholarship_id', data.id)
      .order('retrieved_at', { ascending: false, nullsFirst: false })

    // Embedded joins come back keyed by table name; flatten them to arrays and
    // drop nulls (a join row can be null when the referenced record is absent).
    const raw = data as unknown as Record<string, unknown> &
      Partial<ScholarshipDetail> & {
        scholarship_categories?: { categories: { slug: string; name: string } | null }[]
        scholarship_education_levels?: {
          education_levels: { slug: string; name: string } | null
        }[]
        scholarship_fields?: {
          academic_fields: { slug: string; name: string } | null
        }[]
        scholarship_locations?: {
          locations: { slug: string; name: string } | null
        }[]
        scholarship_tags?: { tags: { slug: string; name: string } | null }[]
        institutions?: InstitutionSummary | null
      }

    const unwrap = <T>(rows: { [k: string]: T | null }[] | undefined): T[] =>
      (rows ?? [])
        .map((r) => Object.values(r)[0])
        .filter((v): v is T => v !== null && v !== undefined)

    const {
      scholarship_categories,
      scholarship_education_levels,
      scholarship_fields,
      scholarship_locations,
      scholarship_tags,
      institutions,
      ...fields
    } = raw

    return {
      ...(fields as unknown as ScholarshipDetail),
      institution: (institutions as InstitutionSummary | null) ?? null,
      // Sanitised on read; see the article query for the rationale.
      eligibility_requirements: sanitizeArticleHtml(
        (fields as { eligibility_requirements?: string | null }).eligibility_requirements,
      ),
      application_instructions: sanitizeArticleHtml(
        (fields as { application_instructions?: string | null }).application_instructions,
      ),
      required_documents: sanitizeArticleHtml(
        (fields as { required_documents?: string | null }).required_documents,
      ),
      sources: (sourceRows ?? []) as ScholarshipDetail['sources'],
      categories: unwrap<{ slug: string; name: string }>(scholarship_categories),
      education_levels: unwrap<{ slug: string; name: string }>(
        scholarship_education_levels,
      ),
      fields: unwrap<{ slug: string; name: string }>(scholarship_fields),
      locations: unwrap<{ slug: string; name: string }>(scholarship_locations),
      tags: unwrap<{ slug: string; name: string }>(scholarship_tags),
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Institution attachment helper                                               */
/* -------------------------------------------------------------------------- */

/**
 * Attach the shared institution record to a batch of scholarship rows.
 *
 * Curated list queries read from `published_scholarships` (which exposes
 * `institution_id` but not the joined institution), so this performs one
 * follow-up query for all distinct sponsor names on the page. Matching by name
 * mirrors the migration that created one institution per distinct sponsor_name.
 */
async function attachInstitutions<
  T extends { sponsor_name: string },
>(rows: T[]): Promise<Array<T & { institution: InstitutionSummary | null }>> {
  if (rows.length === 0) return []

  const supabase = await createClient()
  const sponsorNames = Array.from(
    new Set(rows.map((r) => r.sponsor_name).filter(Boolean)),
  )
  const institutionByName = new Map<string, InstitutionSummary>()
  if (sponsorNames.length > 0) {
    const { data: instData } = await supabase
      .from('institutions')
      .select('id,name,slug,logo_url,country')
      .in('name', sponsorNames)
    for (const inst of instData ?? []) {
      institutionByName.set(inst.name, inst as InstitutionSummary)
    }
  }

  return rows.map((r) => ({
    ...r,
    institution: institutionByName.get(r.sponsor_name) ?? null,
  }))
}

/* -------------------------------------------------------------------------- */
/* Curated lists                                                               */
/* -------------------------------------------------------------------------- */

export const getFeaturedScholarships = cache(
  async (limit = 6): Promise<ScholarshipCard[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('published_scholarships')
      .select(CARD_FIELDS)
      .eq('featured', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      console.error('[scholarships] featured failed:', error.message)
      return []
    }

    return (await attachInstitutions((data ?? []) as Array<
      Omit<ScholarshipCard, 'institution'>
    >)) as ScholarshipCard[]
  },
)

/** Nearest deadlines that have not yet passed. */
export const getClosingSoonScholarships = cache(
  async (limit = 6): Promise<ScholarshipCard[]> => {
    const supabase = await createClient()
    const today = toIsoDate(new Date())

    const { data, error } = await supabase
      .from('published_scholarships')
      .select(CARD_FIELDS)
      .eq('is_rolling', false)
      .gte('deadline', today)
      .order('deadline', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[scholarships] closing soon failed:', error.message)
      return []
    }

    return (await attachInstitutions((data ?? []) as Array<
      Omit<ScholarshipCard, 'institution'>
    >)) as ScholarshipCard[]
  },
)

export const getRecentScholarships = cache(
  async (limit = 8): Promise<ScholarshipCard[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('published_scholarships')
      .select(CARD_FIELDS)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      console.error('[scholarships] recent failed:', error.message)
      return []
    }

    return (await attachInstitutions((data ?? []) as Array<
      Omit<ScholarshipCard, 'institution'>
    >)) as ScholarshipCard[]
  },
)

/**
 * Scholarships sharing a category with the given one.
 *
 * Resolves shared categories through the join table in two steps rather than
 * with a nested subquery, because PostgREST cannot express "related through a
 * join table" in a single filter.
 */
export const getRelatedScholarships = cache(
  async (args: { scholarshipId: string; limit?: number }): Promise<ScholarshipCard[]> => {
    const supabase = await createClient()
    const limit = args.limit ?? 6

    const { data: categoryLinks } = await supabase
      .from('scholarship_categories')
      .select('category_id')
      .eq('scholarship_id', args.scholarshipId)

    const categoryIds = (categoryLinks ?? []).map((r) => r.category_id)
    if (categoryIds.length === 0) return []

    const { data: siblingLinks } = await supabase
      .from('scholarship_categories')
      .select('scholarship_id')
      .in('category_id', categoryIds)
      .neq('scholarship_id', args.scholarshipId)
      .limit(limit * 3)

    const ids = [...new Set((siblingLinks ?? []).map((r) => r.scholarship_id))]
    if (ids.length === 0) return []

    const { data, error } = await supabase
      .from('published_scholarships')
      .select(CARD_FIELDS)
      .in('id', ids.slice(0, limit))
      .order('published_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('[scholarships] related failed:', error.message)
      return []
    }

    return (await attachInstitutions((data ?? []) as Array<
      Omit<ScholarshipCard, 'institution'>
    >)) as ScholarshipCard[]
  },
)
