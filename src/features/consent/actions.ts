'use server'

import { createClient } from '@/lib/supabase/server'
import { consentSchema, type ConsentInput } from './validation'

export async function recordConsent(input: ConsentInput): Promise<{ ok: true } | { ok: false; message: string }> {
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
