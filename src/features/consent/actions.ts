'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const consentSchema = z.object({
  visitorId: z.string().uuid(),
  analytics: z.boolean(),
  ads: z.boolean(),
  functionality: z.boolean(),
  version: z.string().trim().min(1).max(20),
  source: z.enum(['banner', 'settings']),
})

export async function recordConsent(input: {
  visitorId: string
  analytics: boolean
  ads: boolean
  functionality: boolean
  version: string
  source: 'banner' | 'settings'
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = consentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Consent preferences could not be saved.' }

  const supabase = await createClient()
  const { error } = await supabase.from('consent_records').insert({
    visitor_id: parsed.data.visitorId,
    analytics: parsed.data.analytics,
    ads: parsed.data.ads,
    functionality: parsed.data.functionality,
    version: parsed.data.version,
    source: parsed.data.source,
  })
  if (error) return { ok: false, message: 'Consent preferences could not be saved.' }
  return { ok: true }
}
