# Development Roadmap

Feature checklist and authoritative status. A feature is marked **Complete**
only when its acceptance criteria have actually been verified by running them.

Legend: `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked

Last updated: 2026-10-15

---

## Phase 1 — Repository audit and foundation · **COMPLETE**

- [x] Audit existing repository and environment
- [x] Verify pinned framework and dependency versions against official docs
- [x] `git init` on `main`
- [x] Scaffold Next.js 16.4.0 (App Router, Turbopack)
- [x] TypeScript `strict` + `noUncheckedIndexedAccess`
- [x] Tailwind CSS v4 with `@theme` design tokens (`src/app/globals.css`)
- [x] ESLint 10 flat config (`next lint` was removed in Next 16)
- [x] Environment validation via Zod (`src/lib/env.ts`)
- [x] Supabase browser / server / admin clients + `src/proxy.ts`
- [x] Security headers in `next.config.ts`
- [x] Vitest (unit/integration) and Playwright (E2E) configuration
- [x] `.env.example` with no secrets
- [x] Documentation set (`AGENTS.md` + `docs/`)
- [x] `npm run verify` green

**Acceptance criteria:** met — `typecheck`, `lint`, `test`, `build` all pass.

**Not verified:** the app has never run against a live Supabase project.

---

## Phase 2 — Database and security foundation · **NOT STARTED**

> Blocked on: Supabase project credentials (URL + publishable key + service
> role key). Schema design is complete in `docs/DATABASE_SCHEMA.md`.

- [ ] Provision Supabase project (staging first)
- [ ] `supabase/config.toml`, CLI linked to the project
- [ ] Migration: extensions, enums, `updated_at` trigger helper
- [ ] Migration: identity — `profiles`, `roles`, `permissions`,
      `role_permissions`, `user_roles`
- [ ] Migration: taxonomy — `categories`, `tags`, `education_levels`,
      `academic_fields`, `locations`
- [ ] Migration: scholarships + join tables + sources + verification logs
- [ ] Migration: generated `tsvector` column and GIN index for search
- [ ] Migration: articles, revisions, reviews, authors, article↔scholarship
- [ ] Migration: media, settings, navigation, homepage sections, ad placements
- [ ] Migration: newsletter, contact, consent, redirects, audit logs, reports
- [ ] Enable RLS on every table
- [ ] `SECURITY DEFINER` helper functions for role lookup
- [ ] Write policies: anon read published only; authenticated role-scoped
- [ ] Storage buckets + upload policies
- [ ] Safe `seed.sql` (roles, permissions, taxonomy, settings)
- [ ] Test RLS as anonymous, student and admin

**Acceptance criteria:** migrations run cleanly on a fresh database; anonymous
write attempts are rejected; students cannot read draft content; administrators
can. Each tested with actual queries, not assumed.

---

## Phase 3 — Public website · **NOT STARTED**

- [ ] Design system primitives: Button, Input, Select, Card, Badge, Alert,
      Dialog, Dropdown, Pagination, Skeleton, EmptyState
- [ ] Responsive header with dropdown navigation and accessible mobile menu
- [ ] Footer
- [ ] Homepage driven by `homepage_sections` (hero, search, featured,
      deadlines, recent, by level, by field, by location, by category, tips,
      articles, FAQ, newsletter, trust)
- [ ] Real statistics from aggregate queries — never invented
- [ ] Scholarship search: server-side, indexed filters, full-text, pagination,
      sorting, URL state, clear-filters, empty states
- [ ] Scholarship detail pages at `/scholarships/[slug]`
- [ ] Lifecycle handling: expired scholarships keep their page and show status
- [ ] Related scholarships and articles
- [ ] "Report incorrect information" flow
- [ ] Category / level / field / location landing pages
- [ ] Articles: listing and detail
- [ ] About, Contact, Help, Privacy, Terms
- [ ] Loading skeletons, empty states, error boundaries, 404
- [ ] Accessibility pass (WCAG 2.2 AA), keyboard and mobile verification

---

## Phase 4 — Administration and CMS · **NOT STARTED**

- [ ] Auth: register, email verification, login, logout, password reset/update
- [ ] Protected `/admin` with role-aware navigation
- [ ] Dashboard with real aggregate metrics
- [ ] Scholarship management: create, edit, preview, publish, schedule, expire,
      archive, restore, bulk actions, categories, tags, eligibility,
      instructions, official URL validation, internal notes, verification
- [ ] Article CMS: TipTap editor, autosave with status, preview, featured image,
      SEO fields, scheduling, revisions, review workflow, reading time,
      Markdown import/export
- [ ] Server-side rich-text sanitization (allowlist)
- [ ] Taxonomy management with slug uniqueness and delete protection
- [ ] Media library on Supabase Storage with validation and alt-text management
- [ ] User and role management
- [ ] Site settings
- [ ] Newsletter management
- [ ] Navigation and homepage composition editors
- [ ] Audit log viewer

---

## Phase 5 — SEO and content quality · **NOT STARTED**

- [ ] Per-route `generateMetadata` from database content
- [ ] Canonical rules incl. pagination and filtered search
- [ ] Sitemap index + segmented sitemaps
- [ ] `robots.txt`
- [ ] Redirect manager and redirect enforcement
- [ ] JSON-LD: Organization, WebSite, WebPage, BreadcrumbList, BlogPosting,
      Person, ItemList — each validated, only where accurate
- [ ] OG and social images
- [ ] Alt-text coverage enforcement
- [ ] SEO admin controls with index/noindex guardrails
- [ ] Indexability verification (drafts and admin unreachable by crawlers)

---

## Phase 6 — Advertising and analytics · **NOT STARTED**

> Blocked on: AdSense publisher approval and a GA4 property.

- [ ] Consent banner: accept all / reject optional / manage preferences
- [ ] Persistent privacy settings control
- [ ] Consent Mode signals; no non-essential script before consent
- [ ] GA4 loader injected only after analytics consent
- [ ] Events: `page_view`, `view_scholarship`, `search_scholarships`,
      `filter_scholarships`, `click_apply`, `view_article`, `newsletter_signup`
- [ ] No PII in any event parameter
- [ ] AdSense loader injected only after ads consent
- [ ] Configurable placements with per-placement enable/disable
- [ ] Reserved space for ad slots (CLS)
- [ ] Ads disabled outside production
- [ ] Labelled sponsored outbound links (`rel="sponsored nofollow"`)
- [ ] Content-Security-Policy finalised and deployed

---

## Phase 7 — Quality assurance · **NOT STARTED**

- [ ] Unit tests: validation schemas, SEO helpers, sanitization, date/amount
      formatting, search parsing
- [ ] Integration tests with mocked Supabase clients
- [ ] RLS policy tests against a live project
- [ ] Auth and role permission tests
- [ ] Search filtering and pagination tests
- [ ] Editorial workflow tests
- [ ] Playwright E2E for the 18 required journeys
- [ ] Responsive and keyboard navigation checks
- [ ] Structured data validation
- [ ] Error and edge-case handling verification
- [ ] Dependency audit review

---

## Phase 8 — Deployment · **NOT STARTED**

- [ ] GitHub repository (private until launch)
- [ ] Vercel project connected, preview + production environments
- [ ] Production Supabase project
- [ ] DNS: apex + `www` 301 to apex
- [ ] Production environment variables
- [ ] Migration execution procedure (no reset, no data loss)
- [ ] Backup and point-in-time recovery configuration
- [ ] Auth email delivery and redirect URLs verified
- [ ] Production AdSense and GA4 configuration
- [ ] Sitemap submission and robots.txt verification
- [ ] Post-deploy smoke tests (desktop and mobile)

---

## Open decisions requiring human input

1. **Supabase credentials** — required before Phase 2 can start.
2. **TypeScript version** — pinned to 5.9.3 for stability. The current release
   line is 7.x, whose ecosystem support (notably Next's type generation) is not
   yet established. Revisit once Next officially targets it.
3. **Next.js patch level** — pinned to exactly 16.4.0 as specified. 16.4.1 is
   available; adopting it requires approval.
4. **Content acquisition** — which scholarship sources are licensed or
   permitted for import. Nothing may be scraped without confirmation.
5. **Legal/privacy review** — required before monetised launch, given the
   audience's likely jurisdiction.

---

## Explicitly not claimed

- No scholarship, article or taxonomy record has been created.
- No Supabase project has been provisioned or connected.
- No migration has been written or executed.
- No AdSense or GA4 integration is live.
- No deployment has occurred.
