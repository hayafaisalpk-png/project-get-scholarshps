import { z } from 'zod'

/**
 * Environment variable validation.
 *
 * Two separate schemas:
 *  - `publicEnv`  — only `NEXT_PUBLIC_*` values, safe to import from the browser.
 *  `serverEnv`  — server-only values, including the Supabase service-role key.
 *
 * `serverEnv` lives in this file but the exported accessor is marked
 * `server-only` by convention and must never be imported into a Client
 * Component. Any accidental import is caught by the build.
 */

/* -------------------------------------------------------------------------- */
/* Public (browser-safe) environment                                          */
/* -------------------------------------------------------------------------- */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL.' })
    .refine((v) => v.startsWith('https://') || v.startsWith('http://localhost'), {
      message: 'NEXT_PUBLIC_SUPABASE_URL must use HTTPS outside localhost.',
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ message: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be empty.'),
  NEXT_PUBLIC_SITE_URL: z
    .url({ message: 'NEXT_PUBLIC_SITE_URL must be a valid URL.' })
    .refine((v) => !v.endsWith('/'), {
      message: 'NEXT_PUBLIC_SITE_URL must not have a trailing slash.',
    }),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional().default(''),
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: z.string().optional().default(''),
})

export type PublicEnv = z.infer<typeof publicSchema>

let cachedPublicEnv: PublicEnv | null = null

/**
 * Read and validate public environment variables.
 *
 * Optional integrations (analytics, ads) are intentionally not required: the
 * application must run without them and simply omit the related scripts.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Invalid public environment configuration:\n${details}\n\n` +
        'Copy .env.example to .env.local and fill in the missing values.',
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

/* -------------------------------------------------------------------------- */
/* Server-only environment                                                    */
/* -------------------------------------------------------------------------- */

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((v) => v ?? ''),
  APP_ORIGIN: z.string().url().optional().transform((v) => v ?? ''),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cachedServerEnv: ServerEnv | null = null

/**
 * Read and validate server-only environment variables.
 *
 * The Supabase service-role key is optional so that development and CI can run
 * without it. Privileged operations must fail loudly when it is absent rather
 * than silently downgrading to the publishable key.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_ORIGIN: process.env.APP_ORIGIN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid server environment configuration:\n${details}`)
  }

  cachedServerEnv = parsed.data
  return parsed.data
}

/* -------------------------------------------------------------------------- */
/* Site helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Canonical origin without a trailing slash. */
export function getSiteUrl(): string {
  return getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
}

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string = '/'): string {
  const base = getSiteUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** True when running in a local development environment. */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/** True when analytics / advertising scripts may be requested. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
