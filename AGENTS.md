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
<https://bold.org/>. The authoritative visual and UX direction — palette,
typography hierarchy, card anatomy, hero composition, section rhythm, spacing
and motion — is modelled on that site. <https://www.topuniversities.com/> is
retained as a secondary reference for higher-education tone only.

**Scope of the Bold.org reference: visual language only.** Bold.org is an
account-gated, donor-driven platform (matched student profiles, saved
scholarships, application tracking, donor profiles, rewards). GetScholarship is
an open editorial directory with invitation-only CMS access. Adopting
Bold.org's *look* does not license inventing its *features*. Matched
discovery, saved scholarships, application tracking and donor profiles are out
of scope until they exist as real, backed functionality — see §2.5 and §11.

Functional reference for the administration CMS is the existing
ipassgenerator.online project. Where a specific administrative behaviour cannot be
inspected, say so rather than guessing.

**No content image is rendered on any public page except the homepage hero
banner.** `scholarships.image_id` and `articles.featured_image_id` exist and
can now be set from the CMS (Phase 4 increment 7), but no public route renders
a content `<img>` — the OG cards come from `ImageResponse` — apart from the
homepage hero, which renders `public/hero-image.jpg` (`next/image`, priority).
Do not describe the site's *editorial* imagery as shipped.

The one exception is the brand mark in the header and footer, which is not CMS
content: `logo-getscholarship.jpg` in the project root is the operator-supplied
master, and `src/lib/brand.ts` owns the derived transparent PNG that is rendered
on every public page. That is the whole of the site's shipped imagery.

**Never copy any reference site's source code, brand identity, editorial
content, or visual assets.** Information architecture and user-journey patterns
may inform our design; original implementation, branding, copy and assets are
required.

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

- **The public site is feature-complete for Phase 3**, and **every header and
  footer link resolves**. The homepage, scholarship search, scholarship detail,
  taxonomy landings, the articles index and article detail, the contact form, the
  "report incorrect information" handler, the six static pages, the newsletter
  signup, `robots.txt`, `sitemap.xml` and Open Graph cards are all built and
  verified. The site still launches empty — see below.
- **The newsletter is built but OFF, and should stay off.** `newsletter.enabled`
  is `false` because no mail provider is configured, so nothing can be sent. The
  form's copy says so rather than promising an email. Enabling it requires both a
  provider and something worth sending.
- **The accessibility pass was mechanical, not a full WCAG 2.2 AA audit.** It
  covers heading order, landmarks, accessible names, link text, alt text,
  `aria-current`, skip-link operation, focus-indicator visibility, keyboard
  reachability and target size. It does **not** cover screen-reader output (NVDA,
  JAWS, VoiceOver), an automated colour-contrast sweep, or 2.4.11 Focus Not
  Obscured. Do not describe it as "WCAG 2.2 AA verified".
- **The newsletter admin list has no RLS behind it.** `newsletter_subscribers` is
  revoked from every client role, so it is read via the service-role client and
  `requirePermission('newsletter.manage')` is the *only* boundary. Unlike every
  other privileged read in this codebase, there is no second layer.
- **The static-page copy is a DRAFT and needs legal review before launch.** It is
  stored in `content_pages` (migration 021) and is honest about what does and does
  not exist, but it has never been reviewed by a lawyer, and there is no CMS
  editing screen for it yet.
- **The admin contact inbox supports audited deletion** (approved policy change,
  migration 036). Deletion is permission-gated, confirmation-protected and
  recorded in the audit log. The reports inbox remains status-only; do not add
  deletion there.
- **The public forms have no rate limiting.** A honeypot and a fill-time check
  reject naive scripted submitters. `UPSTASH_REDIS_REST_URL` exists in the
  environment schema; adding a Redis client needs approval (§2.10).
- **The site launches empty.** There are no scholarship records. Do not seed
  invented ones — content must come through the verified editorial workflow
  (Phase 4) or a licensed source.
- **Six `[SAMPLE]` records are loaded in the linked project** for visual review
  of the redesign (`npm run db:fixtures`). They are invented and are NOT real
  scholarships. Run `npm run db:fixtures:remove` before any launch. Never let
  them reach production, and never edit them into looking genuine.
  **One of them did reach production.** The site was launched before the
  cleanup ran, so `[SAMPLE] Award With An Application Fee` was published,
  indexable and listed in the live sitemap. It was unpublished through the
  CMS on 2026-10-21 (audited as `scholarship.status_change`,
  `published` → `draft`) and now answers `404`; the other five were already
  drafts. The rows are still in the database — unpublishing was reversible,
  deleting them was not authorised — so **the cleanup is still outstanding**
  and `npm run db:fixtures:remove` must still run before this content is
  presented as real.
- **The site is live at `https://getscholarship.online`.** The apex is the
  canonical host: it serves the site, and `www.getscholarship.online` is a
  308 redirect to it. This was reversed on 2026-10-21 — the domains had been
  configured the other way round, which meant every canonical tag, every
  `og:url`, and every `<loc>` in every sitemap pointed at a URL that
  answered `308`. If the domains are ever reconfigured, re-check that
  `NEXT_PUBLIC_SITE_URL` names the host that actually serves.
- **Four articles are published** (`what-is-a-scholarship…`,
  `complete-guide-to-hec-scholarships…`, `how-to-find-scholarships…`,
  `10-best-verified-scholarship-search-sites…`). There are still **no real
  scholarship records** — the scholarship list is empty, and the taxonomy
  landings that depended on it were dropped from the sitemap as thin pages.
  Content must arrive through the verified editorial workflow — never
  fabricated.
- **The 26 taxonomy landings are 301 redirects to `/scholarships`.** A
  taxonomy page 404s when it has no visible scholarships, by design — so with
  no scholarships every one of them did, and Google reported them as broken
  pages. Each term now redirects to the scholarship listing instead, created
  through the CMS on 2026-10-21 and audited as `redirect.create`. **They are
  placeholders: when a term gains its first scholarship the landing page comes
  back on its own (the sitemap re-adds it), so the rule for that term must be
  deleted or it will shadow a real page.**
- **One `super_admin` account now exists in the linked project**, created
  out of band with `npm run admin:create`. The transient accounts used to verify
  the media library and inbox triage were destroyed in the same session they were
  created in, following the pattern in `supabase/tests/rls-policy-tests.mjs`. The
  inboxes have now been viewed through a signed-in session — see the Verified
  section — but only with throwaway credentials, never with the real one.
- **The logo's palette does not match the theme's palette.** The supplied mark is
  navy; `--color-brand-500` in `src/app/globals.css` is `#7c3aed` (rebranded to the
  AI accent palette — see CHANGELOG). The mark is
  rendered as supplied, because recolouring someone's brand asset is not a
  decision an agent should make unilaterally. Reconciling the two needs a human
  choice: change the theme to navy, or recolour the artwork. Nothing else on the
  site was changed to match it.
- **The wordmark must track the `site.name` setting.** `src/lib/brand.ts` holds
  the two halves of the name because the brand needs them in different weights. An
  editor changing the site name in the CMS will change the footer, the copyright
  and the page titles but NOT the header lockup — that is a code change. This is
  the one place the brand is deliberately not read from the database, because the
  split is a typography decision rather than content.
- **The brand assets are build-time generated, not built by the pipeline.**
  `public/brand/getscholarship-mark.png` and `src/app/icon.png` are committed
  artefacts; `npm run brand:assets` must be re-run by hand after the master
  changes. They are derived deterministically from the master, so this is safe,
  but it is not automatic.
- **Replacing the logo requires clearing `.next/cache/images`.** Next's image
  optimizer caches derivatives keyed by URL, so overwriting the file in place
  leaves the old artwork being served until that cache is emptied. This was
  observed, not theorised: the file on disk and the page disagreed, and only some
  requested widths were stale because each width is its own cache key. Run
  `rm -rf .next/cache/images` (or `rm -rf .next`) after regenerating the assets.
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
- Phase 3 part 2 + Phase 4 increment 4: 218 unit tests; migrations 021–026
  applied to staging; `npm run test:rls` passes **86/86** live assertions. All
  seven formerly-404ing header/footer routes return 200 with real content, and
  the contact and report Server Actions were driven end-to-end with Playwright,
  confirming rows actually reach `contact_submissions` and `content_reports`.
- Phase 3 **complete**: 218 unit tests; `npm run verify` exits 0;
  `npm run test:rls` 86/86; `robots.txt` and `sitemap.xml` verified against the
  live database (including that a thin taxonomy landing is excluded and a
  `noindex` record is dropped); the OG card confirmed a real 1200×630 PNG;
  the newsletter lifecycle driven end-to-end in a browser with rows confirmed in
  `newsletter_subscribers`; **126 accessibility and 121 responsive checks pass**.
  Not covered: screen-reader output and automated contrast — see §11.
- Phase 4 increment 5 (media library): **247 unit tests**; `npm run verify` exits
  0; `npm run test:rls` **91/91**; **28 end-to-end browser checks pass against a
  production build**, including a real upload landing in `private-media`, a signed
  preview rendering, alt-text persistence, archive, and both sides of the size
  limit (6 MiB refused with a message, 4.5 MB accepted). Verified with a temporary
  `super_admin` created and destroyed in the same run, following the pattern in
  `supabase/tests/rls-policy-tests.mjs`.

- Phase 4 increment 6 (inbox triage): **279 unit tests**; `npm run verify` exits
  0; `npm run test:rls` **99/99**; **26 end-to-end browser checks pass against a
  production build and the live database**, with every triage transition
  confirmed by reading the database row back rather than by the DOM, and five
  audit rows confirmed with correct `before`/`after` and actor. Migration 028
  fixed a **fourth** "RLS policy with no table grant" defect: the contact inbox
  UPDATE policy had existed since migration 022 but no privilege ever backed it,
  so triage failed with `42501` for an administrator while the suite still
  passed 91/91. Every new denial is now paired with a positive case.
  Verified with a temporary `super_admin` created and destroyed in the same run.

- Phase 5 increment 1 (structured data): **306 unit tests**; `npm run verify`
  exits 0; **62 end-to-end checks** against a production build and the live
  database. JSON-LD on every public template (Organization, WebSite, WebPage,
  CollectionPage, BreadcrumbList, BlogPosting, Person, ItemList), with every
  builder declining to emit rather than guessing — no SearchAction, no
  page-level data on a `noindex` page, and at the time no logo, which a later
  increment supplied once a real brand asset existed. `<`/`>`/`&` are escaped on
  serialisation
  because titles and bylines are editor-controlled and `JSON.stringify` does not
  escape `<`.
  **Found and fixed:** `noindex` on a scholarship was honoured by the sitemap but
  the detail page emitted no robots meta at all, because `DETAIL_SELECT` never
  selected the column — so the record was withheld from the sitemap and
  advertised as indexable at the same time.
  **Not verified:** Schema Markup Validator and Rich Results Test have not been
  run.
- Phase 5 increment 2 (redirect manager and enforcement): **336 unit tests**;
  `npm run verify` exits 0; `npm run test:rls` **109/109**; **33 end-to-end
  checks** against a production build and the live database. The `redirects`
  table had shipped in Phase 2 with policies but **nothing read it** — a rule
  could exist and do nothing. Enforcement now runs in `src/proxy.ts` before any
  auth work, with a 15-second TTL cache read via the service-role client.
  **Migration 029 fixed the fifth "policy with no grant" defect:** migration 013
  granted INSERT/UPDATE/DELETE but omitted SELECT, so an administrator could
  write a redirect and not read one back.
  Two things were measured rather than assumed: `NextResponse.redirect` requires
  an absolute URL (a relative `Location` throws and returns 500), and
  `invalidateRedirectCache()` **cannot reach the proxy** — the proxy has its own
  module registry, so the TTL is the only bound. The admin screen states the
  delay rather than implying a save is instantly live.
  `redirects.hit_count` is **not** maintained and is deliberately not displayed.
- Phase 5 increment 3 (segmented sitemap): **373 unit tests**;
  `npm run verify` exits 0; **43 end-to-end checks**. `/sitemap.xml` is now a real
  `<sitemapindex>` split by content type (`pages`, `scholarships`, `articles`,
  `taxonomy`), served by a Route Handler because Next's metadata route can only
  emit a `<urlset>`. The 50,000-URL cap is enforced per group. An empty group
  yields no segment and requesting one is a **404, never an empty `<urlset>`**.
  Verified invariant: the union of all segments equals the full indexable set,
  with no duplicates and no `noindex` record — a dropped URL would produce a valid
  sitemap that silently de-indexes content.
- Phase 5 increment 4 (SEO admin controls): **406 unit tests**;
  `npm run verify` exits 0; **36 end-to-end checks**. `/admin/seo`
  (`seo.manage`) and `/admin/settings` (`settings.manage`) are separate screens
  on purpose — deciding what is indexable and rewriting the site's title are
  different powers. Guardrails are pure functions that refuse in words: an
  unpublished record cannot be made indexable, and `noindex`/`allow_sitemap` move
  in one write. Private feature switches (`newsletter.enabled`, `ads.enabled`,
  `site.maintenance_mode`) are unreachable from the settings screen by allowlist.
  Three defects were found end-to-end: an **inverted index toggle** whose label
  and action disagreed, a draft **mislabelled "indexable"**, and
  `site_settings.value_type` never reaching the form — which made an `http://`
  URL acceptable in a `url` setting. The action now reads `value_type` from the
  row, never from the client.
- Phase 4 increment 7 (featured-image picker): **416 unit tests**;
  `npm run verify` exits 0; **21 end-to-end checks**. `featured_image_id` and
  `image_id` had existed since Phase 2 with **no CMS control at all** — a column an
  editor cannot set is a column nobody sets. The picker is where the Phase 5
  alt-text work becomes user-facing: every thumbnail renders through the single
  `altAttributeFor`, so an empty `alt=""` for a decorative image is decided once
  and cannot drift from the public renderer. The round trip is verified explicitly
  (reopen → still selected; second save → not cleared; Remove → cleared), because
  the failure mode otherwise loses an image quietly.
- Phase 5 **COMPLETE** (increment 5): **406 unit tests**;
  `npm run verify` exits 0; `npm run test:rls` **111/111**; **85 sweep checks**.
  Migration 030 makes an image either described or explicitly decorative — the
  previous single `NULL` made enforcement impossible in principle, not merely
  unimplemented. **Honest limitation, as measured on that day: no content image
  is rendered on the public site** (no `<img>`/`next/image` for CMS media in any
  public route), so alt text affected the library and not yet a visitor. The
  sweep found two real defects: **every page 2+ of
  `/articles` canonicalised to page 1** (the classic way a paginated index loses
  its tail), and a **sorted** scholarship view was `index, follow` against a
  documented `noindex, follow` policy. `/auth/*` also gained `X-Robots-Tag`.
- Brand asset (operator-supplied logo, not a roadmap phase): **443 unit tests**;
  `npm run verify` exits 0; **35 end-to-end checks** against a production build.
  The site renders **`[mark] GetScholarship`** — the name is LIVE TEXT with `Get`
  in the normal weight (400) and `Scholarship` extrabold (800), not pixels baked
  into the logo. The master `logo-getscholarship.jpg` is read-only;
  `npm run brand:assets` derives a transparent 120×101 **mark** and a square
  favicon, and never serves the master. The header mark renders at **38×32** — the
  exact box the old placeholder `G` square occupied inside the `h-16` bar — with the
  file's ratio preserved and a 48px ceiling. Four defects were found by
  measurement, not by reading the code: **the derived PNG kept the master's pale
  blue background**; **the favicon came out 512×531, not square**, because `extend`
  and `resize` chained in one sharp pipeline do not compose; **replacing the asset
  in place left stale derivatives in `.next/cache/images`**; and **the mark kept the
  leading "G"** of the wordmark, because two crop rules found a gap *between two
  letters* — letter-spacing is wider than the mark-to-wordmark gap, and an empty
  column carries JPEG noise rather than zero ink. All four are now covered, the last
  by a test asserting the mark has no *internal* low-coverage gap. One test also had
  to be corrected: it measured the favicon with `sharp().toBuffer()`, which
  re-encodes and reported 101 KB for a 65 KB file. `Organization.logo`, which Phase 5
  deliberately withheld because a logo URL that 404s is a fabricated claim, is now
  emitted and verified to resolve.
  **Note:** the operator replaced the master *during* this work (481×130 → 527×114),
  which is why the geometry moved and why the tests assert consistency with the file
  rather than a literal size. The root master was then removed; the byte-identical
  provenance copy in `public/brand/` is accepted as an equally valid master, and the
  generation script reports which path it used rather than deciding silently.

See `docs/DEVELOPMENT_ROADMAP.md` for the authoritative status and
`docs/CHANGELOG.md` for the full record, including the security defects that
testing found and fixed in Phases 2, 2b, 4 and 5.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
