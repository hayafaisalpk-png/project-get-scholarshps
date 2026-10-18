'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const createSchema = z.object({
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(500),
  location: z.enum([
    'header',
    'footer_column_1',
    'footer_column_2',
    'footer_column_3',
    'footer_column_4',
    'legal',
  ]),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
})

const updateSchema = z.object({
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isVisible: z.boolean(),
})

export async function createNavItemAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requirePermission('navigation.manage')

  const parsed = createSchema.safeParse({
    label: formData.get('label'),
    href: formData.get('href'),
    location: formData.get('location'),
    sortOrder: formData.get('sortOrder') ?? 0,
  })

  if (!parsed.success) {
    return { ok: false, message: 'Please provide label, href and location.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('navigation_items').insert({
    label: parsed.data.label,
    href: parsed.data.href,
    location: parsed.data.location,
    sort_order: parsed.data.sortOrder,
    is_visible: true,
    opens_in_new_tab: false,
    parent_id: null,
  })

  if (error) {
    console.error('[navigation] create failed:', error.message)
    return { ok: false, message: 'Could not create the item.' }
  }

  revalidatePath('/admin/navigation')
  return { ok: true, message: 'Created.' }
}

export async function deleteNavItemAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requirePermission('navigation.manage')

  const supabase = await createClient()
  const { error } = await supabase.from('navigation_items').delete().eq('id', id)

  if (error) {
    console.error('[navigation] delete failed:', error.message)
    return { ok: false, message: 'Could not delete the item.' }
  }

  revalidatePath('/admin/navigation')
  return { ok: true, message: 'Deleted.' }
}

export async function updateNavItemAction(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requirePermission('navigation.manage')

  const parsed = updateSchema.safeParse({
    label: formData.get('label'),
    href: formData.get('href'),
    sortOrder: formData.get('sortOrder'),
    isVisible: formData.get('isVisible') === 'on',
  })

  if (!parsed.success) {
    return { ok: false, message: 'Please provide valid values.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('navigation_items')
    .update({
      label: parsed.data.label,
      href: parsed.data.href,
      sort_order: parsed.data.sortOrder,
      is_visible: parsed.data.isVisible,
    })
    .eq('id', id)

  if (error) {
    console.error('[navigation] update failed:', error.message)
    return { ok: false, message: 'Could not update the item.' }
  }

  revalidatePath('/admin/navigation')
  return { ok: true, message: 'Updated.' }
}