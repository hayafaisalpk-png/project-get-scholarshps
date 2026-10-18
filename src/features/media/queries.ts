import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'
import type { SelectableAsset } from './selection'

/**
 * Media library queries.
 *
 * The session client is used for every read, so RLS scopes the rows: an archived
 * asset is invisible to anyone without `media.manage`, and a private asset is
 * invisible to anyone without it either.
 *
 * THE PRIVATE BUCKET PROBLEM
 *
 * A `public_url` is only populated for assets in `public-media`. Private uploads
 * have none by definition, so a media library that only read `public_url` would
 * show a column of blanks for exactly the assets a media manager most wants to
 * review.
 *
 * Signed URLs are generated here, per request, with a deliberately short life.
 * They are the only way to see a private object through the Data API, and they
 * must never be persisted — a stored signed URL is a stored credential that
 * silently stops working and is easy to leak into a cached page.
 *
 * Only the objects actually being displayed are signed, so one page render costs
 * one batched `createSignedUrls` call rather than one per asset.
 */

export const MEDIA_PAGE_SIZE = 24

export type MediaAsset = {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  altText: string | null
  /**
   * The image carries no information and is hidden from assistive technology.
   *
   * Makes "no alt text" a decision rather than an omission (migration 030).
   */
  isDecorative: boolean
  caption: string | null
  attribution: string | null
  folder: string
  isPublic: boolean
  publicUrl: string | null
  /** Always present for a caller who can see the asset. */
  displayUrl: string | null
  /**
   * Set when the asset has been archived.
   *
   * `media_select_public` (migration 027) lets a media manager SEE archived
   * rows — that is what makes the archive action work and what allows an archived
   * filter to exist. The consequence is that an archived asset would otherwise sit
   * in the grid looking exactly like a live one, and an editor could attach a
   * withdrawn image to a record. It is therefore surfaced to the caller so the UI
   * can label it rather than silently showing it as available.
   */
  archivedAt: string | null
  createdAt: string
}

export type MediaListResult = {
  items: MediaAsset[]
  total: number
  page: number
  totalPages: number
}

export type MediaListParams = {
  folder?: string | undefined
  q?: string | undefined
  page?: number | undefined
  /** Filter by archive state. Defaults to 'active' (hides archived). */
  archived?: 'active' | 'archived' | 'all' | undefined
}

type MediaRow = {
  id: string
  storage_path: string
  public_url: string | null
  is_public: boolean
  file_name: string
  mime_type: string
  file_size: number
  alt_text: string | null
  is_decorative: boolean
  caption: string | null
  attribution: string | null
  folder: string
  archived_at: string | null
  created_at: string
}

export const listMediaAssets = cache(
  async (params: MediaListParams): Promise<DbResult<MediaListResult>> => {
    const supabase = await createClient()
    const pageSize = MEDIA_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize

    let query = supabase
      .from('media_assets')
      .select(
        'id, storage_path, public_url, is_public, file_name, mime_type, file_size, alt_text, is_decorative, caption, attribution, folder, archived_at, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    const folder = params.folder?.trim()
    if (folder) query = query.eq('folder', folder)

    const term = params.q?.trim()
    if (term) {
      // `.or` with an escaped term. PostgREST treats `,` and parentheses as
      // filter syntax, so they are stripped rather than escaped.
      const safe = term.replace(/[,()%]/g, ' ').trim()
      if (safe) query = query.or(`file_name.ilike.%${safe}%,alt_text.ilike.%${safe}%`)
    }

    const archived = params.archived ?? 'active'
    if (archived === 'active') query = query.is('archived_at', null)
    else if (archived === 'archived') query = query.not('archived_at', 'is', null)

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const rows = (data ?? []) as MediaRow[]
    const total = count ?? 0

    const signed = await signPrivateAssets(supabase, rows)

    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          fileName: row.file_name,
          mimeType: row.mime_type,
          fileSize: row.file_size,
          altText: row.alt_text,
          isDecorative: row.is_decorative,
          caption: row.caption,
          attribution: row.attribution,
          folder: row.folder,
          isPublic: row.is_public,
          publicUrl: row.public_url,
          displayUrl: row.public_url ?? signed.get(row.id) ?? null,
          archivedAt: row.archived_at,
          createdAt: row.created_at,
        })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/**
 * Sign the private objects in a page of assets, in ONE batched call.
 *
 * The bucket is derived from `storage_path`, which `buildStoragePath` writes as
 * `<bucket>/<folder>/<file>`. A signed URL is minted per object rather than per
 * bucket so a mixed page costs a single request.
 *
 * A failure here is logged and swallowed: the asset row is still worth showing,
 * just without a preview. Throwing would turn one missing preview into a broken
 * media library.
 */
async function signPrivateAssets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  /*
   * Only `storage_path` and `public_url` are read. The picker selects a narrower
   * set of columns than the library list, and widening this parameter to the full
   * row type would force the picker to fetch columns it does not use.
   */
  rows: readonly { storage_path: string; public_url: string | null }[],
): Promise<Map<string, string>> {
  const byBucket = new Map<string, string[]>()

  for (const row of rows) {
    if (row.public_url) continue
    const bucket = row.storage_path.split('/')[0]
    if (!bucket) continue
    const paths = byBucket.get(bucket) ?? []
    paths.push(row.storage_path)
    byBucket.set(bucket, paths)
  }

  const out = new Map<string, string>()

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, 600)

      if (error) {
        console.error(`[media] signing ${bucket} failed:`, error.message)
        return
      }

      for (const entry of data ?? []) {
        if (!entry.signedUrl || !entry.path) continue
        // storage_path is `<bucket>/<folder>/<file>`; the id is derived from the
        // generated filename, so match on the filename rather than re-parsing.
        const file = entry.path.split('/').pop() ?? ''
        const id = file.split('.')[0] ?? ''
        if (id) out.set(id, entry.signedUrl)
      }
    }),
  )

  return out
}

/**
 * Assets offered by the featured-image picker.
 *
 * ARCHIVED ROWS ARE EXCLUDED. An archived asset still renders if a record already
 * references it — that is why archive is a soft delete — but offering one for a
 * new selection would hand an editor an image that is on its way out.
 *
 * What the caller can SEE is decided by RLS, not here: a media manager sees every
 * asset, and a user without `media.manage` sees only public, unarchived ones.
 * The picker renders whatever arrives and does not widen its own visibility.
 */
export const listSelectableAssets = cache(
  async (params: {
    q?: string | undefined
    page?: number | undefined
  }): Promise<DbResult<{ items: SelectableAsset[]; total: number; page: number; totalPages: number }>> => {
    const supabase = await createClient()
    const pageSize = MEDIA_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize

    let query = supabase
      .from('media_assets')
      .select('id, file_name, alt_text, is_decorative, public_url, storage_path', {
        count: 'exact',
      })
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    const term = params.q?.trim()
    if (term) {
      const safe = term.replace(/[,()%]/g, ' ').trim()
      if (safe) query = query.or(`file_name.ilike.%${safe}%,alt_text.ilike.%${safe}%`)
    }

    const { data, error, count } = await query
    if (error) return { ok: false, error: toDatabaseError(error) }

    const rows = (data ?? []) as {
      id: string
      file_name: string
      alt_text: string | null
      is_decorative: boolean
      public_url: string | null
      storage_path: string
    }[]

    const signed = await signPrivateAssets(supabase, rows)

    const total = count ?? 0

    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          fileName: row.file_name,
          altText: row.alt_text,
          isDecorative: row.is_decorative,
          displayUrl: row.public_url ?? signed.get(row.id) ?? null,
        })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/** One asset by id, for rendering an already-chosen image. */
export const getSelectableAsset = cache(
  async (id: string): Promise<SelectableAsset | null> => {
    if (!id) return null

    const supabase = await createClient()

    const { data } = await supabase
      .from('media_assets')
      .select('id, file_name, alt_text, is_decorative, public_url, storage_path')
      .eq('id', id)
      .maybeSingle()

    if (!data) return null

    const row = data as unknown as {
      id: string
      file_name: string
      alt_text: string | null
      is_decorative: boolean
      public_url: string | null
      storage_path: string
    }

    const signed = await signPrivateAssets(supabase, [row])

    return {
      id: row.id,
      fileName: row.file_name,
      altText: row.alt_text,
      isDecorative: row.is_decorative,
      displayUrl: row.public_url ?? signed.get(row.id) ?? null,
    }
  },
)

/** Folders that actually contain assets, for the filter tabs. */
export const listMediaFolders = cache(async (): Promise<string[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase.from('media_assets').select('folder')

  if (error) {
    console.error('[media] folders query failed:', error.message)
    return []
  }

  const seen = new Set<string>()
  for (const row of data ?? []) {
    if (typeof row.folder === 'string' && row.folder.length > 0) {
      seen.add(row.folder)
    }
  }

  return [...seen].sort()
})