# Development Roadmap

Feature checklist and authoritative status. A feature is marked **Complete**
only when its acceptance criteria have actually been verified by running them.

Legend: `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked

Last updated: 2026-10-19 (header sign-in control now uses the semantic brand color;
public site redesigned against the bold.org reference —
design tokens, header, footer, homepage, listing and detail page; see
`docs/REFERENCE_ANALYSIS.md` and `docs/CHANGELOG.md`. Six `[SAMPLE]` fixtures are
loaded for visual review and must be removed before launch.)

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
  navigation) plus the five static pages. Test fixtures used during development
  were clearly-labelled fictional records and have been deleted, so the live site
  currently renders its empty states.
- **The site will launch empty unless scholarship data is sourced.** This is a
  content-acquisition decision, not a code one — see "Open decisions" below.
- No user account exists in the database; all test identities were removed. The
  two admin inboxes therefore have NOT been rendered with a signed-in session —
  their data access is proven by RLS assertions, not by a screen.
- The copy in `content_pages` is a **draft requiring legal review**, and there is
  no editing screen for it in the CMS yet.
- Both admin inboxes are **read-only**: no status-change action exists, so no
  status control is rendered.
- The public forms have **no rate limiting** — a honeypot and a fill-time check
  only.
- robots.txt, `sitemap.xml` and the Open Graph cards are built and verified
  against the live database (Phase 3). The redirect manager, structured-data
  validation and the SEO admin controls in Phase 5 are not.
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

## Phase 3 — Public website · **COMPLETE** (parts 1 and 2 below)

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

### Part 2 — COMPLETE

- [x] Articles: query layer (`src/features/articles/queries.ts`), listing page,
      detail page. RLS does the visibility work — no status filter in the reader.
- [x] About, Help, Privacy, Terms, Editorial Standards pages, rendered from a new
      `content_pages` table (migration 021) rather than hardcoded in components
      (`AGENTS.md` §2.8)
- [x] "Report incorrect information" handler — writes to `content_reports` via the
      session client, slug resolved server-side so a draft cannot be reported or
      probed for
- [x] Contact form writing to `contact_submissions` via the service-role client
- [x] Admin inboxes at `/admin/contact` and `/admin/reports` so submissions are
      actually readable (read-only; no triage actions yet)
- [x] Newsletter signup: form, Server Action with a full lifecycle (new /
      already-subscribed / re-subscribe after unsubscribe / bounced), and a
      read-only admin list at `/admin/newsletter`
- [x] `robots.txt` (`src/app/robots.ts`)
- [x] `sitemap.xml` (`src/app/sitemap.ts` + `src/lib/seo.ts`), composed from the
      database with an SQL aggregation for taxonomy thinness
- [x] Open Graph / Twitter cards via `ImageResponse`, per-record for scholarships
      and articles, static for the rest
- [x] Accessibility pass: 126 mechanical checks across 10 pages (heading order,
      landmarks, labels, link text, alt, aria-current, skip link, focus
      visibility, keyboard traversal, mobile drawer keyboard operation)
- [x] Responsive verification: 121 checks across 11 pages at 320/390/768/1280px
      (no horizontal overflow, no console errors, WCAG 2.5.8 target size)

**Every header and footer link now resolves.** Verified against the live
database: `/articles`, `/about`, `/contact`, `/help`, `/privacy`, `/terms`,
`/editorial-standards` all return 200 with real content; previously all seven 404'd.

### Phase 3 limits — read before claiming "accessible"

The accessibility pass is **mechanical and targeted, not a full WCAG 2.2 AA
audit**. It proves heading order, landmarks, accessible names, link text, image
alt, `aria-current`, skip-link operation, focus-indicator visibility, keyboard
reachability and target size. It does **not** cover:

- **Screen-reader output** — no NVDA, JAWS or VoiceOver was run. This is the
  single largest gap and requires a human.
- **Colour contrast** — the design tokens record their contrast budget in
  `src/app/globals.css`, but no automated sweep was run over every rendered pair.
- **2.4.11 Focus Not Obscured** and reflow at 320px with text zoomed to 200%.

Phase 7 still owns Playwright E2E for the 18 required journeys.

### Known Phase 3 limitations

- **The newsletter is OFF and should stay off for now.** `newsletter.enabled` is
  seeded `false` because no mail provider is configured, so nothing can be sent.
  The form's copy says so plainly rather than promising an email. Enabling it
  requires a provider AND something worth sending.
- **The newsletter block could never have worked.** `newsletter.enabled` was
  seeded `is_public = false`, so the public page could not read it — the block
  evaluated to `null` unconditionally. A gate that can only ever be closed looks
  identical to a working gate, which is why it was found by flipping the flag and
  looking for the form. Fixed by migration 026.
- **The newsletter admin list has no second layer of defence.** The table is
  revoked from every client role, so it is read through the service-role client
  and `requirePermission('newsletter.manage')` is the *only* boundary. Unlike the
  other inboxes, there is no RLS behind it.
- **`/contact` is deliberately absent from the sitemap** — a page whose only
  purpose is to receive input has no search value.
- **A segmented sitemap index is still outstanding.** The single file is capped
  at 50,000 URLs and logs loudly if approached; this matters only at real scale.

> **Copy in `content_pages` is a draft and needs legal review before launch.**
> Nothing in it claims a verification team, an address, a response time or a
> statistic, because none exist. The privacy text states plainly that no
> advertising or analytics is currently active. "Legal/privacy review" remains
> open decision 5.

> **No rate limiting on the public forms.** Honeypot plus a fill-time check reject
> naive scripted submitters, but a determined bot that solves the honeypot and
> waits two seconds can still submit. `UPSTASH_REDIS_REST_URL` exists in the
> environment schema; adding a Redis client needs approval (`AGENTS.md` §2.10).

> Deliberately NOT added: a `loading.tsx` in the scholarships segment. It opens
> a Suspense boundary above the page, so the shell is flushed with 200 before
> the page resolves and `notFound()` produces a soft 404. Measured and removed;
> the rationale is in the changelog and in the page file.
---

## Phase 4 — Administration and CMS · **COMPLETE**

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
 - [x] **Verify the authenticated session path** — verified with an operator-created
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

### Increment 3 — COMPLETE: article CMS and rich-text editor

- [x] TipTap editor: headings 1–6, bold, italic, underline, strikethrough,
      inline code, lists, blockquote, links, images, tables, horizontal rules,
      undo/redo, clear formatting
- [x] Accessible toolbar (`role="toolbar"`, `aria-pressed` per control)
- [x] Server-side allowlist sanitisation applied on write and on render
- [x] Derived plain text, word count and reading time
- [x] Draft / review / scheduled / published / archived workflow
- [x] Categories, tags and related scholarships
- [x] SEO title, description, canonical URL, noindex, sitemap controls
- [x] Revision snapshots confirmed firing on content and title changes
- [x] 23/23 end-to-end checks against the live database

### Increment 4 — COMPLETE: public submissions and their inboxes

Shipped alongside Phase 3 part 2 because the public forms are worthless without a
way to read what they collect (`AGENTS.md` §2.5).

- [x] `content_pages` table + RLS + seeded legal/about copy (migration 021)
- [x] Contact form → `contact_submissions` via the service-role client
- [x] "Report incorrect information" → `content_reports` via the session client,
      slug resolved server-side under RLS
- [x] Read-only inboxes at `/admin/contact` (`contact.manage`) and
      `/admin/reports` (`report.manage`)
- [x] Status-change actions for both inboxes — closed in increment 6 below.

**Three real defects were found and fixed while building this.** All three were the
same shape — a Row Level Security policy with no underlying table grant, which is
unreachable and invisible to anyone reading the policies:

1. **`contact_submissions` had no SELECT policy at all** (migration 022 added it,
   but migration 013 had revoked every privilege and nothing restored it). Messages
   were stored and unreadable, making the contact form a black hole.
2. **`content_reports` had no `SELECT` grant** for anyone, so the reports inbox
   added in 013 could never read a row. Fixed by migration 023.
3. **The public report form failed silently for every visitor.** `anon` INSERT was
   revoked by migration 013 and only re-granted to `authenticated`, so a signed-out
   visitor — which is who most people are — got `42501` while the UI reported
   success. Fixed by migration 024.

The suite had asserted only that anon *cannot* read or forge reports, both of
which were true while the feature was broken. A positive assertion
(`anon CAN file a legitimate report`, plus a service-role control proving the row
is stored) was added. **A suite made only of denials passes against a feature that
does not work.**

### Increment 5 — COMPLETE: media library

- [x] Upload to Supabase Storage with MIME, size, extension **and magic-byte**
      validation (`sniffImageMime`)
- [x] Private by default; public promotion is a deliberate toggle
- [x] Signed-URL previews for private assets, batched per page, never persisted
- [x] Per-asset alt text / caption / attribution / folder editing
- [x] Two-step archive (soft delete), because both `scholarships.image_id` and
      `articles.featured_image_id` are `on delete set null`
- [x] Generated storage paths — the uploaded filename never reaches the path
- [x] `media.upload` to add, `media.manage` to edit and archive
- [x] 29 unit tests, 5 new live RLS assertions, 28 end-to-end browser checks

**Unblocks:** article featured images (the last piece of increment 3).

### Increment 6 — COMPLETE: inbox triage

- [x] `setContactStatusAction` (`contact.manage`) and `setReportStatusAction`
      (`report.manage`), each: permission first, Zod second, session client for
      the write so RLS re-checks it, audit log last
- [x] Transition rules extracted to `src/lib/validation/inbox.ts` and unit
      tested, including a test that restates
      `content_reports_resolved_consistent` as an assertion
- [x] Closing a report requires a written note; reopening clears
      `resolved_at`, `resolved_by` and `resolution_note` together
- [x] No DELETE on either table, and no control that suggests otherwise
- [x] 32 new unit tests, 8 new live RLS assertions, 26 end-to-end browser checks

**A fourth "policy with no grant" defect was found and fixed.** Migration 022
created `contact_submissions_update_cms` and documented the intent to grant
UPDATE, but migration 013's blanket revoke was only ever undone for SELECT
(migration 023). PostgreSQL checks the privilege before the policy, so a
super_admin's triage UPDATE failed with `42501`. Migration 028 grants UPDATE to
`authenticated` and asserts the privilege with `has_table_privilege`.

The important part is **how long it went unnoticed**: the suite passed 91/91 while
the feature was completely unreachable, because every `contact_submissions`
assertion was a SELECT or a "cannot", and the "author CANNOT triage" denial
passed for the wrong reason — refused by the missing grant, not by the policy.
Every new denial is now paired with a positive case for a permitted identity.

### Increment 7 — COMPLETE: featured-image picker

`articles.featured_image_id` and `scholarships.image_id` have existed since Phase 2
with no control anywhere in the CMS. A column an editor cannot set is a column
nobody sets.

- [x] `MediaPicker` — search, preview, select, remove, on the article form
- [x] Archived assets are **not offered**; a new page should not start life
      pointed at something on its way out
- [x] The chosen image is verified server-side: it must exist, must not be
      archived, and must carry alt text or an explicit decorative flag
- [x] The picker shows what a screen reader will be told, before publishing
- [x] 10 unit tests for the selection rules, **21 end-to-end checks**

**This is where the Phase 5 alt-text work becomes user-facing.** The picker
renders each thumbnail with `altAttributeFor`, the single function that will also
serve the public pages — so an empty `alt=""` for a decorative image is decided
once and cannot drift. The end-to-end run asserts the decorative thumbnail's alt
is empty rather than its file name, and that the described one carries its text.

**Round trip verified explicitly**, because it is the failure mode that loses data
quietly: an article whose image was chosen from page three of the library would
render with nothing selected while the id was still stored, and the next save
would clear it. The edit screen resolves the chosen asset separately from the
first library page, and the run confirms that reopening shows the image, that a
**second save does not clear it**, and that Remove does.

`<img>` is used rather than `next/image`, deliberately: these are admin-only
thumbnails of possibly-signed URLs, and the optimiser would cache a URL that has
already expired. The rule is disabled for that one file with the reason recorded.

### Phase 4 completion

- [x] Article CMS: autosave, preview, review-decision UI (**featured-image
      selection shipped in increment 7**)
- [x] Scholarship management: bulk actions, restore, verification workflow
- [x] Content-page editor in the CMS — `/admin/content-pages` list + edit form
      (title, excerpt, body, status, SEO), gated by `settings.manage`
- [x] Taxonomy editor - `/admin/taxonomy` (categories, tags, education levels,
      academic fields, locations: list + add + delete)
- [x] Site settings, navigation and homepage composition editors
- [x] User and role management — `/admin` Users table with assign/revoke roles
      (migration 031 adds RLS policies gated on `role.manage`)
- [x] An "archived" filter in the media library — Active/Archived/All toggle on
      `/admin/media` (query param `archived`), backed by `listMediaAssets`

Phase 4 was completed on 2026-10-18. The final increment added article draft
autosave, a permission-gated preview, review decisions with review history and
auditing, scholarship bulk lifecycle actions, and explicit verification controls.
Local quality gates pass: typecheck, lint, 449 unit tests, and production build.

---

## Phase 5 — SEO and content quality · **COMPLETE**

> Audited before starting, because several rows here were stale. Verified against
> the code, not the checklist: per-route `generateMetadata`, canonical rules,
> `robots.txt` and OG images were already built and verified in Phase 3 and are
> marked complete below. The genuinely missing work is listed as remaining.

- [x] Per-route `generateMetadata` from database content *(Phase 3)*
- [x] Canonical rules incl. pagination and filtered search *(Phase 3)*
- [x] `robots.txt` *(Phase 3)*
- [x] OG and social images *(Phase 3)*
- [x] JSON-LD: Organization, WebSite, WebPage, CollectionPage, BreadcrumbList,
      BlogPosting, Person, ItemList — increment 1
- [x] Sitemap index + segmented sitemaps — increment 3
- [x] Redirect manager and redirect enforcement — increment 2
- [x] Alt-text coverage enforcement — increment 5
- [x] SEO admin controls with index/noindex guardrails — increment 4
- [x] Indexability verification sweep — increment 5

### Increment 1 — COMPLETE: structured data, and a noindex defect it exposed

- [x] `src/lib/structured-data.ts` — pure builders: `siteGraph` (Organization +
      WebSite), `webPageLd`, `collectionPageLd`, `breadcrumbLd`, `itemListLd`,
      `personLd`, `articleLd`, plus `serializeJsonLd`
- [x] `<JsonLd>` server component; `<` `>` `&` escaped on serialisation, because
      titles and bylines are editor-controlled
- [x] Emitted from the public layout (site level) and from the scholarship index,
      scholarship detail, article index, article detail and all four taxonomy
      landings (page level)
- [x] Every builder declines rather than guessing: no `Person` without a byline,
      no `ItemList` for an empty page, nothing page-level on a `noindex` page.
      `Organization.logo` was withheld here because no brand asset existed, and is
      emitted now that one does — see "The site brand" below
- [x] 27 unit tests; **62 end-to-end checks** against a production build and the
      live database

**A real indexability defect was found and fixed.** `noindex` on a scholarship was
excluded from the sitemap — and the detail page emitted **no robots meta at
all**, because `DETAIL_SELECT` never fetched the column. The record was therefore
simultaneously withheld from the sitemap and advertised as indexable to any
crawler following an inbound link, which is precisely the contradiction
`src/lib/seo.ts` warns about. The column is now selected and the directive is
emitted. Verified by flagging a real record, fetching its page, checking both the
meta and the sitemap, then clearing the flag and re-checking both.

**Two things were deliberately not emitted.** `WebSite` carries no
`SearchAction`: site search resolves to `?q=`, which is `noindex`, and advertising
a search endpoint that asks not to be indexed is the same contradiction. And no
scholarship-specific schema type, per the policy in `docs/SEO_GUIDELINES.md` §5 —
there is no widely-supported type for a scholarship award.

**Not verified:** the Schema Markup Validator and Rich Results Test have not been
run. The documents are asserted well-formed and self-consistent in tests and
against real pages, which is not the same as a consumer-side validation pass.

### Increment 2 — COMPLETE: redirect manager and enforcement

The `redirects` table shipped in Phase 2 with four CHECK constraints, an index,
`seo.manage` policies and **nothing read it**. A rule could be inserted directly
into the database and had no effect on any request — the clearest possible
example of a control that looks real and does nothing.

- [x] `src/features/redirects/resolution.ts` — pure resolver: exact-path
      matching, chain following, bounded hops, loop refusal, query preservation
- [x] Enforcement in `src/proxy.ts`, before any auth work, using a TTL-cached
      rule map read through the service-role client
- [x] `/admin/redirects` — create, edit, pause/resume, delete, behind `seo.manage`
- [x] Loop detection at write time, so an editor is told before saving rather
      than discovering a 404 at the URL afterwards
- [x] 30 unit tests, 10 new live RLS assertions, **33 end-to-end checks**

**Migration 029 fixed the fifth instance of "policy with no grant".** Migration
013 granted `INSERT, UPDATE, DELETE` on `redirects` but omitted `SELECT`, so an
administrator could write a redirect and not read one back — the CMS rendered
"Redirects could not be loaded". The SELECT policy existed throughout and was
dead code. Found by opening the screen as a real signed-in administrator, not by
reading the policies.

**Two behaviours were measured rather than assumed, and one of them corrected a
wrong assumption in this codebase's own comments:**

1. `NextResponse.redirect` parses the URL it is given, so a relative `Location`
   throws `ERR_INVALID_URL` and the request 500s. The destination is resolved
   against the REQUEST origin — not `NEXT_PUBLIC_SITE_URL` — so a preview
   deployment cannot bounce a visitor onto production.
2. **`invalidateRedirectCache()` cannot reach the proxy.** The proxy runs in its
   own module registry, separate from the one running Server Actions, so the
   action clears its own copy and the proxy's is untouched. A rule created
   through the CMS did not start redirecting until the TTL expired. The TTL is
   therefore the only bound, in both directions; it is 15 seconds, and the admin
   screen says so rather than letting an editor conclude the feature is broken.

**Not wired:** `redirects.hit_count` exists in the schema but is not maintained
and is deliberately not displayed. Counting hits means a database write per
redirect on a public path — a cost and an abuse vector — so a permanently-zero
counter is shown nowhere instead of being faked (`AGENTS.md` §2.7).

### Increment 3 — COMPLETE: sitemap index and segmented sitemaps

`/sitemap.xml` was a single `<urlset>` that would have breached the 50,000-URL
protocol cap at scale — `src/lib/seo.ts` logged an error saying so and did
nothing about it.

- [x] `/sitemap.xml` is now a true `<sitemapindex>` listing segment files
- [x] Segments split by **content type** — `pages`, `scholarships`, `articles`,
      `taxonomy` — not by an arbitrary block size
- [x] The 50,000-URL cap is enforced inside each group by `chunkEntries`, so no
      file can exceed it however the catalogue grows
- [x] `robots.txt` still advertises the index, never a segment directly
- [x] 37 unit tests, **43 end-to-end checks** including the union invariant

**Why a Route Handler rather than the `sitemap.(xml|ts)` convention.** Next's
metadata route can only emit a `<urlset>`; `generateSitemaps` splits into more
`<urlset>` files, which would leave `/sitemap.xml` claiming to be a list of pages
rather than a list of sitemaps. A `<sitemapindex>` needs a different root
element, so `src/app/sitemap.xml/route.ts` serves it. The convention was checked
against the Next 16 docs before choosing.

**An empty group produces no segment and no index entry.** With no articles
published there is no `articles.xml` at all, and requesting it is a **404** — not
an empty `<urlset>`, which asserts that a collection exists and is empty. An
unknown or mistyped segment name is likewise a 404.

****Verified invariant:** the union of every segment file equals the complete set of
indexable URLs, with no URL appearing twice and no `noindex` record present. A
packaging bug that drops a URL would produce a perfectly valid sitemap that
silently de-indexes content, so this is asserted directly rather than inferred
from each file looking well-formed.

### Increment 4 — COMPLETE: SEO admin controls and guardrails

Two screens, two permissions, deliberately not merged: `/admin/seo`
(`seo.manage`) decides what is indexable; `/admin/settings` (`settings.manage`)
rewrites the site's search and social defaults.

- [x] `/admin/seo` — indexability across scholarships, articles and content
      pages at once, with per-record control and a contradiction list
- [x] `/admin/settings` — the SEO and social groups of `site_settings`
- [x] Guardrails in `src/features/seo/guardrails.ts`, applied server-side and
      explained in words when refused
- [x] Private feature switches unreachable from the settings screen
- [x] 33 unit tests, **36 end-to-end checks**

**Guardrails, as implemented.** An unpublished record cannot be made indexable —
the refusal names the actual state and says what to do about it, rather than
returning a boolean. Excluding anything is always allowed, since turning
indexing off cannot make anything worse. `noindex` and `allow_sitemap` move in
one write.

§11 also allows "an explicit override flag, which is audited" for a record that is
both no-index and sitemap-listed. **No such flag exists in this schema** and
none was invented to satisfy the sentence; a database CHECK forbids the
combination outright, and the override path is recorded here as not implemented.

### Increment 5 — COMPLETE: alt-text enforcement and the indexability sweep

- [x] Migration 030: `media_assets.is_decorative` plus the CHECK
      `is_decorative or alt_text is not null`
- [x] Upload and edit refuse an undescribed image **before** the bytes are sent
- [x] Alt-text coverage reported on the SEO overview
- [x] Indexability sweep: **85 end-to-end checks** across the whole public and
      private surface
- [x] 2 new live RLS assertions for the alt-text CHECK

**Enforcement was impossible before this migration, not merely unimplemented.**
`alt_text` was nullable and the editor was told to "leave empty only if the image
is purely decorative" — so a decorative image and a forgotten alt text were the
same `NULL`, and no constraint could distinguish them. The distinction now lives in
the database. Existing rows are backfilled to `is_decorative = true`: that is a
claim the migration cannot verify, and it is the reading that does not assert
something untrue about content nobody has described. Inventing alt text would be
fabricated accessibility copy (`AGENTS.md` §2.7).

**Honest limitation, as measured at this increment: no *content* image is
rendered on the public site.** There is no `<img>` or `next/image` for CMS media in
any public route — the OG cards are produced by `ImageResponse`, which has no alt
text. `alt_text` is therefore correct and enforced in the library and has **no
effect on a visitor's experience yet**. The featured-image picker in Phase 4 is
what puts it in front of anyone, and this constraint is the thing standing behind
it when that happens. (The brand mark in the header and footer is not CMS content
and is rendered; see "The site brand" below.)

### The sweep found two real defects

1. **Every page 2 of `/articles` canonicalised to page 1.** That tells a crawler
   everything after the first page is a duplicate, which is precisely how a
   paginated index loses its tail. Fixed: pagination is now self-canonical, while
   filters still point at the clean index — a filter is a subset of the same list,
   page 2 is a different set of records.
2. **A sorted scholarship view was `index, follow`.** `SEO_GUIDELINES.md` says
   sorted search is `noindex, follow`; four sort orders means four near-identical
   pages competing with each other and with `/scholarships`. Fixed, and the
   page-level JSON-LD is now derived from the same condition as the robots
   directive — structured data that disagrees with the page's own robots meta is
   the exact contradiction the sitemap rules exist to prevent.

Also found: `/auth/*` sent no `X-Robots-Tag`. The `(auth)` layout already emitted
the meta tag, so the page was not indexable, but the header now matches `/admin`
so the instruction survives a consumer that never parses the body.

### Known gaps in Phase 5, recorded rather than hidden

- **`rel=next` / `rel=prev` are not implemented.** Google deprecated these hints
  in 2024 and the paginated URLs are discoverable from page 1's pagination
  control; this is a deliberate omission, not an oversight.
- ~~**No `Organization.logo`** — there is no brand asset to point at.~~
  **Closed.** The operator supplied `logo-getscholarship.jpg`; the property is
  emitted and verified to resolve.
- **The Schema Markup Validator and Rich Results Test have not been run.**
- **`redirects.hit_count`** is not maintained and is not displayed.
- **`/admin/settings` covers the SEO and social groups only.** The remaining
  groups are Phase 4 work.

**Three defects were found by the end-to-end run, all of them real:**

1. **The index toggle was inverted.** With `noindex = false` the button read
   "Exclude from search" but sent `indexable = true`. A record that is already
   indexable, clicked, asked to become indexable — and a draft refused for the
   wrong reason while the database was left unchanged.
2. **A draft was labelled "indexable".** `noindex ? 'excluded' : 'indexable'` is
   false for a draft: it is not on the site at all. The label now says "not on
   the site yet".
3. **`site_settings.value_type` was never reaching the form.** The query selected
   `value_type` and the code read `valueType`, so the type rendered empty,
   `parseSettingValue('')` fell through to its string branch, and an `http://`
   address was accepted and stored in a setting declared `url`. Fixed twice
   over: the column is renamed explicitly in the query (PostgREST's `alias:column`
   is a table alias for embedded resources, not a rename, and fails with 42703),
   and **the Server Action now reads `value_type` from the row itself** — a
   client that can name the type of the column it is writing has already
   defeated the validation.

---

## The site brand

Not a roadmap phase. This is the operator-supplied brand mark, wired into the
chrome, and it closes the one gap that was a *missing input* rather than
unfinished work.

The master is the operator-supplied JPEG, accepted at
`logo-getscholarship.jpg` in the project root or, equivalently, at the
byte-identical provenance copy `public/brand/logo-getscholarship.jpg`.
`npm run brand:assets` derives from it and reports which path it used:

| Artefact | What it is | Why not the master |
| --- | --- | --- |
| `public/brand/getscholarship-mark.png` | 120×101, transparent, **mark only** | A JPEG cannot carry alpha, so the master renders as an opaque box |
| `src/app/icon.png` | 512×512, square, transparent | The mark needs to be square and centred |
| `public/brand/logo-getscholarship.jpg` | byte-for-byte copy | Provenance only; never rendered |

### The name is text, not part of the logo

The site renders `[mark] GetScholarship`, with **Get** in the normal weight (400)
and **Scholarship** extrabold (800). The supplied bitmap contains the wordmark as
pixels; using it would make the site's name unselectable, untranslatable, unreadable
by a screen reader as words, and impossible to restyle — and the name needs two
weights anyway. So only the illustration is an image.

The accessibility consequence is the important part: because the visible text *is*
the name, the mark's `alt` is **empty**. A non-empty `alt` would make the home link
announce the name twice. The link keeps `aria-label={siteName}` from settings.

`src/components/layout/brand-lockup.tsx` renders the lockup and is shared by the
header and the footer, so the two cannot drift. `src/lib/brand.ts` owns the mark's
path, intrinsic size, ratio, permitted heights, and the two halves of the name.

**The alignment requirement, measured.** The header mark occupies the **exact 32px
box** the placeholder "G" square occupied inside the `h-16` bar, rendering 38.02×32
against a natural 120×101 — ratio preserved. The footer uses 28px. A 48px ceiling
with `object-contain` means that even where the clamp binds, the mark letterboxes
rather than squashes. Verified at 320, 360, 390 and 768px: the lockup never
overflows and the mobile toggle stays on screen at all four.

**Four defects, all found by looking at the output rather than the code.** The
derived PNG kept the master's **pale blue** background, so the header drew a tinted
rectangle. The favicon was emitted **512×531, not square**, because `extend` and
`resize` chained in one sharp pipeline do not compose. Replacing the asset in place
left **stale derivatives in `.next/cache/images`**, because Next's optimizer keys
its cache by URL — the file on disk was new, the on-disk test passed, and the
browser still drew the old one. And the mark kept the **leading "G"** of the
wordmark, because two crop rules found a gap *between two letters*: letter-spacing
in the wordmark is wider than the gap between the mark and the wordmark, and an
empty column carries 2–4 ink pixels of JPEG noise, not zero. The working rule is
the first run of ≥3 columns at ≤8% coverage, with sanity checks on both sides.

**Status:** `npm run verify` exits 0 with **443 unit tests**; **35 end-to-end
checks** pass against a production build, covering the rendered geometry, the two
font weights, the name being selectable text, the empty `alt`, and the removed
lockup bitmap now 404ing. `Organization.logo` is emitted and verified to resolve.

The global brand ramp now uses the supplied mark's navy (`#183b8c`) as
`--color-brand-500`, so the interface palette matches the artwork. The mark path is
a constant, not a CMS setting. The generated assets are committed artefacts rather
than build outputs, so `.next/cache/images` must be cleared by hand after
regenerating them.

---

## Phase 6 — Advertising and analytics · **IN PROGRESS**

> Blocked on: AdSense publisher approval and a GA4 property.

- [x] Consent banner: accept all / reject optional / manage preferences
- [x] Persistent privacy settings control
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

Phase 6 started on 2026-10-18 with consent storage and the browser privacy
preferences manager. Analytics and advertising remain disabled until a real GA4
property and AdSense publisher approval/ID are supplied.

---

## Phase 7 — Quality assurance · **IN PROGRESS**

- [x] Unit tests: validation schemas, SEO helpers, sanitization, date/amount
      formatting, search parsing
- [ ] Integration tests with mocked Supabase clients
- [x] RLS policy tests against a live project
- [x] Auth and role permission tests
- [x] Search filtering and pagination tests
- [x] Editorial workflow tests
- [x] Playwright E2E for the 18 required journeys — 18 journeys across desktop
      and mobile projects, 36 checks passed
- [x] Responsive and keyboard navigation checks
- [ ] Structured data validation
- [ ] Error and edge-case handling verification
- [ ] Dependency audit review

Phase 7 started on 2026-10-18 with consent-schema and shared-slug unit coverage.
The repository now has 456 passing unit tests, 111/111 live RLS assertions, and
36/36 Playwright checks across desktop and mobile. Remaining blockers are the
full mocked integration suite, external structured-data validation, and the
dependency audit: `npm audit` reports five high-severity `braces` findings in
the pinned ESLint/Next toolchain, and `npm audit fix --force` proposes a
breaking downgrade to `eslint-config-next@14.2.35`, which requires approval.

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

