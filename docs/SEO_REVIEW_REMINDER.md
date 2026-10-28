# SEO Audit Review — Reminder (2026-10-28)

Reminder set for 20:00–21:00 to process the SEO/performance audit findings.

## Verdicts

1. **URL canonicalization (HIGH)** — Partially exists. Canonical tags + trailing-slash/HTTP redirects OK. **Gap: `www.getscholarship.online` returns 200 instead of redirecting to apex.** Fix in Vercel domain config.
2. **Keywords in title/meta/heading (HIGH)** — Mostly addressed via CMS `seo_title`/`seo_description`. Editorial task; no code defect.
3. **CDN for resources (MEDIUM)** — Partial. Own assets on Vercel CDN. Supabase storage not cached (`CF-Cache-Status: DYNAMIC`, `Cache-Control: private, no-cache`). Third-party logos out of control.
4. **Distorted images (MEDIUM)** — Not found in code (likely false positive). All images use `object-cover`/`object-contain`.
5. **FCP ≤ 1.8s (MEDIUM)** — Not measured. Needs Lighthouse run on production build. Risk: ~456 KB shared chunk.
6. **Google Analytics (MEDIUM)** — Missing on live site (known Phase 6 gap). Code ready and consent-gated; needs GA property + env var.
7. **SPF record (LOW)** — Real gap (DNS). No TXT record exists. Add SPF (and DKIM/DMARC) at registrar.
8. **>20 HTTP requests (LOW)** — Likely true on homepage (~26 `src=`). Driven by many third-party logos.

## Action buckets
- **Code/infra (can do in repo):** Supabase cache headers, lazy-loading tuning, GA env wiring.
- **Infra (Vercel/DNS):** www→apex redirect, SPF TXT record.
- **Editorial:** keyword coverage via SEO fields.
- **Measurement:** Lighthouse FCP run.

See full review in the session transcript / AGENTS.md known gaps.

## Processed (2026-10-28)

Code/infra items actioned in-repo (see CHANGELOG "SEO/performance audit triage"):

- GA production-build gate actually applied in `google-analytics.tsx`.
- Proxy authenticated-response cache headers now stamped instead of no-op.
- `images.minimumCacheTTL` raised to one year.
- Institution logos declare `loading="lazy"`.

Pending (human/infra/editorial/measurement):

- www→apex redirect in Vercel (www currently 200).
- SPF/DKIM/DMARC at registrar.
- Supabase Storage CDN caching (platform-side; not fixable in repo).
- Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel production.
- Keyword coverage via CMS SEO fields.
- Lighthouse FCP run against a production build.