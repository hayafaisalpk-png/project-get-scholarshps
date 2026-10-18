import { z } from 'zod'

import { REDIRECT_STATUS_CODES, validateRedirectRule } from './resolution'

/**
 * Redirect form validation.
 *
 * Every rule here mirrors a constraint that already exists in the database, so
 * an editor sees which field is wrong instead of a generic constraint message:
 *
 *   check (from_path ~ '^/')                  → must start with a slash
 *   check (to_path ~ '^/' or '^https://')     → path or full https URL
 *   check (from_path <> to_path)              → cannot point at itself
 *   check (status_code in (301,302,307,308))  → closed vocabulary
 *
 * `validateRedirectRule` adds the two rules the database cannot express: the
 * site root is not redirectable, and neither path may contain whitespace. The
 * root matters because a rule on `/` would capture every unmatched URL on the
 * site, including every typo, into a redirect.
 */

const pathField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .max(500, `That ${label} is too long.`)

export const redirectSchema = z
  .object({
    from: pathField('old path'),
    to: pathField('new path'),
    statusCode: z.coerce
      .number()
      .int()
      .refine(
        (value): value is (typeof REDIRECT_STATUS_CODES)[number] =>
          (REDIRECT_STATUS_CODES as readonly number[]).includes(value),
        'Choose a redirect type.',
      ),
    note: z.string().trim().max(500, 'That note is too long.').default(''),
  })
  .superRefine((value, ctx) => {
    const check = validateRedirectRule({ from: value.from, to: value.to })
    if (!check.ok) {
      // `formError` would be correct, but the editor needs to know WHICH field.
      // `to` is the usual culprit, and `from` is the other candidate, so the
      // message is attached to the pair rather than guessed at.
      ctx.addIssue({
        code: 'custom',
        path: [value.from === '/' ? 'from' : 'to'],
        message: check.message,
      })
    }
  })

export type RedirectInput = z.infer<typeof redirectSchema>

/** Human labels for the status codes, for the form control. */
export const REDIRECT_STATUS_LABELS: Record<number, string> = {
  301: '301 — Permanent (use for moved pages)',
  302: '302 — Temporary (use while testing)',
  307: '307 — Temporary, keeps the method',
  308: '308 — Permanent, keeps the method',
}

export function fieldErrorsFrom(
  error: { issues: readonly { path: PropertyKey[]; message: string }[] },
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_form'
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}