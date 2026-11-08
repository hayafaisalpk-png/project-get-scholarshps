'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { TAXONOMY_TABLES, type TaxonomyKind } from '@/features/taxonomy/tables'
import { slugify } from '@/lib/slugify'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  locationType: z.enum(['country', 'state', 'region']).optional(),
})

const KIND_NOUN: Record<TaxonomyKind, string> = {
  categories: 'category',
  tags: 'tag',
  education_levels: 'education level',
  academic_fields: 'academic field',
  locations: 'location',
}

/**
 * Map a Postgres error to a message the administrator can act on.
 *
 * `23505` is the unique-slug violation. Any other failure is *not* a duplicate
 * slug, and saying so sent people looking for a conflicting record that did
 * not exist.
 */
function describeCreateError(
  kind: TaxonomyKind,
  error: { code?: string },
): string {
  if (error.code === '23505') {
    return `A ${KIND_NOUN[kind]} with that slug already exists. Change the name or slug.`
  }
  if (error.code === '42501') {
    return 'You do not have permission to create taxonomy records.'
  }
  return `Could not create the ${KIND_NOUN[kind]}. Please try again.`
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
    .from(TAXONOMY_TABLES[kind] as never)
    .insert(payload as never)

  if (error) {
    console.error('[taxonomy] create failed:', error.code, error.message)
    return { ok: false, message: describeCreateError(kind, error) }
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
    .from(TAXONOMY_TABLES[kind] as never)
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[taxonomy] delete failed:', error.message)
    return { ok: false, message: 'Could not delete the record.' }
  }

  revalidatePath('/admin/taxonomy')
  return { ok: true, message: 'Deleted.' }
}
