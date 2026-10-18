'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const updateSchema = z.object({
  heading: z.string().trim().max(200).optional().or(z.literal('')),
  subheading: z.string().trim().max(500).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isVisible: z.boolean(),
})

export async function updateHomepageSectionAction(
  key: string,
  formData: FormData,
): Promise<void> {
  await requirePermission('homepage.manage')

  const parsed = updateSchema.safeParse({
    heading: formData.get('heading') ?? '',
    subheading: formData.get('subheading') ?? '',
    sortOrder: formData.get('sortOrder'),
    isVisible: formData.get('isVisible') === 'on',
  })

  if (!parsed.success) return

  const supabase = await createClient()
  await supabase
    .from('homepage_sections')
    .update({
      heading: parsed.data.heading || null,
      subheading: parsed.data.subheading || null,
      sort_order: parsed.data.sortOrder,
      is_visible: parsed.data.isVisible,
    })
    .eq('key', key)

  revalidatePath('/admin/homepage')
  revalidatePath('/')
}