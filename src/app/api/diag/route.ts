import { NextResponse } from 'next/server'

import { getPublicEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/*
 * Temporary deployment probe. Reports only browser-safe values (the Supabase
 * origin, a key prefix/length, the PostgREST status) and the Vercel build
 * identifiers. It never returns the key itself or any database rows, and it is
 * removed once the production environment is confirmed.
 */
export async function GET() {
  const env = getPublicEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  let supabaseHost = ''
  try {
    supabaseHost = new URL(url).host
  } catch {
    supabaseHost = 'invalid-url'
  }

  let restStatus: number | string = 'fetch-failed'
  let restCode: string | null = null
  let rowCount: number | null = null

  try {
    const response = await fetch(`${url}/rest/v1/articles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    restStatus = response.status
    const body: unknown = await response.json().catch(() => null)
    if (Array.isArray(body)) {
      rowCount = body.length
    } else if (body && typeof body === 'object' && 'code' in body) {
      restCode = String((body as { code: unknown }).code)
    }
  } catch (error) {
    restCode = error instanceof Error ? error.name : 'unknown'
  }

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    supabaseHost,
    urlLooksLikeDashboard: supabaseHost === 'supabase.com',
    keyPrefix: key.slice(0, 20),
    keyLength: key.length,
    serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    restStatus,
    restCode,
    rowCount,
  })
}
