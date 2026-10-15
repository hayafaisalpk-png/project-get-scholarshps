import { z } from 'zod'

/**
 * Scholarship search parameters.
 *
 * This module is deliberately PURE: it parses, validates, normalises and
 * serialises search parameters, and translates them into PostgREST filters.
 * It performs no database access, so all of it is unit tested without a live
 * project.
 *
 * Design rules:
 *
 *   - Everything arriving from the URL is untrusted. Values are validated
 *     against an allowlist and clamped, never passed through.
 *   - `sort` is an allowlist, not a free string, because it becomes an
 *     `order()` clause.
 *   - Serialisation is DETERMINISTIC: keys are emitted in a fixed order and
 *     default values are omitted. That makes shareable URLs canonical and
 *     cache-friendly (two orderings of the same filter set produce the same
 *     URL).
 */

export const PAGE_SIZE = 12
export const MAX_PAGE = 500

export const SORT_OPTIONS = [
  'relevance',
  'deadline',
  'amount_desc',
  'newest',
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]

/** Deadline windows a visitor can filter by. */
export const DEADLINE_OPTIONS = [
  'any',
  'open',
  'week',
  'month',
  'closed',
] as const

export type DeadlineFilter = (typeof DEADLINE_OPTIONS)[number]

export type ScholarshipSearch = {
  q: string
  level: string[]
  field: string[]
  category: string[]
  location: string[]
  tag: string[]
  minAmount: number | null
  maxAmount: number | null
  deadline: DeadlineFilter
  renewable: boolean
  freeApplication: boolean
  international: boolean
  sort: SortOption
  page: number
}

export const DEFAULT_SEARCH: ScholarshipSearch = {
  q: '',
  level: [],
  field: [],
  category: [],
  location: [],
  tag: [],
  minAmount: null,
  maxAmount: null,
  deadline: 'any',
  renewable: false,
  freeApplication: false,
  international: false,
  sort: 'relevance',
  page: 1,
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Field schemas are built so they CANNOT fail.
 *
 * An earlier version used a strict Zod object schema. A single rejected field
 * (`minAmount=abc`, `page=-3`) failed the whole `safeParse`, which fell back to
 * DEFAULT_SEARCH and silently discarded every filter the visitor had applied.
 * Each field now sanitises its own input and always succeeds; invalid values are
 * dropped or clamped rather than poisoning the rest of the query.
 */

/**
 * Slug list. Invalid entries are dropped, not fatal.
 *
 * Values are de-duplicated AND sorted. Filters are an unordered set, so
 * normalising here means two visitors who pick the same filters in a different
 * order end up with byte-identical URLs — which is what makes the canonical tag
 * on a filtered page correct.
 */
const slugList = (max: number) =>
  z
    .unknown()
    .transform((value): string[] => {
      const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
      const cleaned = raw
        .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0 && SLUG.test(v))

      return [...new Set(cleaned)].sort().slice(0, max)
    })
    .catch([])

/** Free-text query. */
const searchTerm = z
  .unknown()
  .transform((v) => (typeof v === 'string' ? v.trim().slice(0, 120) : ''))
  .catch('')

/** Dollars in the URL, integer cents internally. */
const amount = z
  .unknown()
  .transform((v): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
  })
  .catch(null)

const booleanish = z
  .unknown()
  .transform(
    (v) => v === true || v === '1' || v === 'true' || v === 'yes',
  )
  .catch(false)

/**
 * Allowlisted enum value.
 *
 * Typed through a `string` transform and cast at the boundary: Zod's
 * `.catch()` overloads cannot resolve a bare type parameter `T`.
 */
const enumOr = <T extends string>(values: readonly T[], fallback: T) =>
  z
    .unknown()
    .transform((v): string =>
      typeof v === 'string' && (values as readonly string[]).includes(v)
        ? v
        : fallback,
    )
    .catch(fallback as string) as unknown as z.ZodType<T>

const pageNumber = z
  .unknown()
  .transform((v): number => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
    if (!Number.isFinite(n)) return 1
    return Math.min(Math.max(Math.trunc(n), 1), MAX_PAGE)
  })
  .catch(1)

/** Params arriving from Next.js `searchParams`, where repeated keys become arrays. */
export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

const MAX_TAGS = 10
const MAX_CATEGORIES = 10
const MAX_LOCATIONS = 25
const MAX_LEVELS = 10
const MAX_FIELDS = 15

export function parseScholarshipSearch(
  raw: RawSearchParams,
): ScholarshipSearch {
  const parsed = z
    .object({
      q: searchTerm,
      level: slugList(MAX_LEVELS),
      field: slugList(MAX_FIELDS),
      category: slugList(MAX_CATEGORIES),
      location: slugList(MAX_LOCATIONS),
      tag: slugList(MAX_TAGS),
      minAmount: amount,
      maxAmount: amount,
      deadline: enumOr(DEADLINE_OPTIONS, 'any'),
      renewable: booleanish,
      freeApplication: booleanish,
      international: booleanish,
      sort: enumOr(SORT_OPTIONS, 'relevance'),
      page: pageNumber,
    })
    .safeParse({
      q: raw.q,
      level: toArray(raw.level),
      field: toArray(raw.field),
      category: toArray(raw.category),
      location: toArray(raw.location),
      tag: toArray(raw.tag),
      minAmount: raw.minAmount,
      maxAmount: raw.maxAmount,
      deadline: raw.deadline,
      renewable: raw.renewable,
      freeApplication: raw.freeApplication,
      international: raw.international,
      sort: raw.sort,
      page: raw.page,
    })

  // Every field has a `.catch()`, so this cannot realistically fail. Returning
  // defaults is still the correct response if it ever does.
  if (!parsed.success) return { ...DEFAULT_SEARCH }

  const data = parsed.data

  // A relevance sort is meaningless without a query.
  const sort: SortOption = data.sort === 'relevance' && data.q.length === 0 ? 'newest' : data.sort

  // An inverted range would return nothing and confuse the visitor. Collapse it
  // to "no bound" instead.
  const inverted =
    data.minAmount !== null &&
    data.maxAmount !== null &&
    data.minAmount > data.maxAmount

  return {
    q: data.q,
    level: data.level,
    field: data.field,
    category: data.category,
    location: data.location,
    tag: data.tag,
    minAmount: inverted ? null : data.minAmount,
    maxAmount: inverted ? null : data.maxAmount,
    deadline: data.deadline,
    renewable: data.renewable,
    freeApplication: data.freeApplication,
    international: data.international,
    sort,
    page: data.page,
  }
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

const LIST_KEYS = ['level', 'field', 'category', 'location', 'tag'] as const

/**
 * Build a canonical query string.
 *
 * Keys are emitted in a fixed order and default values are omitted, so the same
 * logical filter set always produces byte-identical output. This is what makes
 * canonical URLs and cache keys correct.
 */
export function serializeScholarshipSearch(
  search: ScholarshipSearch,
): URLSearchParams {
  const params = new URLSearchParams()

  if (search.q) params.set('q', search.q)

  for (const key of LIST_KEYS) {
    const values = search[key]
    // Emitted as a single comma-joined value rather than repeated parameters.
    // Repeated keys survive Next's searchParams but collapse under
    // `URLSearchParams.get()` and `Object.fromEntries()`, which silently drops
    // all but one value. A single value is unambiguous for canonical URLs and
    // survives every consumer.
    if (values.length > 0) {
      params.set(key, [...values].sort().join(','))
    }
  }

  if (search.minAmount !== null)
    params.set('minAmount', String(search.minAmount / 100))
  if (search.maxAmount !== null)
    params.set('maxAmount', String(search.maxAmount / 100))

  if (search.deadline !== 'any') params.set('deadline', search.deadline)
  if (search.renewable) params.set('renewable', '1')
  if (search.freeApplication) params.set('freeApplication', '1')
  if (search.international) params.set('international', '1')
  if (search.sort !== 'relevance') params.set('sort', search.sort)

  // Page 1 is the default; omit it from canonical URLs.
  if (search.page > 1) params.set('page', String(search.page))

  return params
}

/** Canonical relative path for the current search state. */
export function scholarshipSearchPath(search: ScholarshipSearch): string {
  const qs = serializeScholarshipSearch(search).toString()
  return qs ? `/scholarships?${qs}` : '/scholarships'
}

/** True when the visitor has applied any filter beyond sorting/paging. */
export function hasActiveFilters(search: ScholarshipSearch): boolean {
  return (
    search.q.length > 0 ||
    search.level.length > 0 ||
    search.field.length > 0 ||
    search.category.length > 0 ||
    search.location.length > 0 ||
    search.tag.length > 0 ||
    search.minAmount !== null ||
    search.maxAmount !== null ||
    search.deadline !== 'any' ||
    search.renewable ||
    search.freeApplication ||
    search.international
  )
}

/* -------------------------------------------------------------------------- */
/* Database call arguments                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Arguments for `public.search_scholarships(...)`.
 *
 * The heavy lifting — taxonomy joins, weighted full-text relevance, deadline
 * windows, sorting and pagination — happens in SQL. See
 * `supabase/migrations/20260101000015_search_scholarships_function.sql` for why
 * it does not live here: PostgREST cannot order by `ts_rank(...)`, and
 * supabase-js appends a direction to `.order()`, which corrupts a pre-built
 * order clause.
 *
 * The function clamps every value again on its side, so this mapping is a
 * convenience and a defence-in-depth layer, not the only guard.
 *
 * Inactive filters are `undefined` rather than `null`: undefined omits the key
 * from the RPC payload entirely, which is what lets the SQL skip the predicate.
 * (Supabase's generated Args type does not accept null for an optional
 * parameter.)
 */
export type SearchRpcArgs = {
  p_q: string | undefined
  p_levels: string[] | undefined
  p_fields: string[] | undefined
  p_categories: string[] | undefined
  p_locations: string[] | undefined
  p_tags: string[] | undefined
  p_min_amount_cents: number | undefined
  p_max_amount_cents: number | undefined
  p_deadline: DeadlineFilter
  p_renewable: boolean
  p_free_application: boolean
  p_international: boolean
  p_sort: SortOption
  p_page: number
  p_page_size: number
}

/** Hard ceiling enforced in SQL; mirrored here so paging maths cannot drift. */
export const MAX_PAGE_SIZE = 50

export function toSearchRpcArgs(
  search: ScholarshipSearch,
  options: { pageSize?: number } = {},
): SearchRpcArgs {
  const requested = options.pageSize ?? PAGE_SIZE
  const pageSize = Math.min(Math.max(Math.trunc(requested), 1), MAX_PAGE_SIZE)

  return {
    p_q: search.q.length > 0 ? search.q : undefined,
    p_levels: search.level.length > 0 ? search.level : undefined,
    p_fields: search.field.length > 0 ? search.field : undefined,
    p_categories: search.category.length > 0 ? search.category : undefined,
    p_locations: search.location.length > 0 ? search.location : undefined,
    p_tags: search.tag.length > 0 ? search.tag : undefined,
    p_min_amount_cents: search.minAmount ?? undefined,
    p_max_amount_cents: search.maxAmount ?? undefined,
    p_deadline: search.deadline,
    p_renewable: search.renewable,
    p_free_application: search.freeApplication,
    p_international: search.international,
    p_sort: search.sort,
    p_page: search.page,
    p_page_size: pageSize,
  }
}
