import { z } from 'zod'

/**
 * SEO administration form validation.
 *
 * The guardrails from `docs/SEO_GUIDELINES.md` §11 live in
 * `src/features/seo/guardrails.ts` as pure functions, because they encode
 * judgements an editor needs explained — not just validation errors. This file
 * validates the SHAPE of what arrives.
 */

/* -------------------------------------------------------------------------- */
/* Index control                                                               */
/* -------------------------------------------------------------------------- */

export const INDEXABLE_KINDS = ['scholarship', 'article', 'content_page'] as const
export type IndexableKind = (typeof INDEXABLE_KINDS)[number]

export const INDEXABLE_STATUSES = [
  'draft',
  'published',
  'scheduled',
  'archived',
  'in_review',
  'active',
  'inactive',
] as const

export const indexActionSchema = z.object({
  kind: z
    .string()
    .trim()
    .refine(
      (value): value is IndexableKind =>
        (INDEXABLE_KINDS as readonly string[]).includes(value),
      'Unknown record type.',
    ),
  id: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'That record could not be identified.',
    ),
  indexable: z
    .string()
    .trim()
    .refine((v) => v === 'true' || v === 'false', 'Unknown index state.'),
  status: z
    .string()
    .trim()
    .refine(
      (value): value is (typeof INDEXABLE_STATUSES)[number] =>
        (INDEXABLE_STATUSES as readonly string[]).includes(value),
      'Unknown status.',
    ),
})

export type IndexActionInput = z.infer<typeof indexActionSchema>

/* -------------------------------------------------------------------------- */
/* Site settings                                                               */
/* -------------------------------------------------------------------------- */

/*
 * Setting writes are validated by `parseSettingValue` in
 * `@/lib/validation/settings` plus the `EDITABLE_SETTING_KEYS` allowlist, rather
 * than by a schema here.
 *
 * That is deliberate: the `value` column is JSONB typed by the row's own
 * `value_type`, which is only known at runtime. A boolean and a string arrive
 * from the same form as strings and must be stored differently, so a single Zod
 * shape would have to be wrong for one of them. The allowlist and the value
 * parser are the validation, and both are pure and unit tested.
 */