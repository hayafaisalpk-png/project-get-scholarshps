import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { sanitizeArticleHtml } from '@/lib/sanitize'
import { createClient } from '@/lib/supabase/server'

/**
 * Static page reader.
 *
 * About, Help, Privacy, Terms and Editorial Standards live in `content_pages`
 * (migration 021) rather than in TSX, because `AGENTS.md` §2.8 forbids
 * hardcoding CMS content in components and because legal text changes far more
 * often than code does.
 *
 * Reads use the SESSION client, so RLS decides what is visible: an inactive page
 * is invisible to anonymous visitors without any status filter in this module.
 * That is what allows a page to be withdrawn without leaving a dangling link.
 */

export const CONTENT_PAGE_SLUGS = [
  'about',
  'help',
  'privacy',
  'terms',
  'editorial-standards',
] as const

export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number]

export function isContentPageSlug(value: unknown): value is ContentPageSlug {
  return (
    typeof value === 'string' &&
    (CONTENT_PAGE_SLUGS as readonly string[]).includes(value)
  )
}

export type ContentPage = {
  slug: string
  title: string
  excerpt: string | null
  /** Already sanitised on read — render with `dangerouslySetInnerHTML`. */
  body: string
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  noindex: boolean
  updatedAt: string
}

/**
 * Fetch one page by slug.
 *
 * Returns `data: null` when the slug is unknown or the row is not visible to
 * this session. Those two cases are deliberately indistinguishable, so a probe
 * cannot learn whether a withdrawn page exists.
 */
export const getContentPage = cache(
  async (slug: string): Promise<DbResult<ContentPage | null>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('content_pages')
      .select(
        'slug, title, excerpt, body, seo_title, seo_description, canonical_url, noindex, updated_at',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) return { ok: false, error: toDatabaseError(error) }
    if (!data) return { ok: true, data: null }

    return {
      ok: true,
      data: {
        slug: String(data.slug),
        title: data.title,
        excerpt: data.excerpt,
        /*
         * Sanitised on READ as well as on write. The CMS sanitises article and
         * page bodies before storage (`deriveArticleContent`), but a row that
         * predates an allowlist change — or one inserted directly over SQL —
         * could still carry markup the current rules would reject. Rendering
         * through the same allowlist closes that gap with no backfill.
         */
        body: sanitizeArticleHtml(data.body),
        seoTitle: data.seo_title,
        seoDescription: data.seo_description,
        canonicalUrl: data.canonical_url,
        noindex: data.noindex,
        updatedAt: data.updated_at,
      },
    }
  },
)