import { z } from 'zod'

/**
 * Authentication input validation.
 *
 * Pure and framework-free so it can be unit tested directly, and imported by
 * both the Server Actions (which must validate) and the client forms (which
 * pre-validate). The server re-validates regardless: client validation is a
 * usability feature, never a security control.
 */

/** Long enough for a real passphrase, short enough to stay typeable. */
const PASSWORD_MIN = 12
const PASSWORD_MAX = 200

/**
 * Password policy.
 *
 * Length is the dominant factor, so the minimum is 12 characters. Composition
 * rules are deliberately absent: they push people towards predictable
 * substitutions (`Passw0rd!`) rather than genuinely stronger secrets.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, 'Password is too long.')

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(320, 'That email address is too long.')
  // Deliberately permissive: a strict RFC pattern rejects valid addresses.
  // Supabase performs the authoritative check.
  .email('Enter a valid email address.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** Standalone confirmation check, for "change password" while signed in. */
export const confirmPasswordSchema = z
  .string()
  .min(1, 'Confirm your new password.')
  .max(PASSWORD_MAX)

/** Field-keyed errors, ready to hand to a form. */
export type FieldErrors = Record<string, string>

/**
 * Flatten a Zod error into `{ field: firstMessage }`.
 *
 * Only the first issue per field is kept: showing a user three complaints
 * about one input is noise, not precision.
 */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

/**
 * Validate a post-authentication redirect target.
 *
 * This is the open-redirect defence. `returnTo` arrives from the URL, so it is
 * fully attacker-controlled. Without this, a link such as
 * `/auth/login?returnTo=https://evil.example` would send a freshly
 * authenticated administrator — who has just typed their password — straight to
 * a hostile page.
 *
 * Rules:
 *   - must be a string
 *   - must start with a single `/`
 *   - must NOT start with `//` or `/\` (protocol-relative URLs)
 *   - must not contain a backslash anywhere (browser normalisation tricks)
 *   - must not contain control characters or whitespace
 *
 * Anything else falls back to a known-safe internal path.
 */
export function safeReturnPath(
  value: unknown,
  fallback = '/admin',
): string {
  if (typeof value !== 'string') return fallback

  const candidate = value.trim()
  if (candidate.length === 0 || candidate.length > 2048) return fallback

  // Control characters and whitespace can be used to smuggle a second header
  // or to confuse the browser's URL parser.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional
  if (/[\u0000-\u0020\u007f]/.test(candidate)) return fallback

  if (candidate.includes('\\')) return fallback

  // Must be absolute-path form.
  if (!candidate.startsWith('/')) return fallback

  // `//evil.example` and `/\evil.example` are treated as protocol-relative by
  // browsers, which would navigate off-site.
  if (candidate.startsWith('//')) return fallback
  if (candidate.startsWith('/\\')) return fallback

  return candidate
}