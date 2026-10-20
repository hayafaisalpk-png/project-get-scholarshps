import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { sanitizeArticleHtml } from '@/lib/sanitize'
import { altAttributeFor } from '@/features/media/selection'
import { createClient } from '@/lib/supabase/server'

/**
 * Public article queries.
 *
 * The CMS queries in `features/articles/admin/queries.ts` are for editors and
 * are scoped by the signed-in user's permissions. These are the reader-facing
 * equivalents and they work the same way: no status filter is applied in this
 * module at all.
 *
 * That is deliberate. `articles_select_public` (migration 010, corrected in 012)
 * admits a row only when `public.article_is_public(status, published_at)` holds
 * — status `published` AND the publication time has passed. Drafts, submissions
 * under review, scheduled-but-not-yet-due articles and archived articles are all
 * invisible here, so a scheduled article cannot leak before its moment, and an
 * archived one cannot be read by guessing its slug.
 *
 * Ordering, filtering, searching and pagination happen in PostgreSQL; only one
 * page of rows is ever sent to the browser.
 */

export const ARTICLE_PAGE_SIZE = 12

export type ArticleCardData = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  publishedAt: string
  readingTimeMinutes: number
  authorName: string | null
  featuredImage: { url: string; alt: string } | null
}

export type ArticleListResult = {
  items: ArticleCardData[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ArticleListParams = {
  page?: number | undefined
  q?: string | undefined
  category?: string | undefined
}

/** Remove PostgREST `or` metacharacters from a user-supplied search term. */
function escapeSearch(term: string): string {
  return term.replace(/[,()%]/g, ' ').trim()
}

const CARD_COLUMNS =
  'id, slug, title, excerpt, published_at, reading_time_minutes, author:authors(full_name), featured_image_id'

/**
 * Same columns, plus an INNER embed of the category link.
 *
 * `!inner` is required, not cosmetic: without it PostgREST left-joins the link
 * table, so filtering on `article_category_links.article_categories.slug` would
 * return every article in the database and merely attach a link to some of them.
 * With `!inner`, rows without a matching link are removed from the result.
 *
 * The embed is only requested when a category filter is actually in play, so the
 * unfiltered query stays on its index-friendly shape.
 */
const CARD_COLUMNS_BY_CATEGORY = `${CARD_COLUMNS}, article_category_links!inner(article_categories(slug))`

type CardRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published_at: string | null
  reading_time_minutes: number
  author: { full_name: string } | { full_name: string }[] | null
  featured_image_id: string | null
}

type FeaturedImageRow = {
  id: string
  file_name: string
  alt_text: string | null
  is_decorative: boolean
  public_url: string | null
  storage_path: string
}

/**
 * Normalise the nested `authors` embed.
 *
 * PostgREST returns a single embedded row as an object and a join result as an
 * array, depending on how the relationship is matched. Handling both keeps the
 * page working if the embed shape changes.
 */
function authorNameOf(author: CardRow['author']): string | null {
  if (!author) return null
  const row = Array.isArray(author) ? author[0] : author
  return row?.full_name ?? null
}

function featuredImageOf(
  image: FeaturedImageRow | undefined,
  publicUrl?: string | null,
): ArticleCardData['featuredImage'] {
  if (!image || !publicUrl) return null

  return {
    url: publicUrl,
    alt: altAttributeFor({
      altText: image.alt_text,
      isDecorative: image.is_decorative,
      fileName: image.file_name,
    }),
  }
}

function toCard(
  row: CardRow,
  featuredImages: Map<string, FeaturedImageRow>,
  publicUrl?: string | null,
): ArticleCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    // `article_is_public()` guarantees `published_at` is non-null for any row
    // this query can see, but the column is nullable in the schema, so the
    // fallback keeps the type honest without lying about a date.
    publishedAt: row.published_at ?? '',
    readingTimeMinutes: row.reading_time_minutes,
    authorName: authorNameOf(row.author),
    featuredImage: featuredImageOf(
      row.featured_image_id ? featuredImages.get(row.featured_image_id) : undefined,
      publicUrl,
    ),
  }
}

/**
 * A page of published articles, newest first.
 *
 * Category filtering uses an inner join on `article_category_links`, so only
 * articles actually linked to that category are returned. `article_category_links`
 * has its own anon SELECT policy gated on the parent article being public
 * (migration 010), so a draft's category membership is not readable either.
 */
export const listPublishedArticles = cache(
  async (params: ArticleListParams): Promise<DbResult<ArticleListResult>> => {
    const supabase = await createClient()
    const pageSize = ARTICLE_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize

    const category = params.category?.trim()

    let query = supabase
      .from('articles')
      .select(category ? CARD_COLUMNS_BY_CATEGORY : CARD_COLUMNS, {
        count: 'exact',
      })
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)

    if (category) {
      query = query.eq(
        'article_category_links.article_categories.slug',
        category,
      )
    }

    const term = params.q?.trim()
    if (term) {
      const safe = escapeSearch(term)
      if (safe) query = query.ilike('title', `%${safe}%`)
    }

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const total = count ?? 0

    const rows = (data ?? []) as unknown as CardRow[]
    const imageIds = rows
      .map((row) => row.featured_image_id)
      .filter((id): id is string => Boolean(id))

    const featuredImages = new Map<string, FeaturedImageRow>()
    if (imageIds.length > 0) {
      const media = await supabase
        .from('media_assets')
        .select('id, file_name, alt_text, is_decorative, public_url, storage_path')
        .in('id', imageIds)

      if (!media.error) {
        for (const row of (media.data ?? []) as FeaturedImageRow[]) {
          featuredImages.set(row.id, row)
        }
      }
    }

    return {
      ok: true,
      data: {
        items: rows.map((row) => {
          const image = row.featured_image_id
            ? featuredImages.get(row.featured_image_id)
            : undefined
          const publicUrl = image?.public_url ?? (image?.storage_path.startsWith('public-media/')
            ? supabase.storage
                .from('public-media')
                .getPublicUrl(image.storage_path.slice('public-media/'.length))
                .data.publicUrl
            : null)
          return toCard(row, featuredImages, publicUrl)
        }),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Single record                                                               */
/* -------------------------------------------------------------------------- */

export type PublicArticle = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  /** Already sanitised for rendering. */
  content: string
  publishedAt: string
  readingTimeMinutes: number
  wordCount: number
  authorName: string | null
  authorTitle: string | null
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  noindex: boolean
  categories: { slug: string; name: string }[]
  tags: { slug: string; name: string }[]
  /**
   * The picker-recorded dimensions feed the og:image:width/height tags; both
   * are `null` for uploads made before any image probe existed.
   */
  featuredImage:
    | { url: string; alt: string; width: number | null; height: number | null }
    | null
}

/**
 * One published article by slug.
 *
 * `data: null` covers both "no such slug" and "not visible", which is what keeps
 * the two indistinguishable to someone probing URLs.
 */
export const getPublishedArticleBySlug = cache(
  async (slug: string): Promise<DbResult<PublicArticle | null>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('articles')
      .select(
        'id, slug, title, excerpt, content, published_at, reading_time_minutes, word_count, seo_title, seo_description, canonical_url, noindex, featured_image_id, author:authors(full_name, title)',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) return { ok: false, error: toDatabaseError(error) }
    if (!data) return { ok: true, data: null }

    const [categories, tags] = await Promise.all([
      supabase
        .from('article_category_links')
        .select('category:article_categories(slug, name)')
        .eq('article_id', data.id),
      supabase
        .from('article_tag_links')
        .select('tag:article_tags(slug, name)')
        .eq('article_id', data.id),
    ])

    let featuredImage: PublicArticle['featuredImage'] = null
    if (data.featured_image_id) {
      const { data: image } = await supabase
        .from('media_assets')
        .select('file_name, alt_text, is_decorative, public_url, storage_path, width, height')
        .eq('id', data.featured_image_id)
        .maybeSingle()

      const publicUrl = image?.public_url ?? (image?.storage_path.startsWith('public-media/')
        ? supabase.storage
            .from('public-media')
            .getPublicUrl(image.storage_path.slice('public-media/'.length))
            .data.publicUrl
        : null)

      if (image && publicUrl) {
        featuredImage = {
          url: publicUrl,
          alt: altAttributeFor({
            altText: image.alt_text,
            isDecorative: image.is_decorative,
            fileName: image.file_name,
          }),
          width: image.width ?? null,
          height: image.height ?? null,
        }
      }
    }

    const author = data.author as
      | { full_name: string; title: string | null }
      | { full_name: string; title: string | null }[]
      | null
    const authorRow = Array.isArray(author) ? author[0] : author

    return {
      ok: true,
      data: {
        id: data.id,
        slug: String(data.slug),
        title: data.title,
        excerpt: data.excerpt,
        // Re-sanitised on read; see the note in getContentPage.
        content: sanitizeArticleHtml(data.content),
        publishedAt: data.published_at ?? '',
        readingTimeMinutes: data.reading_time_minutes,
        wordCount: data.word_count,
        authorName: authorRow?.full_name ?? null,
        authorTitle: authorRow?.title ?? null,
        seoTitle: data.seo_title,
        seoDescription: data.seo_description,
        canonicalUrl: data.canonical_url,
        noindex: data.noindex,
        categories: flattenTerms(categories.data, 'category'),
        tags: flattenTerms(tags.data, 'tag'),
        featuredImage,
      },
    }
  },
)

/** Normalise an embedded taxonomy row into `{ slug, name }`. */
function flattenTerms(
  rows: unknown,
  key: string,
): { slug: string; name: string }[] {
  if (!Array.isArray(rows)) return []

  const out: { slug: string; name: string }[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const embedded = (row as Record<string, unknown>)[key]
    if (typeof embedded !== 'object' || embedded === null) continue
    const { slug, name } = embedded as { slug?: unknown; name?: unknown }
    if (typeof slug === 'string' && typeof name === 'string') {
      out.push({ slug, name })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/* -------------------------------------------------------------------------- */
/* Reference data                                                              */
/* -------------------------------------------------------------------------- */

export type ArticleCategory = { slug: string; name: string }

/**
 * Article categories offered as listing filters.
 *
 * Only categories that actually have a published article are returned, so the
 * filter never offers a category that leads to an empty page.
 */
export const getArticleCategories = cache(
  async (): Promise<ArticleCategory[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('article_categories')
      .select('slug, name, article_category_links(article_id)')
      .eq('status', 'active')
      .order('name')

    if (error) {
      console.error('[articles] categories query failed:', error.message)
      return []
    }

    return ((data ?? []) as unknown as {
      slug: string
      name: string
      article_category_links: { article_id: string }[] | null
    }[])
      .filter((row) => (row.article_category_links ?? []).length > 0)
      .map((row) => ({ slug: String(row.slug), name: row.name }))
  },
)
