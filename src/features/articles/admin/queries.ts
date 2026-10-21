import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'
import { type ArticleStatus, ARTICLE_STATUSES } from '@/lib/validation/article'

/**
 * Administration queries for articles.
 *
 * As with scholarships: the SESSION client is used for every read so RLS
 * constrains our own queries exactly as it constrains everyone else's, and all
 * filtering, searching, sorting and pagination happens in PostgreSQL.
 */

export const ADMIN_ARTICLE_PAGE_SIZE = 20

export type AdminArticleRow = {
  id: string
  slug: string
  title: string
  status: string
  excerpt: string | null
  author_id: string | null
  scheduled_for: string | null
  published_at: string | null
  updated_at: string
  created_at: string
}

export type AdminArticleListResult = {
  items: AdminArticleRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminArticleListParams = {
  q?: string | undefined
  status?: string | undefined
  page?: number | undefined
}

function parseStatus(value: string | undefined): ArticleStatus | null {
  if (!value) return null
  return ARTICLE_STATUSES.find((s) => s === value) ?? null
}

/** Remove PostgREST `or` metacharacters from a user-supplied search term. */
function escapeSearch(term: string): string {
  return term.replace(/[,()%]/g, ' ').trim()
}

export const listAdminArticles = cache(
  async (params: AdminArticleListParams): Promise<DbResult<AdminArticleListResult>> => {
    const supabase = await createClient()
    const pageSize = ADMIN_ARTICLE_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize
    const status = parseStatus(params.status)

    let query = supabase
      .from('articles')
      .select(
        'id, slug, title, status, excerpt, author_id, scheduled_for, published_at, updated_at, created_at',
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
        query = query.ilike('title', `%${safe}%`)
      }
    }

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const total = count ?? 0

    return {
      ok: true,
      data: {
        items: (data ?? []) as AdminArticleRow[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/** Counts per status, for the filter dropdown. */
export const articleStatusCounts = cache(async (): Promise<Record<string, number>> => {
  const supabase = await createClient()

  const { data, error } = await supabase.from('articles').select('status')

  const counts: Record<string, number> = {}
  for (const status of ARTICLE_STATUSES) counts[status] = 0
  if (error) return counts

  for (const row of data ?? []) {
    const key = row.status as string
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
})

/* -------------------------------------------------------------------------- */
/* Single record                                                              */
/* -------------------------------------------------------------------------- */

export type AdminArticleDetail = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  content_plain: string
  word_count: number
  reading_time_minutes: number
  status: string
  author_id: string | null
  editor_id: string | null
  featured_image_id: string | null
  social_image_id: string | null
  scheduled_for: string | null
  published_at: string | null
  reviewed_at: string | null
  archived_at: string | null
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  noindex: boolean
  allow_sitemap: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ArticleRelations = {
  category_ids: string[]
  tag_ids: string[]
  scholarship_ids: string[]
}

export type ArticleReview = {
  id: string
  decision: string
  notes: string | null
  reviewer_id: string | null
  created_at: string
}

export async function listArticleReviews(id: string): Promise<ArticleReview[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('article_reviews')
    .select('id, decision, notes, reviewer_id, created_at')
    .eq('article_id', id)
    .order('created_at', { ascending: false })
  return (data ?? []) as ArticleReview[]
}

export const getAdminArticle = cache(
  async (id: string): Promise<DbResult<{ record: AdminArticleDetail; relations: ArticleRelations } | null>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return { ok: false, error: toDatabaseError(error) }
    if (!data) return { ok: true, data: null }

    const [categories, tags, scholarships] = await Promise.all([
      supabase
        .from('article_category_links')
        .select('article_category_id')
        .eq('article_id', id),
      supabase.from('article_tag_links').select('tag_id').eq('article_id', id),
      supabase
        .from('article_scholarships')
        .select('scholarship_id')
        .eq('article_id', id),
    ])

    return {
      ok: true,
      data: {
        record: data as AdminArticleDetail,
        relations: {
          category_ids: (categories.data ?? []).map((r) => r.article_category_id),
          tag_ids: (tags.data ?? []).map((r) => r.tag_id),
          scholarship_ids: (scholarships.data ?? []).map(
            (r) => r.scholarship_id,
          ),
        },
      },
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Reference data for the form                                                */
/* -------------------------------------------------------------------------- */

export type Option = { id: string; name: string }

export type ArticleFormOptions = {
  authors: Option[]
  categories: Option[]
  tags: Option[]
  scholarships: Option[]
}

/**
 * Reference lists for the form controls.
 *
 * `articles` is fetched with the RLS-scoped session client, so an editor only
 * ever sees published scholarships to link to — linking a reader to an
 * unpublished record would produce a dead link on the public site.
 */
export const getArticleFormOptions = cache(
  async (): Promise<DbResult<ArticleFormOptions>> => {
    const supabase = await createClient()

    const [authors, categories, tags, scholarships] = await Promise.all([
      supabase
        .from('authors')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('article_categories')
        .select('id, name')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('article_tags')
        .select('id, name')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('scholarships')
        .select('id, title')
        .eq('status', 'published')
        .order('title')
        .limit(200),
    ])

    const firstError =
      authors.error ?? categories.error ?? tags.error ?? scholarships.error
    if (firstError) return { ok: false, error: toDatabaseError(firstError) }

    return {
      ok: true,
      data: {
        authors: (authors.data ?? []).map((a) => ({
          id: a.id,
          name: a.full_name,
        })),
        categories: (categories.data ?? []).map((c) => ({ id: c.id, name: c.name })),
        tags: (tags.data ?? []).map((t) => ({ id: t.id, name: t.name })),
        // Normalised to `{ id, name }` so the form's checkbox group does not
        // need to know which underlying column held the label.
        scholarships: (scholarships.data ?? []).map((s) => ({
          id: s.id,
          name: s.title,
        })),
      },
    }
  },
)
