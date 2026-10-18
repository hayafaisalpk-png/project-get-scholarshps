'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

const contentPageSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  excerpt: z.string().trim().max(500).optional().or(z.literal('')),
  body: z.string().trim().max(50000).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(500).optional().or(z.literal('')),
})

export type ContentPageActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export async function updateContentPageAction(
  slug: string,
  formData: FormData,
): Promise<void> {
  await requirePermission('settings.manage')

  const parsed = contentPageSchema.safeParse({
    title: formData.get('title'),
    excerpt: formData.get('excerpt') ?? '',
    body: formData.get('body') ?? '',
    status: formData.get('status'),
    seoTitle: formData.get('seoTitle') ?? '',
    seoDescription: formData.get('seoDescription') ?? '',
  })

  if (!parsed.success) {
    return
  }

  const supabase = await createClient()
  await supabase
    .from('content_pages')
    .update({
      title: parsed.data.title,
      excerpt: parsed.data.excerpt || null,
      body: parsed.data.body || null,
      status: parsed.data.status,
      seo_title: parsed.data.seoTitle || null,
      seo_description: parsed.data.seoDescription || null,
    } as Database['public']['Tables']['content_pages']['Update'])
    .eq('slug', slug)

  revalidatePath('/admin/content-pages')
  revalidatePath(`/${slug}`)
}