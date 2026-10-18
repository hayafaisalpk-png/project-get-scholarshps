import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Administration queries for the redirect map.
 *
 * Unlike `src/features/redirects/store.ts`, which reads the rules at request
 * time through the service-role client, these queries run inside the CMS and use
 * the SESSION client. That is the safer choice here: the row being edited is
 * `seo.manage`-gated by RLS, so the database decides who may see it, and there
 * is no need to reach for a key that bypasses RLS when a cookie is available.
 */

export type RedirectRow = {
  from_path: string
  to_path: string
  status_code: number
  is_active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export type RedirectList = {
  items: RedirectRow[]
  total: number
}

export const listRedirects = cache(async (): Promise<DbResult<RedirectList>> => {
  const supabase = await createClient()

  const { data, error, count } = await supabase
    .from('redirects')
    .select(
      'from_path, to_path, status_code, is_active, note, created_at, updated_at',
      { count: 'exact' },
    )
    .order('from_path', { ascending: true })

  if (error) return { ok: false, error: toDatabaseError(error) }

  return {
    ok: true,
    data: { items: (data ?? []) as RedirectRow[], total: count ?? 0 },
  }
})

/**
 * Does this path already have a rule?
 *
 * Used by the create action to produce a readable message. `from_path` is the
 * primary key, so a duplicate is a `23505` rather than a rule about ownership.
 */
export const findRedirectByPath = cache(
  async (from: string): Promise<RedirectRow | null> => {
    const supabase = await createClient()

    const { data } = await supabase
      .from('redirects')
      .select('from_path, to_path, status_code, is_active, note, created_at, updated_at')
      .eq('from_path', from)
      .maybeSingle()

    return (data as RedirectRow | null) ?? null
  },
)