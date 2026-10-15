# Changelog

All notable changes to GetScholarship are recorded here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.
A change is only recorded as **done** when it was actually implemented and
verified by running the relevant command.

---

## [Unreleased]

Next up: Phase 2b — the application data-access layer (typed query helpers and
server-side authorization). See `docs/DEVELOPMENT_ROADMAP.md`.

---

## [0.2.0] — 2026-10-15

Phase 2: database schema, Row Level Security, storage, seed data, and a live
RLS policy test suite.

### Added

- 14 version-controlled migrations in `supabase/migrations/`, applied to the
  Supabase staging project `whpozrnyressiznzdhpc` (PostgreSQL 17.11).
- 38 tables: identity and roles, taxonomy, media, scholarships, articles,
  platform configuration, audit logging.
- RLS enabled on **38/38** tables, with `FORCE ROW LEVEL SECURITY` additionally
  applied to the six highest-risk tables (articles, scholarships, profiles,
  audit_logs, newsletter_subscribers, contact_submissions).
- Two Supabase Storage buckets (`public-media`, `private-media`), restricted to
  image MIME types with a 5 MB cap, with uploader/manager-scoped policies.
- Weighted `tsvector` generated column on `scholarships` and `articles` with
  GIN indexes. Verified: a title match ranks above a body match, and the GIN
  index is used (`Bitmap Index Scan`) rather than a sequential scan.
- `supabase/seed.sql` — idempotent, contains no `DELETE`/`TRUNCATE`/`DROP`,
  and **no fabricated scholarship records**. Seeds 6 roles, 22 permissions,
  taxonomy, 14 homepage sections, 19 settings, navigation, 5 ad placements
  (all disabled) and 1 author byline.
- `supabase/tests/rls-policy-tests.mjs` — 59 live assertions across five
  identities (anonymous, student, author, reviewer, super_admin). Run with
  `npm run test:rls`. Self-cleaning.

### Security: three vulnerabilities found and fixed

Testing found real defects. All three were fixed by corrective migrations, not
by editing already-applied ones.

**1. Author privilege escalation (`012_fix_article_permission_model.sql`)** — HIGH

`article.manage` was used in the `articles` UPDATE policy as the "may edit any
article in any status" branch, but was **also granted to the `author` and
`reviewer` roles**. The first branch short-circuited, so an author could:

- publish their own draft, bypassing review entirely, and
- modify another author's draft.

Fixed by splitting the capability into `article.create`, `article.edit_own`,
`article.manage`, `article.publish` and `article.review`, and making the author
branch additionally require ownership **and** a resulting status of
`draft`/`in_review` — so self-publishing is impossible even if the grant were
widened again.

**2. Blanket client privileges including TRUNCATE (`013_tighten_privileges.sql`)** — HIGH

Supabase applies `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
authenticated`. Every table created by our migrations therefore inherited
INSERT/UPDATE/DELETE/**TRUNCATE**/TRIGGER for `anon` and `authenticated`.
Migration 010 only *added* `GRANT SELECT`; it never revoked the inherited
privileges.

RLS happened to block the row-level operations, which is why the first policy
test run still passed — but **RLS does not filter `TRUNCATE`**. No policy can
protect a table from a TRUNCATE granted at the table level. Any future migration
that accidentally disabled RLS on one table would have exposed full write access
to the public publishable key.

Fixed by revoking everything from both client roles, revoking the default
privileges so future tables do not re-inherit them, and then granting the
minimum each role needs. Migration 013 ends with a sanity check that raises an
exception if any `TRUNCATE`, `TRIGGER` or `REFERENCES` privilege remains.

Verified: `anon` now holds only `SELECT`, plus `INSERT` on exactly two tables
(`content_reports`, `consent_records`).

**3. Missing `SELECT` on profiles (`014_restore_profile_select.sql`)** — LOW

Migration 013 granted `UPDATE` on `profiles` but omitted `SELECT`, so after the
blanket revoke a signed-in user could no longer read their own profile. Caught
by the test suite and fixed immediately.

Worth recording: the accompanying "cannot read another profile" assertion
*passed for the wrong reason* — the denial came from a missing table privilege
rather than the intended per-row policy.

### Fixed

- **`20260101000001`**: the authorization helpers originally lived in the same
  migration as the extensions, but they query `user_roles`/`roles`, which did not
  exist yet. SQL function bodies are validated at creation, so this failed.
  Moved to `004`.
- **`20260101000008`**: `record_article_revision()` ran as the invoking user with
  no INSERT policy on `article_revisions`, so *every article update would have
  failed*. Made it `SECURITY DEFINER`.
- **`20260101000007`**: `scholarship_is_expired()` and
  `scholarship_days_remaining()` were declared `IMMUTABLE` but read
  `current_date`. Corrected to `STABLE`.
- **`20260101000008`**: `articles_published_complete` used `now()` in a CHECK
  constraint. CHECK constraints are evaluated only on write, so a time-based
  predicate there is misleading and couples writes to the clock. Visibility for
  scheduled content is now handled at read time by `article_is_public()`.
- **`20260101000010`**: the consent read policy parsed a JWT claim
  (`visitor_id`) that is never present. Replaced with CMS-only reads.
- **`20260101000010`**: article join tables were writable by any author on any
  article. Restricted to the author's own unpublished articles.
- **`20260101000011`**: `owner_id::text = auth.uid()::text` so the policy works
  whether `storage.objects.owner_id` is `uuid` or `text`.

### Test methodology note

Three assertions initially reported as failures were **false positives in the
tests, not the policies**:

- PostgREST returns `204` when RLS filters a row out and zero rows matched. A
  blocked `UPDATE` therefore returns `204`, not `403`.
- Read-back verification was performed with the same identity under test, or
  anonymously. An author legitimately cannot read their own draft
  *anonymously*, so reading back anonymously returned `[]` and made a correct
  "can edit" look like a failure.

The suite now verifies **resulting data state using the service role as ground
truth**, never a status code. This is documented at the top of the test file,
because asserting on status codes alone would let real regressions through.

### Verification

```
Migrations applied:   14/14 (first run: 11/11, zero errors)
RLS enabled:          38/38 tables
anon write privileges: INSERT on content_reports + consent_records only
anon TRUNCATE/TRIGGER/REFERENCES: none
Private tables client access: none
Full-text search:     ranked correctly, GIN index used
RLS policy suite:     59 passed, 0 failed
Database state:       0 scholarships, 0 articles, 0 profiles, 0 auth users
```

---

## [0.1.0] — 2026-10-15

Phase 1: repository audit and project foundation.

### Added

**Project scaffolding**
- Next.js 16.4.0 with App Router and Turbopack.
- React 19.3.1, TypeScript 5.9.3 (`strict` plus `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`).
- Tailwind CSS 4.3.3 configured CSS-first (no `tailwind.config.js`).
- ESLint 10.12.0 flat config via `eslint-config-next@16.4.0`.
  `next lint` no longer exists in Next 16, so linting runs through the CLI.
- Vitest 5.0.5 (jsdom) for unit and integration tests.
- Playwright 1.64.1 for end-to-end tests, with desktop-Chrome and Pixel 7
  projects.
- Git repository initialised on `main`.

**Design system**
- `src/app/globals.css` defining Tailwind v4 `@theme` tokens: brand blue,
  accent green, deadline amber, ink neutrals, semantic surfaces, radii,
  elevation shadows and motion easing.
- Base layer: visible focus rings, reduced-motion support, semantic typography,
  skip-link utility.
- Component layer: `.container-page`, `.prose-editorial`.
- Utility layer: `.no-scrollbar`.

**Supabase integration (structure only)**
- `src/lib/supabase/client.ts` — browser client, publishable key only.
- `src/lib/supabase/server.ts` — request-scoped server client with cookie
  handling; Server Component cookie-write limitation handled per Supabase
  guidance.
- `src/lib/supabase/admin.ts` — service-role client, server-only, throws
  rather than silently falling back to the publishable key.
- `src/proxy.ts` — Next 16 `proxy` convention (replaces `middleware`); refreshes
  the session via `auth.getClaims()` and returns the response carrying refreshed
  cookies with no-store cache headers.

**Configuration**
- `src/lib/env.ts` — Zod-validated environment access with separate public and
  server schemas, plus site-URL helpers. Fails loudly with actionable messages.
- `next.config.ts` — security headers (HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), `noindex` and
  `no-store` on `/admin` and `/auth`, restricted `next/image` remote patterns.
- `.env.example` — full variable reference containing no secrets.
- `.gitignore` — excludes all real environment files and local tooling state.

**Documentation**
- `AGENTS.md`, `docs/PROJECT_OVERVIEW.md`, `docs/SYSTEM_ARCHITECTURE.md`,
  `docs/DATABASE_SCHEMA.md`, `docs/SECURITY_POLICY.md`,
  `docs/SEO_GUIDELINES.md`, `docs/DEVELOPMENT_ROADMAP.md`,
  `docs/DEPLOYMENT_GUIDE.md`, `docs/CHANGELOG.md`.

### Fixed

- `src/proxy.ts`: `createServerClient` returns a Supabase client, not a
  `NextResponse`. The upstream Supabase documentation snippet assigns it to
  `supabaseResponse`, which is incorrect; this implementation uses a separate
  `supabase` binding and returns the response built by `setAll`. Without this,
  refreshed tokens would be dropped and users would be signed out at random.

### Decisions

- **TypeScript pinned to 5.9.3**, not the current 7.x release line, because
  TypeScript 7's ecosystem support (notably Next.js type generation) is not yet
  established. The specification required `strict` mode but did not pin a
  TypeScript version. To be revisited.
- **Next.js pinned to exactly 16.4.0** as specified. 16.4.1 is available; moving
  to it requires approval.
- **ESLint 10** rather than 9, matching the flat-config direction of Next 16.
- **CSS-first Tailwind v4** — design tokens live in `@theme`, not a JS config.
- **Next.js 16 constraints applied**: `proxy.ts` instead of `middleware.ts`;
  `params`/`searchParams` are Promises; ESLint CLI instead of `next lint`;
  Turbopack by default.

### Verification

```
npm run typecheck   →  clean
npm run lint        →  0 errors, 0 warnings
npm run test        →  3 passed (1 file)
npm run build       →  compiled successfully, 3 static pages, proxy registered
```

### Known limitations

- **No Supabase project is provisioned.** The Supabase clients compile and are
  structurally correct but have never been exercised against a live project.
- `.env.local` on the maintainer's machine holds placeholder, non-functional
  values so that the build can run.
- No database migrations exist yet (Phase 2).
- `src/app/page.tsx` is an explicit placeholder, replaced in Phase 3.
- No authentication UI, no admin, no search, no SEO routes beyond base metadata.
- Nothing has been deployed.
