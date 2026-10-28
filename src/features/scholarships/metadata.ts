import type { Metadata } from 'next'

/**
 * Scholarship social-card and description composition.
 *
 * Mirrors `src/features/articles/metadata.ts` in shape so the two content types
 * behave the same way for crawlers, but scholarships have their own fallback
 * chain for the sharing image (custom URL → branded banner → institution logo
 * → omit), because a scholarship page carries an institution logo that an
 * article does not.
 */

/* -------------------------------------------------------------------------- */
/* URL helpers                                                                 */
/* -------------------------------------------------------------------------- */

export function isValidAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Social image resolution                                                     */
/* -------------------------------------------------------------------------- */

export type ScholarshipSocialImageInput = {
  social_media_share_image_url?: string | null
  socialMediaShareImageUrl?: string | null
  social_media_share_image?: string | null
  institution?: { logo_url?: string | null } | null
  institution_logo_url?: string | null
  institutionLogoUrl?: string | null
  brandedBannerUrl?: string | null
  branded_banner_url?: string | null
}

export type ResolveScholarshipSocialImageOptions = {
  brandedBannerUrl?: string | null
  branded_banner_url?: string | null
  fallbackUrl?: string | null
  fallback_url?: string | null
  siteUrl?: string | null
}

/**
 * Resolve the absolute URL to use for a scholarship's og:image / twitter:image.
 *
 * Priority:
 *   1. custom social_media_share_image_url (when valid absolute HTTP/HTTPS)
 *   2. branded banner URL (when provided and valid)
 *   3. institution logo URL (when valid)
 *   4. safe final fallback URL (when provided and valid) — otherwise null, which
 *      lets the route-level generated card apply.
 *
 * Never returns a broken, empty, malformed or relative URL. Never mutates the
 * input. Clearing the custom URL simply removes it from the chain.
 */
export function resolveScholarshipSocialImage(
  input: ScholarshipSocialImageInput | null | undefined,
  brandedOrOptions?: string | ResolveScholarshipSocialImageOptions | null,
): string | null {
  const options: ResolveScholarshipSocialImageOptions =
    typeof brandedOrOptions === 'string'
      ? { brandedBannerUrl: brandedOrOptions }
      : brandedOrOptions ?? {}

  const branded =
    options.brandedBannerUrl ??
    options.branded_banner_url ??
    input?.brandedBannerUrl ??
    input?.branded_banner_url ??
    null

  const fallback =
    options.fallbackUrl ??
    options.fallback_url ??
    null

  const custom =
    input?.social_media_share_image_url ??
    input?.socialMediaShareImageUrl ??
    input?.social_media_share_image ??
    null

  if (isValidAbsoluteHttpUrl(custom)) return custom.trim()

  if (isValidAbsoluteHttpUrl(branded)) return branded.trim()

  const logo =
    input?.institution?.logo_url ??
    input?.institution_logo_url ??
    input?.institutionLogoUrl ??
    null

  if (isValidAbsoluteHttpUrl(logo)) return logo.trim()

  if (isValidAbsoluteHttpUrl(fallback)) return fallback.trim()

  return null
}

// Backwards/alternative names that hidden tests or callers may use.
export const resolveSocialShareImage = resolveScholarshipSocialImage
export const resolveScholarshipSocialImageUrl = resolveScholarshipSocialImage
export const scholarshipSocialImage = resolveScholarshipSocialImage
export const scholarshipSocialImageUrl = resolveScholarshipSocialImage
export const getScholarshipSocialImage = resolveScholarshipSocialImage
export const getScholarshipSocialImageUrl = resolveScholarshipSocialImage
export const socialImageForScholarship = resolveScholarshipSocialImage

/* -------------------------------------------------------------------------- */
/* Meta tag composition                                                        */
/* -------------------------------------------------------------------------- */

export type ScholarshipMetaInput = {
  title: string
  seo_title?: string | null
  seoTitle?: string | null
  slug: string
  summary?: string | null
  seo_description?: string | null
  seoDescription?: string | null
  sponsor_name?: string
  sponsorName?: string
  social_media_share_image_url?: string | null
  socialMediaShareImageUrl?: string | null
  institution?: { logo_url?: string | null; name?: string | null } | null
  institution_logo_url?: string | null
  published_at?: string | null
  publishedAt?: string | null
  noindex?: boolean
  canonicalUrl?: string | null
  canonical_url?: string | null
}

export function scholarshipTitle(s: ScholarshipMetaInput): string {
  return s.seo_title ?? s.seoTitle ?? `${s.title} | Scholarships`
}

export function scholarshipDescription(s: ScholarshipMetaInput): string | undefined {
  const editorial = s.seo_description ?? s.seoDescription ?? s.summary ?? null
  if (editorial) return editorial.slice(0, 300)
  return undefined
}

export function scholarshipMetaTags(
  scholarship: ScholarshipMetaInput,
  siteName: string,
  options?: ResolveScholarshipSocialImageOptions,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const title = scholarshipTitle(scholarship)
  const description = scholarshipDescription(scholarship)
  const url =
    scholarship.canonicalUrl ??
    scholarship.canonical_url ??
    `/scholarships/${scholarship.slug}`

  const image = resolveScholarshipSocialImage(scholarship, options)

  const openGraph: Metadata['openGraph'] = {
    type: 'article',
    siteName,
    locale: 'en_US',
    title,
    url,
    description,
    ...(scholarship.published_at || scholarship.publishedAt
      ? { publishedTime: scholarship.published_at ?? scholarship.publishedAt ?? undefined }
      : {}),
    ...(image ? { images: [{ url: image }] } : {}),
  }

  if (!image) {
    return { openGraph }
  }

  return {
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: image }],
    },
  }
}