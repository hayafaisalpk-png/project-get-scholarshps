import { NextResponse } from 'next/server'

import { createAdminClient, hasAdminClient } from '@/lib/supabase/admin'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!UUID.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (!hasAdminClient()) {
    return new NextResponse('Not available', { status: 503 })
  }

  const admin = createAdminClient()

  type AssetRow = {
    id: string
    storage_path: string
    public_url: string | null
    is_public: boolean
    archived_at: string | null
    mime_type: string
  }
  let asset: AssetRow | null = null

  const first = await admin
    .from('media_assets')
    .select('id, storage_path, public_url, is_public, archived_at, mime_type')
    .eq('public_token', token)
    .maybeSingle()

  if (first.error && first.error.code === '42703') {
    const fallback = await admin
      .from('media_assets')
      .select('id, storage_path, public_url, is_public, archived_at, mime_type')
      .eq('id', token)
      .maybeSingle()
    asset = fallback.data as unknown as AssetRow
  } else if (!first.error) {
    asset = first.data as unknown as AssetRow
  }

  if (!asset || asset.archived_at) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Private assets are never exposed anonymously.
  if (!asset.is_public) {
    try {
      await (await import('@/lib/auth/guards')).requirePermission('media.manage')
    } catch {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  const bucket = asset.storage_path.split('/')[0]
  const objectPath = asset.storage_path.split('/').slice(1).join('/')

  if (!bucket || !objectPath) {
    return new NextResponse('Not found', { status: 404 })
  }

  let target: string | null = null

  if (asset.is_public) {
    target =
      asset.public_url ??
      admin.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl
  } else {
    const { data: signed } = await admin.storage
      .from(bucket)
      .createSignedUrl(objectPath, 600)
    target = signed?.signedUrl ?? null
  }

  if (!target) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Guard against redirecting to an unexpected host.
  try {
    const parsed = new URL(target)
    const allowedHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host
    if (parsed.host !== allowedHost) {
      return new NextResponse('Not found', { status: 404 })
    }
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.redirect(target, 302)
}