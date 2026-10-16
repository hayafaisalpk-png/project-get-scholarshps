# AGENTS.md

Permanent instructions for AI coding agents working on **GetScholarship**.

This file is authoritative for any agent (or human) modifying this repository. If
a change in this repository contradicts this document, stop and ask — this
document is updated deliberately, not accidentally.

---

## 1. What this project is

GetScholarship is a production scholarship-discovery and educational content
platform for <https://getscholarship.online>. It is a database-driven
application with a public website, a scholarship search engine, and a protected
administrative CMS.

Reference site for visual design direction only:
<https://www.topuniversities.com/>. The authoritative higher-education look —
navy/blue/white palette, typography hierarchy, generous whitespace, card and
section rhythm — is modelled on that site.

Functional reference for the administration CMS is the existing
ipassgenerator.online project. Where a specific administrative behaviour cannot
be inspected, say so rather than guessing.

**Never copy either site's source code, brand identity, editorial content, or
visual assets.** Information architecture and user-journey patterns may inform
our design; original implementation, branding, copy and assets are required.

---

## 2. Non-negotiable rules

Violating any of these invalidates the work, regardless of how good it looks.

1. **Never delete existing files, tables, records or working functionality**
   without explicit human permission. This includes "cleanup" refactors.
2. **Never run destructive database operations against production.** No
   `DROP`, `TRUNCATE`, or `DELETE` outside a development database. Never reset
   or re-seed a production project.
3. **Never expose secrets to the client.** The Supabase service-role key must
   never be in a `NEXT_PUBLIC_` variable, never be imported into a Client
   Component, and never be stored as a CMS setting. `src/lib/supabase/admin.ts`
   is the only place it may be read, and only on the server.
4. **Never bypass authentication, authorization, validation or RLS** for
   convenience — including in tests. Fix the policy or the query instead.
5. **No fake features.** No non-functional buttons, placeholder pages, dead
   links, or "coming soon" stubs presented as finished work. If something is
   not implemented, say so in the roadmap and in your report.
6. **Never claim a feature is complete unless it was implemented and verified.**
   Report actual command output, not assumptions.
7. **Never fabricate content or data.** Do not invent scholarships, award
   amounts, deadlines, sponsors, eligibility criteria or application URLs. Do
   not invent dashboard statistics, analytics figures or ad revenue. Every
   number shown to a user must come from a real database query.
8. **Do not hardcode CMS content in components.** Scholarships, articles,
   categories, navigation and settings come from the database.
9. **Do not replace the whole project when an incremental fix works.**
10. **Do not add dependencies without justification.** Check whether the
    platform already provides the capability.
11. **Do not silently change dependency versions.** If a pinned version is
    unavailable or incompatible, document the issue and request approval.
12. **Preserve accessibility, responsive design and working features** through
    every change.

---

## 3. Mandatory stack

Do not substitute these without approval.

| Concern | Technology |
| --- | --- |
| Framework | Next.js 16.4.0, App Router |
| UI | React 19, TypeScript `strict` |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth, `@supabase/ssr` cookie sessions |
| Security | PostgreSQL Row Level Security |
| Storage | Supabase Storage |
| Forms | React Hook Form + Zod |
| Rich text | TipTap |
| Icons | Lucide React |
| SEO | Next.js Metadata API, JSON-LD, sitemaps, `robots.txt` |
| Ads / analytics | Google AdSense + GA4, consent-gated |
| Tests | Vitest (unit/integration), Playwright (E2E) |
| Deploy / VCS | Vercel, Git + GitHub |

---

## 4. Next.js 16 rules (these differ from Next 15)

Getting these wrong is the most common failure mode.

- **`middleware.ts` is now `proxy.ts`.** The exported function is `proxy`, not
  `middleware`. The Edge runtime is **not** supported — `proxy` runs on Node.js.
- **`params` and `searchParams` are Promises.** Always `await props.params` /
  `await props.searchParams`. Synchronous access was removed.
- **`next lint` was removed.** Linting runs through the ESLint CLI:
  `npm run lint`. ESLint flat config only (no `.eslintrc`).
- **Turbopack is the default** for `next dev` and `next build`. A custom
  webpack config will hard-fail the build.
- **`revalidateTag` requires two arguments:** `revalidateTag(tag, 'max')`.
  In Server Actions, prefer `updateTag(tag)` for read-your-writes semantics.
- **`cacheLife` / `cacheTag` are stable** (no `unstable_` prefix).
- Parallel route slots require an explicit `default.tsx`.
- `next/image`: `qualities` defaults to `[75]`; `imageSizes` no longer includes
  `16`; local IP optimization is blocked by default.

## 5. Supabase rules

- **Server-side auth checks use `auth.getClaims()`**, never
  `auth.getSession()`. `getSession()` reads the cookie without verifying the
  JWT signature and must never gate authorization.
- The publishable key is browser-safe **only** because RLS enforces access.
- `createClient()` from `src/lib/supabase/server.ts` is request-scoped — never
  cache it in module scope.
- The `proxy` must return the response built by `setAll`, otherwise the browser
  loses the refreshed token and users appear to be randomly signed out.

---

## 6. Architecture conventions

### Server-first

Default to Server Components. Add `'use client'` only when the component needs
state, effects, event handlers, browser APIs, or a React Context provider.
Every unnecessary `'use client'` costs bundle size and Core Web Vitals.

Never pass secrets to Client Components. Next.js 16 exposes `connection()` and
the taint API for this — use them where a value is server-derived.

### Feature-first layout

```
src/app/            routes only (pages, layouts, route handlers, loading/error)
src/components/     shared UI primitives
src/features/       scholarships | articles | auth | admin  (domain logic)
src/lib/            supabase | seo | security | validation | env
src/types/          shared TypeScript types
supabase/           migrations, seed, config
tests/              unit | integration | e2e
docs/               documentation
```

Keep database access, business rules, validation, authorization and
presentation in separate layers. Route files should orchestrate, not contain
business logic.

### Design system

All colors, spacing, radii and shadows are Tailwind v4 `@theme` tokens in
`src/app/globals.css`. Use semantic tokens (`bg-brand-600`, `text-ink-700`).
Never hardcode hex values in components.

---

## 7. Before writing code

1. Read the relevant existing code first. Never assume it does not exist.
2. Check `docs/DEVELOPMENT_ROADMAP.md` for the current phase and status.
3. Read the relevant documents in `docs/` (`SECURITY_POLICY.md`,
   `DATABASE_SCHEMA.md`, `SEO_GUIDELINES.md`).
4. State the plan briefly, then implement in small verifiable increments.
5. Run `npm run verify` (typecheck → lint → test → build) before reporting done.
6. Update `docs/CHANGELOG.md` and the roadmap with actual results.

---

## 8. Quality gates

A change is not complete until all of these pass:

```bash
npm run typecheck    # tsc --noEmit, strict
npm run lint         # ESLint CLI, zero errors
npm run test         # Vitest
npm run build        # production build, no type errors
```

Additional rules:

- TypeScript `strict` plus `noUncheckedIndexedAccess`. No `any`, no non-null
  assertions to silence the compiler.
- Every Server Action and Route Handler validates input with a Zod schema.
- Every privileged mutation performs an explicit server-side authorization
  check. Hiding a UI control is not authorization.
- Accessibility target is **WCAG 2.2 AA**: semantic HTML, correct heading order,
  labelled inputs, keyboard-operable dialogs and menus, visible focus,
  sufficient contrast, `aria-live` for async status.
- Rich text is sanitized **server-side** before storage and before render.

---

## 9. Database changes

- All schema changes are version-controlled SQL files in
  `supabase/migrations/`. Never edit the live schema by hand.
- Every migration must be idempotent-ish and safe to run on staging.
- Enable RLS on every table that is exposed through the Data API. A table with
  RLS disabled is a vulnerability, not a shortcut.
- Add indexes for columns used in `WHERE`, `ORDER BY` and joins on hot paths.
- Add `created_at` / `updated_at` to every table.
- Seed data must be safe: no destructive statements, clearly scoped to
  development.
- Document relationship and index changes in `docs/DATABASE_SCHEMA.md`.

---

## 10. Reporting

When finishing a task, report honestly:

- **Completed** — what was implemented and how it was verified (actual command
  output).
- **Remaining** — what is still pending, tracked in the roadmap.
- **Blockers** — missing credentials, unavailable services, decisions that need
  human approval.

Never report success for anything you did not actually run or observe. If a
service is not configured, say so and describe what configuration is required.

---

## 11. Known environment gaps

These are **not** implemented yet and must not be reported as working:

- **Part of the public site does not exist yet.** The homepage, scholarship
  search, scholarship detail and taxonomy landing pages are built and verified.
  Articles, the static informational pages (About, Contact, Help, Privacy,
  Terms, Editorial Standards), the "report incorrect information" handler, the
  newsletter form, robots.txt and the sitemap do not. The header and footer
  already link to the static pages, so those links currently 404.
- **The site launches empty.** There are no scholarship records. Do not seed
  invented ones — content must come through the verified editorial workflow
  (Phase 4) or a licensed source.
- **No scholarship or article content exists.** The database contains only
  reference data (roles, permissions, taxonomy, settings, navigation). Content
  must arrive through the verified editorial workflow — never fabricated.
- **No user account exists in the database.** All RLS test identities were
  removed after testing. The first real administrator is created in Phase 4.
- No AdSense or GA4 property exists (Phase 6).
- No Content-Security-Policy is deployed; it is deferred to Phase 7 because it
  cannot be finalised before the ad and analytics origins are known.

### Verified

- Phase 1: `npm run verify` passes (typecheck, lint, test, build).
- Phase 2: 19 migrations applied to staging; RLS on 38/38 tables;
  `npm run test:rls` passes 66/66 live assertions.
- Phase 2b: 69 unit tests; `npm run verify` clean; scholarship search and
  authorization verified end-to-end through the real Next.js request path.
- Phase 3 part 1: 95 unit tests; homepage, search, detail and taxonomy landing
  pages verified against the live database, including correct 404 status codes.

See `docs/DEVELOPMENT_ROADMAP.md` for the authoritative status and
`docs/CHANGELOG.md` for the full record, including the security defects that
testing found and fixed in Phases 2 and 2b.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
