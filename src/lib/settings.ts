import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/**
 * Site settings reader.
 *
 * Settings live in `site_settings`, a typed key/value table managed through the
 * CMS. Only rows flagged `is_public` are readable by anonymous visitors (RLS
 * enforces this), which is why private settings such as the ad master switch are
 * simply absent from `getPublicSettings()` rather than being filtered in JS.
 *
 * Reads are memoised per request, and the whole table is fetched in ONE query
 * rather than key-by-key, so a page that needs a dozen settings costs a single
 * round trip.
 */

export type SiteSettings = Record<string, unknown>

/** Settings every public page may read. */
export const getPublicSettings = cache(async (): Promise<SiteSettings> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value, value_type')
    .eq('is_public', true)

  if (error) {
    console.error('[settings] load failed:', error.message)
    return {}
  }

  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
})

/** Every setting, for users who can manage the site. */
export const getAllSettings = cache(async (): Promise<SiteSettings> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value, value_type')

  if (error) {
    console.error('[settings] load all failed:', error.message)
    return {}
  }

  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
})

/* -------------------------------------------------------------------------- */
/* Typed accessors                                                             */
/* -------------------------------------------------------------------------- */

export async function getString(
  key: string,
  fallback: string,
): Promise<string> {
  const value = (await getPublicSettings())[key]
  if (typeof value === 'string' && value.length > 0) return value
  return fallback
}

export async function getBoolean(
  key: string,
  fallback = false,
): Promise<boolean> {
  const value = (await getPublicSettings())[key]
  if (typeof value === 'boolean') return value
  return fallback
}

/**
 * Maintenance mode.
 *
 * Read from ALL settings rather than public ones, because a private setting
 * that nobody can read cannot switch anything off.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'site.maintenance_mode')
    .maybeSingle()

  return data?.value === true
}
