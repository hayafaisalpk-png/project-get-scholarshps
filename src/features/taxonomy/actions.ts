'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { TaxonomyKind } from '@/features/taxonomy/queries'
import { slugify } from '@/lib/slugify'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  locationType: z.enum(['country', 'state', 'region']).optional(),
})

const TABLE: Record<TaxonomyKind, string> = {
  categories: 'categories',
  tags: 'tags',
  education_levels: 'education_levels',
  academic_fields: 'academic_fields',
  locations: 'locations',
}

export async function createTaxonomyAction(
  kind: TaxonomyKind,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requirePermission('taxonomy.manage')

  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? '',
    locationType: formData.get('location_type') || undefined,
  })

  if (!parsed.success) {
    return { ok: false, message: 'Please provide a name.' }
  }

  const name = parsed.data.name
  const slug = parsed.data.slug?.trim() || slugify(name)
  if (!slug) {
    return { ok: false, message: 'Could not derive a slug from the name.' }
  }

  const supabase = await createClient()
  const payload = kind === 'locations'
    ? { name, slug, status: 'active', type: parsed.data.locationType ?? 'region', sort_order: 0 }
    : kind === 'tags'
      ? { name, slug, status: 'active' }
      : { name, slug, status: 'active', sort_order: 0 }
  const { error } = await supabase
    .from(TABLE[kind] as never)
    .insert(payload as never)

  if (error) {
    console.error('[taxonomy] create failed:', error.message)
    return { ok: false, message: 'Could not create the record. The slug may already exist.' }
  }

  revalidatePath('/admin/taxonomy')
  return { ok: true, message: 'Created.' }
}

export async function deleteTaxonomyAction(
  kind: TaxonomyKind,
  id: string,
): Promise<{ ok: boolean; message: string }> {
  await requirePermission('taxonomy.manage')

  const supabase = await createClient()
  const { error } = await supabase
    .from(TABLE[kind] as never)
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[taxonomy] delete failed:', error.message)
    return { ok: false, message: 'Could not delete the record.' }
  }

  revalidatePath('/admin/taxonomy')
  return { ok: true, message: 'Deleted.' }
}
