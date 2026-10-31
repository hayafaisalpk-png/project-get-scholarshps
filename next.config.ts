import type { NextConfig } from 'next'

/**
 * GetScholarship — Next.js configuration.
 *
 * Security headers are intentionally set at the application layer so they apply
 * identically on Vercel and on self-hosted/preview deployments.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  poweredByHeader: false,

  experimental: {
    /*
     * Server Action request body limit.
     *
     * Next.js defaults this to 1 MB and it applies to the WHOLE request, so a
     * multipart upload through a Server Action is rejected before the action
     * function ever runs. Left at the default, the media library promised
     * "maximum 5 MB" — matching `file_size_limit` on the Supabase buckets
     * (migration 011) — while any file over 1 MB produced a bare 413 with nothing
     * rendered in the form, because there was no action result to display.
     *
     * Deliberately set ABOVE the application's own 5 MB limit rather than equal
     * to it. The transport limit is silent; the application's check returns a
     * message. Giving the transport more headroom means a 5–6 MB file is rejected
     * by `checkUploadFile` with an explanation, and only a file over 8 MB — which
     * no editor should be uploading anyway — ever reaches the raw transport error.
     *
     * These two numbers must stay in step — see `MAX_BYTES` in
     * `src/features/media/validation.ts`.
     */
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },

  images: {
    // Only Supabase Storage CDN may serve remote images.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
      // Institution logos and social share images are editor-supplied arbitrary
      // HTTPS URLs, so the host cannot be enumerated in advance. A wildcard is
      // required or `next/image` refuses to render them in production (it is
      // lenient about this only in development).
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    // Next 16 defaults these; declared explicitly so the intent is auditable.
    qualities: [75],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    maximumRedirects: 3,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // The admin surface must never be indexed or cached by shared caches.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      },
      {
        // Auth pages must not leak via the bfcache after sign-out, and must not
        // be indexed.
        //
        // The `(auth)` layout already emits `robots: noindex, follow: false` as a
        // meta tag. The header is added so the instruction is present even to a
        // consumer that does not parse the document body — and so `/auth` is
        // covered by the same rule as `/admin`, rather than by a robots.txt rule
        // alone. `robots.txt` disallowing `/auth` stops the crawl; the header
        // covers the case where a crawler arrives with the URL already known.
        source: '/auth/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      },
    ]
  },
}

export default nextConfig
