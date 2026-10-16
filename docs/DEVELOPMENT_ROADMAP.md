# Development Roadmap

Feature checklist and authoritative status. A feature is marked **Complete**
only when its acceptance criteria have actually been verified by running them.

Legend: `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked

Last updated: 2026-10-16 (new Supabase project provisioned; Phase 2 re-verified)

---

## ✅ Resolved — database re-provisioned

The replacement project **`nnufigsnijqzcojnpyuw`** is provisioned, linked and
fully migrated. All 19 migrations plus `supabase/seed.sql` applied cleanly
(`supabase db push --include-seed`, exit 0).

**A real migration bug was found and fixed in the process.** `citext` was
created in the `extensions` schema but referenced unqualified in 18 column
definitions across migrations 003, 005, 007, 008, 009 and 015. This worked on
the deleted project only because its `search_path` happened to include
`extensions`; the Supabase CLI connects through a temporary login role that does
not, so migration 003 failed with `type "citext" does not exist`. Every
reference is now schema-qualified (`extensions.citext`), matching the
`extensions.gin_trgm_ops` style already used for the pg_trgm indexes.

Re-verified on the new project:

- `npm run test:rls` — **66 passed, 0 failed**, cleanup removed its 4 test users
  and 10 fixture records.
- `npm run verify` — exit 0 (typecheck, lint, 95 tests, production build).
- Seeded reference data: 6 roles, 24 permissions, 69 role-permissions, 6
  categories, 6 education levels, 9 academic fields, 19 site settings,
  14 navigation items, 14 homepage sections, 1 author.
- **scholarships 0, articles 0, media 0** — no fabricated content, as required.
- Public routes against the live database: `/` 200, `/scholarships` 200,
  filtered search 200, thin taxonomy landing 404 (correct), unknown route 404.

The database claims below are therefore re-earned, not historical. Next:
Phase 4 (administration and CMS).

---

## Explicitly not claimed

- No scholarship, article or taxonomy *content* record exists. The database
  contains only reference data (roles, permissions, taxonomy, settings,
  navigation). Test fixtures used during development were clearly-labelled
  fictional records and have been deleted, so the live site currently renders
  its "database is being prepared" empty state.
- **The site will launch empty unless scholarship data is sourced.** This is a
  content-acquisition decision, not a code one — see "Open decisions" below.
- No user account exists in the database; all test identities were removed.
- Articles are not implemented: no query layer, listing or detail pages.
- The static informational pages (About, Contact, Help, Privacy, Terms,
  Editorial Standards) do not exist yet. The header and footer link to them, so
  those links currently 404.
- The "Report incorrect information" link is present on scholarship pages but has
  no submission handler behind it yet.
- No robots.txt, sitemap.xml or Open Graph images yet (Phase 5).
- No AdSense or GA4 integration exists (Phase 6).
- Nothing has been deployed.

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

## Phase 2 — Database and security foundation · **COMPLETE**

Supabase project provisioned and migrated. Originally
`whpozrnyressiznzdhpc` (deleted 2026-10-16); re-provisioned as
`nnufigsnijqzcojnpyuw` and fully re-verified — 66/66 live RLS assertions.

- [x] Provision Supabase project (staging)
- [x] `supabase/config.toml` + CLI linked
- [x] Migration: extensions, `updated_at` trigger helper
- [x] Migration: enums for every status-like column
- [x] Migration: identity — `profiles`, `roles`, `permissions`,
      `role_permissions`, `user_roles`
- [x] Migration: authorization helpers (`SECURITY DEFINER`, pinned
      `search_path`)
- [x] Migration: taxonomy — categories, levels, fields, locations, tags
- [x] Migration: media assets
- [x] Migration: scholarships + join tables + sources + verification logs
- [x] Migration: generated weighted `tsvector` column + GIN index
- [x] Migration: articles, revisions, reviews, authors, article↔scholarship
- [x] Migration: settings, navigation, homepage, ads, redirects, newsletter,
      contact, consent, reports, audit logs
- [x] Migration: RLS on all 38 tables with role-scoped policies
- [x] Migration: storage buckets (image-only, 5 MB) + policies
- [x] Safe `seed.sql` — roles, 22 permissions, taxonomy, settings, navigation
- [x] RLS tested as anonymous / student / author / reviewer / super_admin

**Acceptance criteria:** met — 59/59 live RLS assertions pass.

**Corrective migrations issued after testing** (see CHANGELOG 0.2.0):
- `012` — fixed a privilege-escalation flaw in the article permission model.
- `013` — revoked blanket `anon`/`authenticated` table privileges inherited
  from Supabase defaults, including `TRUNCATE`, which RLS cannot filter.
- `014` — restored a `SELECT` grant on `profiles` that `013` removed by
  mistake.

---

## Phase 2b — Application data access layer · **COMPLETE**

- [x] Typed database layer (`src/types/database.ts`) generated from the live
      schema by `supabase/scripts/generate-database-types.mjs`
- [x] All Supabase clients typed against `Database`
- [x] Identity via `auth.getClaims()`; roles/permissions/profile in one nested
      query, memoised per request
- [x] `requireUser` / `requireRole` / `requirePermission` / `requireCmsUser`
- [x] Permission and role vocabulary as compile-time unions
- [x] Typed database error mapping with safe user-facing messages
- [x] Scholarship search parameters: validate, canonicalise, serialise
- [x] Scholarship search in SQL (`public.search_scholarships`) with weighted
      full-text relevance, five taxonomy groups, deadline windows, sorting,
      pagination and total count
- [x] Scholarship detail with taxonomy, sources and required documents
- [x] Curated lists (featured, closing soon, recent) and related scholarships
- [x] 69 unit tests
- [x] Verified end-to-end through the real Next.js request path, signed in and
      signed out

**Acceptance criteria:** met — `npm run verify` clean; 66/66 RLS assertions;
live search and auth verified.

**Corrective migrations issued during this phase:**
- `015` — search function (new).
- `016` / `017` — public provenance view; `017` documents a deliberate
  owner-executed view privilege decision with assertions.
- `018` — restore `SELECT` on `scholarship_sources` for authenticated users.

---

## Phase 3 - Public website - PART 1 COMPLETE

### Part 1 complete (0.4.0)

- [x] Design system primitives: Button, Badge, Alert, EmptyState, Skeleton,
      Pagination, layout primitives
- [x] Responsive header with dropdown navigation and accessible mobile menu
- [x] Footer with database-driven columns and legal links
- [x] Homepage driven by `homepage_sections`; real aggregate statistics only
- [x] Scholarship search: server-side, indexed, full-text relevance, filtering,
      sorting, pagination, shareable URLs, clear-filters, honest empty states
- [x] Scholarship detail pages at `/scholarships/[slug]`
- [x] Lifecycle handling: expired scholarships keep their page and status
- [x] Related scholarships and taxonomy links on the detail page
- [x] Category / level / field / location landing pages; 404 when thin
- [x] 404 page, route error boundary, skip link, reduced-motion support
- [x] Correct HTTP status codes verified on every route
- [x] 95 unit tests; `npm run verify` clean

### Part 2 outstanding

- [ ] Articles: query layer, listing page, detail page
- [ ] About, Contact, Help, Privacy, Terms, Editorial Standards pages
- [ ] "Report incorrect information" handler (link exists; no submission yet)
- [ ] Newsletter signup form and handler
- [ ] robots.txt, sitemap.xml, Open Graph images
- [ ] Accessibility pass (WCAG 2.2 AA) with keyboard and screen-reader checks
- [ ] Responsive verification on real pages with content

> Deliberately NOT added: a `loading.tsx` in the scholarships segment. It opens
> a Suspense boundary above the page, so the shell is flushed with 200 before
> the page resolves and `notFound()` produces a soft 404. Measured and removed;
> the rationale is in the changelog and in the page file.
---

## Phase 4 — Administration and CMS · **IN PROGRESS (increment 1 of n)**

> Promoted ahead of Phase 3 part 2 by decision on 2026-10-16: content cannot be
> created until the CMS exists, so articles and static pages are blocked behind
> it. Phase 3 part 2 remains required and is not cancelled.

> Visual design direction for all new UI follows `AGENTS.md` §1
> (topuniversities.com). Administrative behaviour follows ipassgenerator.online
> where it can actually be inspected; where it cannot, the uncertainty must be
> recorded rather than guessed.

### Increment 1 — COMPLETE: authentication, /admin shell, dashboard

- [x] Sign-in / sign-out with Supabase SSR cookie sessions
- [x] Password reset request, PKCE code exchange, password update
- [x] Open-redirect defence (`safeReturnPath`), applied in page and action
- [x] No account enumeration on sign-in or reset
- [x] Authentication distinguished from authorisation (no role ⇒ signed out)
- [x] Protected `/admin` layout, role-aware sidebar, 403 boundary
- [x] Dashboard from live aggregate queries only
- [x] First-administrator bootstrap script
- [ ] **Verify the authenticated session path** — needs an operator-created
      account (`npm run admin:create -- <email>`)

### Resolved — scholarship form submit, and a real hydration bug

**The form was never broken.** The reported failure — "POST returns 200 with a
404 payload, `Set-Cookie: …auth-token=; Max-Age=0`, browser lands on
`/auth/login`" — came from the verification script, not the application.

`page.click('button[type="submit"]')` matches the **first** submit button in the
document, and the sidebar's "Sign out" button renders before `<main>`. Every
run therefore dispatched the **sign-out** action instead of save. That accounts
for all three symptoms at once: the cookie was cleared, the redirect went to
`/auth/login`, and `createScholarshipAction` never executed.

Confirmed by inspecting the request headers: the POST carried
`next-action: 0033b790…`, which is the sign-out action id.

Selectors in admin journeys must be scoped to the form under test, e.g.
`form:has(#title) button[type="submit"]`.

Verified working end to end afterwards: create → edit → publish → public page,
with `7500.00` stored as `750000` integer cents and an edit to `900000`.

### Fixed — hydration mismatch in the admin sidebar

A genuine bug, found while investigating the above.

`AdminNav` was a Client Component that re-derived the navigation list from the
permission array, while the surrounding sidebar was a Server Component. Server
and client filtered independently and could disagree on the number of `<li>`
elements, so every admin page failed hydration.

Fixed by filtering once on the server and passing the result as plain data.
Icons are referenced by string key rather than by component, because a React
component is not a serialisable prop.

A hydration mismatch is not cosmetic. React discards the server-rendered tree
and rebuilds it on the client, which destroys the Server Action reference bound
to any form inside it — so a mismatch in shared chrome can silently break every
form on the page.

### Increment 2 — COMPLETE: scholarship management

- [x] List with server-side search, status filter, status counts, pagination
- [x] Create and edit screens (award, timeline, eligibility, documents,
      classification, publishing, verification, featured/noindex, SEO)
- [x] Lifecycle actions with two-step destructive confirmation
- [x] Validation mirroring the database CHECK constraints; HTTPS-only links
- [x] Integer-cents money handling, covered by tests
- [x] Server-side authorisation + audit logging on every mutation
- [x] Create / edit / publish / public page verified end to end

### Remaining in Phase 4

- [ ] Scholarship management: create, edit, preview, publish, schedule, expire,
      archive, restore, bulk actions, verification
- [ ] Article CMS: TipTap editor, autosave, preview, featured image, SEO fields,
      scheduling, revisions, review workflow, server-side sanitisation
- [ ] Media library on Supabase Storage with MIME/size validation
- [ ] Taxonomy, user and role management, site settings, navigation and
      homepage composition editors, audit log viewer

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

