import { z } from 'zod'

export const consentSchema = z.object({
  visitorId: z.string().uuid(),
  analytics: z.boolean(),
  ads: z.boolean(),
  functionality: z.boolean(),
  version: z.string().trim().min(1).max(20),
  source: z.enum(['banner', 'settings']),
})

export type ConsentInput = z.infer<typeof consentSchema>
