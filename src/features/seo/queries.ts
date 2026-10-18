import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'
import { findSeoIssues, type SeoIssue } from './guardrails'

/**
 * The SEO overview screen's data.
 *
 * One function, three reads, run in parallel. The point of this screen is to
 * answer "is anything wrong with how this site presents itself to a crawler",
 * so it gathers across all three content types rather than per record — a problem
 * of this kind is rarely confined to one table.
 *
 * RLS decides visibility for every read, and the pages' own indexability rules
 * are re-stated here rather than assumed, so the audit cannot disagree with the
 * pages it audits.
 */

export type SeoRecordRow = {
  kind: 'scholarship' | 'article' | 'content_page'
  id: string
  title: string
  slug: string
  status: string
  noindex: boolean
  allowSitemap: boolean | null
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  updatedAt: string
}

export type SeoOverview = {
  records: SeoRecordRow[]
  issues: SeoIssue[]
  /**
   * Alt-text coverage across the media library.
   *
   * Reported rather than enforced here: the database CHECK
   * `media_assets_alt_or_decorative` (migration 030) already makes "described"
   * and "decorative" the only two states, so `missing` can only be non-zero if
   * that constraint is removed. It is displayed so the coverage is visible in
   * the one place an editor looks for SEO problems.
   */
  media: {
    total: number
    described: number
    decorative: number
    missing: number
  }
  totals: {
    indexable: number
    noindex: number
    unreachable: number
    warnings: number
  }
}

const REACHABLE = new Set(['published', 'active'])

export const getSeoOverview = cache(async (): Promise<DbResult<SeoOverview>> => {
  const supabase = await createClient()

  const [scholarships, articles, pages, media] = await Promise.all([
    // `scholarships` has NO `canonical_url` and no `allow_sitemap` column. Its
    // canonical URL is the page's own address and its sitemap inclusion follows
    // `noindex`, so selecting them here would be a type error at best and a
    // silent PostgREST failure at worst.
    supabase
      .from('scholarships')
      .select('id, title, slug, status, noindex, seo_title, seo_description, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('articles')
      .select('id, title, slug, status, noindex, allow_sitemap, seo_title, seo_description, canonical_url, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('content_pages')
      .select('id, title, slug, status, noindex, seo_title, seo_description, canonical_url, updated_at')
      .order('sort_order', { ascending: true }),
    // Only the two columns the coverage count needs; the library can be large
    // and this screen reads every asset.
    supabase.from('media_assets').select('alt_text, is_decorative'),
  ])

  if (scholarships.error) return { ok: false, error: toDatabaseError(scholarships.error) }
  if (articles.error) return { ok: false, error: toDatabaseError(articles.error) }
  if (pages.error) return { ok: false, error: toDatabaseError(pages.error) }

  const records: SeoRecordRow[] = [
    ...(scholarships.data ?? []).map((row) => ({
      kind: 'scholarship' as const,
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      noindex: row.noindex,
      // Scholarships have no `allow_sitemap`: inclusion is derived from
      // `noindex`, so there is no separate flag to report.
      allowSitemap: null,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      canonicalUrl: null,
      updatedAt: row.updated_at,
    })),
    ...(articles.data ?? []).map((row) => ({
      kind: 'article' as const,
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      noindex: row.noindex,
      allowSitemap: row.allow_sitemap,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      canonicalUrl: row.canonical_url,
      updatedAt: row.updated_at,
    })),
    ...(pages.data ?? []).map((row) => ({
      kind: 'content_page' as const,
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      noindex: row.noindex,
      allowSitemap: null,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      canonicalUrl: row.canonical_url,
      updatedAt: row.updated_at,
    })),
  ]

  const issues: SeoIssue[] = []
  let indexable = 0
  let noindex = 0
  let unreachable = 0

  for (const record of records) {
    if (!REACHABLE.has(record.status)) unreachable++
    else if (record.noindex) noindex++
    else indexable++

    issues.push(
      ...findSeoIssues({
        kind: record.kind,
        id: record.id,
        title: record.title,
        status: record.status,
        noindex: record.noindex,
        allowSitemap: record.allowSitemap,
        seoTitle: record.seoTitle,
        seoDescription: record.seoDescription,
        canonicalUrl: record.canonicalUrl,
      }),
    )
  }

  const mediaRows = media.data ?? []
  const described = mediaRows.filter((m) => m.alt_text !== null).length
  const decorative = mediaRows.filter(
    (m) => m.alt_text === null && m.is_decorative,
  ).length
  const missing = mediaRows.length - described - decorative

  return {
    ok: true,
    data: {
      records,
      issues,
      media: {
        total: mediaRows.length,
        described,
        decorative,
        missing,
      },
      totals: {
        indexable,
        noindex,
        unreachable,
        warnings: issues.filter((issue) => issue.severity === 'warning').length,
      },
    },
  }
})

/**
 * Editable settings for the SEO screens.
 *
 * Reads EVERY row rather than only the public ones, because the editor has to see
 * a private setting in order to know it exists — and `getPublicSettings()` hides
 * those by design. The screen then refuses to render the keys outside
 * `EDITABLE_SETTING_KEYS`.
 */
export const listSeoSettings = cache(async (): Promise<DbResult<
  {
    key: string
    value: unknown
    valueType: string
    group: string
    label: string | null
    description: string | null
    isPublic: boolean
  }[]
>> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value, value_type, "group", label, description, is_public')
    .in('group', ['seo', 'social'])
    .order('key', { ascending: true })

  if (error) return { ok: false, error: toDatabaseError(error) }

  /*
   * `value_type` is RENAMED HERE, explicitly.
   *
   * It cannot be aliased in the select string: PostgREST reads `alias:column` as
   * a table alias for an embedded resource, and asks for a column called
   * `valueType` that does not exist — which fails the whole query with 42703 and
   * renders the screen's error state.
   *
   * The mismatch this guards against is worse than a crash. Reading
   * `setting.valueType` from a row selected as `value_type` yields `undefined`;
   * the form then renders an EMPTY type, `parseSettingValue` falls through to
   * its string branch, and an `http://` address is accepted and stored in a
   * setting declared as `url`. An undefined type and a missing type look
   * identical, so nothing announces the mistake.
   */
  const rows = (data ?? []).map((row) => ({
    key: row.key,
    value: row.value,
    valueType: row.value_type,
    group: row.group,
    label: row.label,
    description: row.description,
    isPublic: row.is_public,
  }))

  return { ok: true, data: rows }
})