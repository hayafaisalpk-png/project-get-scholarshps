# Changelog

All notable changes to GetScholarship are recorded here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.
A change is only recorded as **done** when it was actually implemented and
verified by running the relevant command.

---

## [Unreleased]

### Changed — Homepage hero search controls

- Set the hero search field and “Search scholarships” button to use 16px
  padding, while preserving the field’s icon offset.

### Changed — Header sign-in affordance

- Updated the header sign-in button to use the semantic brand color ramp on
  desktop and mobile.
- Reset the global brand ramp from violet to the supplied logo's navy palette.
- Matched the top-navigation sign-in button to the scholarship “View details”
  button color scheme.
- Changed shared button labels from semibold to normal weight.
- Renamed the header “Help” navigation item to “How To Search” while keeping
  the existing `/help` destination.
- Renamed the About page heading from “About GetScholarship” to “About Us”.
- Added live unread counts to the admin sidebar for Messages and Reported issues.
- Converted the admin Messages inbox to a data table with subject, email copy
  controls, date and triage actions. Message deletion was initially unavailable
  by design so public correspondence stayed on record.
- Added a separate From column and removed message-body previews from the table.
- Removed the inline status text beneath each subject; status remains available
  through the action controls.
- Aligned contact message action buttons horizontally within the table Action
  column.
- Set equal 5px top and bottom padding on contact message data rows.
- Adjusted contact message data rows to 10px top and 5px bottom padding.
- Set contact message data rows to 15px top and 5px bottom padding.
- Added a subtle hover highlight to contact message data rows.
- Added server-backed sorting controls to the From, Subject, Email and Date
  columns in the Messages table.
- Changed the approved inbox policy to allow authorized administrators to delete
  contact messages with confirmation and an audit-log entry.
- Removed the Spam action button from contact message rows; Delete is now the
  available destructive action.
- Centered the Action column heading and its buttons within the column.
- Set the From and Subject column text to normal font weight.
- Made message rows open an accessible modal with the complete message when
  clicked, while keeping row controls independently operable.
- Added a blurred backdrop to the full-message modal overlay.
- Increased the full-message modal dimensions by roughly 50% for easier reading.
- Reduced the modal dimensions by 25% for a more compact reading window.
- Restructured the message modal with a subject header, close icon, date, sender
  details and separated full-message body. WhatsApp is not displayed because it
  is not collected by the contact schema.
- Added an email copy icon beside the email address in the message modal.
- Added an optional WhatsApp No. field after the email field on the contact form,
  with server validation, storage and display in the admin message modal.
- Removed the WhatsApp field helper text from the public contact form.
- Renamed the modal detail label from “WhatsApp No.” to “WhatsApp”.
- Replaced modal sender-detail colons with vertical separators between labels and values.
- Set message subjects to uppercase with normal font weight in the table and modal.
- Moved the modal date into the sender details after WhatsApp and formatted it as
  `DD/MM/YYYY`.
- Restored subjects to their original casing with semibold styling in the table
  and modal.
- Added a persisted read state: opening a message marks it as read, removes it
  from the unread sidebar count and displays “Marked as Read” in the modal.
- Read message subjects now use normal weight in the data table; unread subjects
  remain semibold.
- Refreshed the admin layout after reading a message so the sidebar unread count
  updates immediately.
- Updated the Messages page New count to exclude messages already marked as read.

### Added — Phase 7 QA foundation

- Added unit coverage for consent input validation and taxonomy slug generation.
- Added 18 public Playwright smoke journeys, exercised in desktop and mobile
  projects: 36/36 checks passed.
- The suite now contains 456 passing tests; live RLS verification remains
  111/111.

### Added — Phase 6 consent foundation

- Added an accept/reject/manage consent banner with persistent browser
  preferences and a footer privacy-settings control.
- Consent choices are validated server-side and recorded in the existing
  pseudonymous `consent_records` table; no IP address or fingerprint is stored.
- Analytics and advertising scripts remain disabled until real provider IDs and
  approval are configured.

### Added — Phase 4 editorial workflow completion

- Added debounced article draft autosave, a permission-gated saved-content
  preview, review decision UI, review history, and audited review transitions.
- Added bounded scholarship bulk lifecycle actions with publish guardrails,
  restore support, and explicit verification controls gated by
  `scholarship.verify`.
- `npm run typecheck`, `npm run lint`, `npm test` (449 tests), and
  `npm run build` pass.

### Added — homepage hero banner image

The homepage hero now renders `public/hero-image.jpg` (1584x672) full-width as a
banner with the search-first content (heading, subheading, search form) overlaid
and centred on it via `next/image` (priority, responsive) plus a readability
overlay. This is the first content image rendered on a public page; the AGENTS.md
"no content image" note was updated to record the exception.

### Changed — global font size reduced by 10%

Global text scale reduced from 1.25x to 1.125x (a 10% reduction from the
previous 25% increase). Tailwind `@theme` text scale and line-heights, CSS-level
font sizes, body font-size, brand-name tokens/scale, hero heading/subheading
overrides and OG card font sizes all scaled by 0.9. Relative relationships
preserved.

### Added — user management on the admin dashboard

Removed the "Recent activity" section from `/admin` and replaced the "Users"
count card with a Users table (email, name, roles, status, created) with per-row
"Reset password" (generates a recovery link via the service-role client, since
no mail provider is configured) and "Delete" (service-role delete, refuses
self-deletion) actions. Gated by `user.manage`. New `src/features/users/`
module (queries, server actions, table component).

### Added — media library archived filter

`/admin/media` now has an Active/Archived/All toggle (query param `archived`),
backed by `listMediaAssets` accepting an `archived` filter. Archived rows are
isolated on demand rather than always mixed in.

### Added — audit log viewer

`/admin/audit` lists `audit_logs` paginated (newest first), gated by
`audit.view`; nav entry moved from planned to active.

### Added — content-page editor in the CMS

`/admin/content-pages` lists all static pages; `/admin/content-pages/[slug]`
edits title, excerpt, body, status and SEO fields. Gated by `settings.manage`,
writes through the session client (RLS). Nav entry added.

### Added — user and role management on the admin dashboard

The Users table now lists each account's roles as removable chips and an
"Assign role..." dropdown (all roles from `roles`). Server Actions gated by
`role.manage` insert/delete `user_roles` through the session client (RLS).
Migration 031 adds the missing INSERT/DELETE policies on `user_roles`.

### Changed — slug auto-generation for scholarships and articles

The scholarship and article Server Actions now auto-generate a slug from the
title when the editor leaves the slug field empty, so a record can be saved
without manually typing a URL slug. The client forms already suggested one;
this makes the server authoritative.

### Added — taxonomy editor in the CMS

`/admin/taxonomy` manages categories, tags, education levels, academic fields
and locations (list + add + delete), gated by `taxonomy.manage`.

### Changed — "GetScholarship" wordmark reduced by 15%

The brand wordmark text ("GetScholarship") reduced by 15% relative to its
post-global-increase size, in the public header/footer, admin sidebar, and OG
card. `BRAND_NAME_SCALE` updated from 1.625 to 1.38125; OG card
"GetScholarship" font size 38 -> 32. Other text unaffected.

### Changed — global font size increased by 25%

All text sizes increased by ~25% for readability/accessibility via a centralized
typography system: the Tailwind `@theme` text scale (`--text-xs`..`--text-9xl`)
and `--text-brand-name-*` tokens in `src/app/globals.css` were scaled by 1.25,
CSS-level font sizes (prose-editorial, eyebrow, skip-link, figcaption, tables)
and the hero heading arbitrary values were scaled, body font-size set to
`--text-base`, and OG card font sizes scaled. Brand name scale updated from 1.3x
to 1.625x (1.3 x 1.25). Root font-size left at 16px so spacing, radii and
icons are not scaled. `npm run verify` passes.

### Changed — core brand & accent palette rebranded to the AI accent palette

The design tokens in `src/app/globals.css` (`@theme`) were updated to the
"Core Brand & Accent Palette":

- `brand` ramp now centres on `#7C3AED` (AI Purple / Violet, violet-600) —
  primary brand elements, AI buttons, gradient stops.
- `accent` ramp now centres on `#10B981` (AI Success / Applied, emerald-500) —
  verified/published/accepted states.
- `highlight` ramp now centres on `#F59E0B` (AI Warning / Notice, amber-500) —
  deadlines, security alerts, high-tokens warnings.
- New `cyan` ramp added, centred on `#00F0FF` (Primary AI Accent, cyan-400) —
  active AI badges, cursor glow, highlight outlines.
- New `sky` ramp added, centred on `#38BDF8` (Inline AI Suggestion, sky-400) —
  ghost text / inline autocomplete suggestions.

`--shadow-focus` and the hero gradient's light stop were updated to follow the new
brand/sky colours. Components reference semantic tokens, so the rebrand propagates
without component edits. `npm run verify` passes (typecheck, lint, test, build).

### Changed — the brand is now `[mark] GetScholarship`: the name is text, not a picture

The supplied `logo-getscholarship.jpg` is a single bitmap containing **both** the
cap-and-scroll illustration and the "GetScholarship" wordmark. Rendering that
bitmap made the site's name unselectable, untranslatable, unreadable by a screen
reader as words, and impossible to restyle — and the name needs two weights anyway.
So the lockup was dropped and replaced by a mark plus live text:

```
[mark] GetScholarship        "Get" normal (400) · "Scholarship" extrabold (800)
```

`public/brand/getscholarship-logo.png` (the full lockup) is **removed**; the site
now renders `public/brand/getscholarship-mark.png` (120×101) beside real text.
Header name is 18px, footer 16px, matching the boxes the old placeholder occupied.

**The consequence for accessibility is the important part.** Because the visible
text *is* the name, the mark's `alt` is empty. `alt="GetScholarship"` would make
the home link announce "GetScholarship GetScholarship" — once from the image and
once from the text beside it. The link keeps `aria-label={siteName}` from settings.

`src/components/layout/brand-lockup.tsx` is a Server Component used by both the
header and the footer, so the two cannot drift apart, and `src/lib/brand.ts` owns
the geometry, the mark's intrinsic size and the two halves of the name.

### Added — the site brand: the supplied logo is now live, fitted and transparent

The project had **no brand asset at all**. `public/` was empty, the header and
footer both rendered a placeholder purple square containing the letter "G", and
Phase 5 increment 1 had deliberately omitted `Organization.logo` because pointing
at a logo that 404s is a fabricated claim about the publisher. The operator has
since supplied `logo-getscholarship.jpg` — a navy cap-and-scroll mark beside the
"GetScholarship" wordmark, on a very pale blue-grey background.

**The master is never modified and never rendered.** It stays in the project root
as read-only input. `npm run brand:assets` (`scripts/generate-brand-assets.mjs`)
derives things from it: a byte-for-byte copy at
`public/brand/logo-getscholarship.jpg` for provenance, the transparent mark the
site renders, and a square favicon. Regeneration is deterministic, so the artefacts
can be committed.

**Why the mark is not the JPEG.** A JPEG cannot carry an alpha channel, so
rendering the master into the chrome would draw an opaque rectangle that reads as
a box on any surface that is not the same pale tint.

**Fitting it to the existing height and width.** The header mark is 32px — the
exact box the placeholder `G` square occupied inside the `h-16` bar, so the bar's
height and vertical rhythm are unchanged; the footer uses 28px, the box its
placeholder occupied. `width: auto` takes the width from the file's own ratio, so
the mark can never be stretched. A 48px ceiling, paired with `object-contain`,
means that even if the clamp binds on a very narrow screen the mark letterboxes
rather than squashes. All of this geometry lives in `src/lib/brand.ts`.

`Organization.logo` is now emitted as an `ImageObject` with the intrinsic size,
and `Organization.image` points at the same file. The gap recorded in Phase 5
increment 1 is closed. It points at the **mark**, not the wordmark: a consumer wants
an identifier for the organisation, and baking the name in would mean re-cropping
the asset whenever the name changed.

**Four defects found by measuring the output rather than reading the code.**

1. **The derived PNG kept the master's pale blue background.** Trimming removed
   the outer margin but nothing else, and the header rendered a visible tinted
   rectangle. The background is *not* white, so trimming against white cannot
   remove it. Fixed by sampling the corner colour and ramping every pixel's alpha
   by its distance from it — a ramp rather than a hard cut, because the mark's
   edge pixels are anti-aliased mixes of navy and background and a single
   threshold either leaves a halo or chews the artwork.
2. **The favicon was emitted at 512×531, not square.** `extend` and `resize`
   chained in one sharp pipeline do not compose. Both operations now run as
   separate awaited steps, and the favicon is built from the *transparent* artwork
   rather than the master — which also fixed it having inherited the opaque
   background. Written as an 8-bit palette PNG it is 65 KB rather than 261 KB.
3. **Replacing the asset in place left stale artwork being served.** Next's image
   optimizer caches derivatives keyed by URL, so overwriting the file did not
   change what the page displayed. The file on disk was the new logo, the unit test
   reading that file passed, and the browser still drew the old one — and only for
   the widths already cached, since each width is its own cache key.
   `.next/cache/images` must be cleared after regenerating.
4. **The mark kept the leading "G" of the wordmark.** Three crop rules were tried
   and the first two were wrong in ways only the rendered image exposed: "the first
   fully-blank column" and "the widest run of blank columns" both found a gap
   *between two letters*, because letter-spacing there is wider than the gap
   between the mark and the wordmark. Both assumed an empty column has zero ink,
   and it does not — JPEG noise and the alpha ramp leave 2–4 ink pixels in a
   genuinely empty column, while a letter stroke carries 15–30 and the cap 70–90.
   The working rule is the first run of at least 3 columns at **≤8% coverage**,
   with sanity checks that ink exists on both sides of the gap and that the crop is
   between 15% and 60% of the lockup width. The script now exits with an error
   rather than guessing if those checks fail.

Defects 1, 2 and 4 are now covered by unit tests that read the generated files'
pixels. The internal-gap test is the important one: two pieces of artwork have
low-coverage columns *between* them and a single mark does not, so an attached
fragment is detectable without eyeballing.

**The operator replaced the master during this work** (481×130, then 527×114), and
that is visible in the record rather than smoothed over. It changed the derived
geometry and made the original width ceiling bind at desktop. It also prompted a
change to the tests: they now assert that `src/lib/brand.ts` matches the file on
disk rather than hardcoding a pixel count, because a literal would only ever assert
that nobody had ever updated the logo.

**One measurement bug worth recording.** The favicon size assertion read
`sharp(file).toBuffer()`, which **re-encodes** the image and reported 101 KB for a
65 KB palette file, because re-encoding drops it back to full-colour RGBA. It now
`stat`s the file. A test that measures the wrong thing is worse than no test: it
reports a confident number that is simply not the number anyone cares about.

**Verified:** `npm run verify` exits 0 — **443 unit tests** across 19 files,
typecheck, lint and production build clean. **35 end-to-end checks** against a
production build confirm the lockup: the mark renders at 38.02×32 in the header and
33.27×28 in the footer against a natural 120×101 with the ratio preserved; the
header bar row is still exactly 64px; the name is live text reading exactly
"GetScholarship"; `Get` computes to weight 400 and `Scholarship` to 800; selecting
the name returns "GetScholarship" (proving it is text, not pixels); the mark's
`alt` is empty so the name is not announced twice; the lockup fits at 320, 360, 390
and 768px with the mobile toggle on screen at all four; and the removed lockup
bitmap now returns **404**. No schema, RLS or migration change, so the live RLS
suite was not re-run — it stands at 111/111 from Phase 5.

**Not done, deliberately:** the mark is navy while `--color-brand-500` is
`#5d57fb`. The artwork was rendered exactly as supplied; reconciling the two
palettes is a human decision. The logo path is a constant rather than a CMS
setting, and the generated assets are committed rather than produced by the build.

**Also noted, since it happened mid-task:** the root master
`logo-getscholarship.jpg` was removed from the project root after the assets had
been generated, by something outside this work. The byte-identical provenance copy
at `public/brand/logo-getscholarship.jpg` survives, and `npm run brand:assets` now
accepts either path — announcing in its output which one it used, because silently
promoting a derived artefact back to "the master" is the sort of thing that goes
unnoticed until someone edits the wrong file.

### Added — inbox triage (Phase 4, increment 6): both admin inboxes can be worked

`/admin/contact` and `/admin/reports` were read-only. The tables had granted
UPDATE to the same permission that grants SELECT, but no action existed, so no
control was rendered — the honest-gap position recorded in increment 4. They now
support the status changes their schema was designed for.

**Messages** (`setContactStatusAction`, requires `contact.manage`) move between
`new`, `in_progress`, `resolved` and `spam`. `new` is deliberately not offered as
a destination: it is the arrival state, and "move this back to new" is not a
decision anyone makes while triaging. `resolved` stamps `handled_by` and
`handled_at`; any other status clears both, because a timestamp claiming someone
handled a message they did not handle is worse than no timestamp.

**Reports** (`setReportStatusAction`, requires `report.manage`) move between
`open`, `reviewing`, `resolved` and `dismissed`. Closing one **requires** a
written note. A correction that leaves no record of the correction is not an
auditable correction, so the note is stored in `resolution_note` alongside
`resolved_at`, and reopening clears all three together — carrying a note onto a
reopened report would assert a correction that has been undone.

The transition rules live in `src/lib/validation/inbox.ts`, pure and
framework-free, because they encode the database CHECK
`content_reports_resolved_consistent`:

```sql
check ((status in ('resolved','dismissed')) = (resolved_at is not null))
```

Setting a closed status without `resolved_at` fails the whole UPDATE with
`23514`. `buildReportStatusPatch` writes both fields together so that cannot
happen from the action, and a unit test restates the CHECK as an assertion so a
future edit fails there rather than in production.

Neither table gains a DELETE. Correspondence with a member of the public and a
visitor's correction report both stay on the record.

**The report note is a labelled textarea revealed on demand**, and an empty
submission is refused before it reaches the server as well as by the server.
Outcomes are announced through `aria-live`; "Spam" takes a two-step inline
confirmation because it is the target most likely to be reached for by mistake.

### Fixed — `contact_submissions` UPDATE policy was unreachable dead code

Found by the new live assertions, and the **fourth** instance of the same defect
class after migrations 022, 023 and 024: **a Row Level Security POLICY with no
underlying table GRANT.**

Migration 022 created `contact_submissions_update_cms` and its own header comment
states the intent — "Granting UPDATE lets staff mark a message in_progress or
resolved". But migration 013 had revoked every privilege from `authenticated`, and
migration 023 restored only SELECT. No migration ever granted UPDATE.
PostgreSQL checks the privilege before the policy, so an administrator holding
`contact.manage` was refused with HTTP 403 / `42501` before the policy was ever
consulted:

```
FAIL  admin (contact.manage) CAN resolve a message and record the handler
      <- status=403 row={"status":"new","handled_at":null,"handled_by":null}
```

Migration 028 grants UPDATE to `authenticated` (never `anon`) and asserts, via
`has_table_privilege`, that both SELECT and UPDATE are present. It also asserts
the policy still exists — a grant without a policy would be unrestricted.

Worth stating plainly: **the existing suite passed 91/91 while this was broken.**
Every `contact_submissions` assertion was a SELECT or a "cannot", and the
"author CANNOT triage" denial passed *for the wrong reason* — the author was
refused by the missing GRANT, not by the policy. A test that cannot distinguish
"denied for the right reason" from "denied because the feature is entirely
unreachable" is not testing the boundary. Each new denial is now paired with a
positive case for the permitted identity, and denials are verified by reading the
row back rather than trusting a status code.

A second, smaller bug was fixed in the same migration's first draft: its
self-check consulted `information_schema.role_table_grants`, which only reveals
grants the *current* role may see. Migrations do not run as a member of
`authenticated`, so the view reported a grant that had just been made as absent
and the migration failed. `pg_catalog.has_table_privilege` asks the question
directly.

### Verified — increment 6

- `npm run verify` exits 0 (typecheck, lint, **279 unit tests**, build).
- `npm run test:rls` — **99 passed, 0 failed**, up from 91. Eight new live
  assertions: triage UPDATE is refused for an author and accepted for a
  permitted role on both tables, a half-closed report is rejected by the CHECK,
  and reopening clears the resolution columns.
- **26 end-to-end browser checks pass** against a production build and the live
  database: both public forms filed for real, sign-in, each triage transition
  confirmed by **reading the database row back** rather than by the DOM, the
  spam confirmation step, the empty-note refusal, the stored resolution note
  rendered back, and both status filters. Five audit rows were confirmed with
  correct `before`/`after` and actor. The temporary `super_admin` used for the
  run was created and destroyed in the same session, following the pattern in
  `supabase/tests/rls-policy-tests.mjs`.

### Added — JSON-LD structured data across every public template (Phase 5, increment 1)

The site emitted **no structured data at all**. There is now a schema.org graph
on every public page, built by pure functions in `src/lib/structured-data.ts`
and rendered by one server component.

| Page | Emits |
| --- | --- |
| All public pages (layout) | `Organization`, `WebSite` |
| `/scholarships`, `/articles` | `WebPage`, `ItemList` |
| `/scholarships/[slug]` | `WebPage`, `BreadcrumbList` |
| `/articles/[slug]` | `WebPage`, `BreadcrumbList`, `BlogPosting`, `Person` |
| Taxonomy landings (×4) | `CollectionPage`, `BreadcrumbList`, `ItemList` |

The principle throughout is **emit only what is true**, because misleading
structured data is a manual-action risk (`docs/SEO_GUIDELINES.md` §5). So several
builders return `null` rather than filling a gap:

- **No `Organization.logo`.** `public/` contains no files, so there is no brand
  asset to point at, and a logo URL that 404s is a fabricated claim about the
  publisher.
- **No `SearchAction`** on `WebSite`. Site search resolves to `?q=`, which is
  `noindex`; advertising an endpoint that asks not to be indexed is the same
  contradiction the noindex rule exists to prevent.
- **No page-level data on a `noindex` page.** Structured data asks a consumer to
  treat a page as notable; `noindex` asks it not to. Both at once is incoherent.
- **No `Person` without a byline**, and **no `ItemList` for an empty page** — an
  empty list is not a thin list, it is a claim that the page enumerates something.
- **No scholarship-specific schema type**, per the §5 policy: nothing in the
  vocabulary is widely supported for a scholarship award.

**`<`, `>` and `&` are escaped on serialisation.** This is a security control,
not formatting. Values here are editor-controlled — article titles, author names —
and `JSON.stringify` does not escape `<`, so a title containing `</script>` would
close the script element early and turn the rest into live markup. An XSS vector
created by the feature meant to describe the page. There is a unit test that
feeds a hostile title through and asserts both that the document cannot break out
and that the value survives `JSON.parse` intact.

Site-level values come from `site_settings`, so the publisher's name and contact
address are editable without a code change; social profiles are included only
when a real `https://` URL is configured, never the empty seeded defaults.

### Fixed — `noindex` on a scholarship was not honoured by its own page

`noindex` has been in the CMS and honoured by the sitemap since Phase 2, and the
scholarship detail page **emitted no robots meta at all** — because
`DETAIL_SELECT` never selected the column. So a record an editor had marked
noindex was withheld from the sitemap and simultaneously advertised as indexable
to any crawler following an inbound link. A sitemap is only one discovery path.

The column is now selected, typed, and the directive is emitted. Verified against
a real record: flagged → the page returns `noindex, follow`, drops its page-level
structured data, still renders 200 for a visitor, and disappears from
`sitemap.xml`; cleared → all four reverse.

### Verified — Phase 5 increment 1

- `npm run verify` exits 0 — **306 unit tests**, lint and build clean
- **54 end-to-end checks** against a production build and the live database, then
  **8 more** after the `CollectionPage` change
- Notable coverage: filtered search pages emit no `ItemList` and no `WebPage`
  claim; a non-indexable page still carries the site graph but no page-level
  claim; an article with no byline emits no `Person` and no `author`, and emits
  both once a byline exists
- A taxonomy landing had to be made reachable to be verified: the first run
  revealed that **no `[SAMPLE]` fixture carries a taxonomy link**, so every
  taxonomy landing is currently a thin-page 404. A link was created for the run
  and removed afterwards, and cleanup confirmed `taxonomy links remaining: 0`.
- **Not verified:** the Schema Markup Validator and Rich Results Test have not
  been run against these documents. The assertions cover well-formedness and
  internal consistency, not a consumer-side validation pass.

### Added — redirect manager and enforcement (Phase 5, increment 2)

The `redirects` table shipped in Phase 2 with four CHECK constraints, an index,
`seo.manage` policies, and **nothing read it**. A rule could be written directly
to the database and had no effect on any request.

**Enforcement** lives in `src/proxy.ts` and runs before any auth work, so a
redirect costs one cached map lookup and no cookie handling. The rules come from
`src/features/redirects/store.ts`, which caches the map for 15 seconds and reads
it with the service-role client — `redirects` SELECT is permission-gated, and the
proxy has no session cookie to authorise with. Widening the table to `anon` would
publish the whole redirect map and make it a place to store spam links.

**Resolution** is pure and in `src/features/redirects/resolution.ts`. Matching is
by exact path and nothing else: `from_path` is the primary key and a pattern
engine would be a way to make one rule capture `/admin`. Chains are followed
(bounded at 5 hops), query strings are preserved, and **a loop is refused rather
than partly followed** — redirecting to the last non-repeating hop would hand the
browser a loop that continues across requests. The refusal surfaces as an
ordinary 404 instead.

Loops are also caught **at write time**, so an editor is told "this would loop"
while saving rather than discovering it at a URL later.

**The admin screen** (`/admin/redirects`, behind `seo.manage`) offers create,
edit, pause/resume and delete, with the source path shown as fixed during an edit
because `from_path` is the primary key — offering an input that silently ignored
what was typed is exactly the control `AGENTS.md` §2.5 forbids.

### Fixed — `redirects` was readable by nobody, including an administrator

**Fifth instance** of the defect class fixed in migrations 022, 023, 024 and 028:
a policy with no underlying grant. Migration 013 granted
`INSERT, UPDATE, DELETE` on `redirects` to `authenticated` and omitted `SELECT`,
so the four policies were live except the read path, which was dead code. An
administrator holding `seo.manage` could write a redirect and could not read one
back — `/admin/redirects` rendered "Redirects could not be loaded".

Found by opening the screen as a real signed-in administrator. A read of
`pg_policies` would have shown four correct policies and nothing wrong.

Migration 029 grants SELECT to `authenticated` and asserts it with
`has_table_privilege`. Ten new live assertions pair each denial with a positive
read, and prove the write path the CMS actually uses.

### Two measurements that changed the implementation

1. **`NextResponse.redirect` requires an absolute URL.** Passing the relative
   destination straight through threw `ERR_INVALID_URL` and returned **500** —
   the first working version of this feature broke every redirected URL. The
   destination is now resolved against the **request** origin, not
   `NEXT_PUBLIC_SITE_URL`, so a preview deployment cannot bounce a visitor onto
   production.
2. **`invalidateRedirectCache()` cannot reach the proxy.** The proxy runs in its
   own module registry, separate from the Server Action process, so the action
   clears its own copy and the proxy's is untouched. Measured: a rule created
   through the CMS did not start redirecting until the TTL expired. An earlier
   comment in this codebase claimed invalidation narrowed the window on a
   single instance; it does not, and that comment was wrong. The TTL is the only
   bound in either direction, it is 15 seconds, and the admin screen now says so
   instead of letting an editor conclude the feature is broken.

### Verified — Phase 5 increment 2

- `npm run verify` exits 0 — **336 unit tests**
- `npm run test:rls` — **109 passed, 0 failed** (up from 99)
- **33 end-to-end checks** against a production build and the live database:
  every validation rejection (site root, missing slash, `http://` target,
  `//evil.test` open-redirect, self-reference), a real 301 with a correct
  `Location`, following it to a rendered page, query-string preservation, loop
  refusal, pause/resume, edit, an external `https://` destination and a
  two-step-confirmed delete
- The temporary `super_admin` was created and destroyed in the same run;
  `redirects` is empty and only the pre-existing account remains
- `redirects.hit_count` is **not** wired and deliberately not displayed — see
  the roadmap for why

### Changed — the sitemap is now a real index of content-type segments (Phase 5, increment 3)

`/sitemap.xml` was one `<urlset>` that would have breached the 50,000-URL
protocol cap at scale. `src/lib/seo.ts` detected that condition, logged an error,
and then did nothing about it — which is the codebase telling the truth about
itself.

`/sitemap.xml` is now a `<sitemapindex>` listing segment files, split by **content
type** — `pages`, `scholarships`, `articles`, `taxonomy`. Chunking into numbered
files every 50,000 URLs would satisfy the protocol and tell a crawler nothing;
a separate `articles.xml` is information it can act on. The cap is still enforced
inside each group, so no file can exceed it however the catalogue grows.

**Served by a Route Handler, not the `sitemap.(xml|ts)` convention.** Next's
metadata route can only emit `<urlset>`; `generateSitemaps` produces more
`<urlset>` files, which would leave `/sitemap.xml` asserting that a list of pages
is a list of sitemaps. A `<sitemapindex>` is a different root element, so
`src/app/sitemap.xml/route.ts` serves it and `/sitemaps/[segment]` serves each
`<urlset>`. The convention was verified against the Next 16 docs rather than
assumed.

**An empty group yields no segment, and requesting one is a 404.** With no
articles published there is no `articles.xml`, and an unknown or mistyped segment
name is a 404 too — never an empty `<urlset>`, which asserts that a collection
exists and is empty. `parseSegmentName` accepts only names this module could
itself have produced; the segment name is a public URL, so the parser is the only
thing between a crawler and a directory traversal.

`robots.txt` continues to advertise the index and never a segment file directly.

### Verified — Phase 5 increment 3

- `npm run verify` exits 0 — **373 unit tests** (37 new)
- **43 end-to-end checks** against a production build and the live database
- The load-bearing assertion is the **union invariant**: the union of every
  segment equals the complete indexable set, with no URL in two segments and no
  `noindex` record present. A packaging bug that dropped a URL would produce a
  perfectly valid sitemap that silently de-indexes content, so this is checked
  directly instead of inferred from each file looking well-formed
- Segments were also verified reacting to content: publishing an article adds
  `articles.xml` and lists it; withdrawing it removes the URL; archiving the only
  article removes the segment from the index and makes it 404 again
- One harness correction worth recording: the first attempt set `noindex` on an
  article alone and **the database refused it**, because the schema forbids
  `noindex` together with `allow_sitemap`. The failed update then "proved" the
  segment was still correct. The harness now asserts the CHECK violation and
  writes both columns together, as the CMS action does.

### Added — SEO administration with guardrails (Phase 5, increment 4)

Two screens, two permissions, deliberately not merged:

- **`/admin/seo`** (`seo.manage`) — indexability across scholarships, articles
  and content pages at once, with a per-record control and a list of genuine
  contradictions. A problem of this kind is rarely confined to one table, and an
  audit you have to run three times is an audit nobody runs.
- **`/admin/settings`** (`settings.manage`) — the SEO and social groups of
  `site_settings`: default title and description, Twitter handle, social profile
  URLs. Phase 4 lists a general settings screen as remaining; this is the same
  screen for the subset Phase 5 needs, so an editor learns one place.

**The guardrails live in `src/features/seo/guardrails.ts`** as pure functions,
because they answer a question whose answer an editor needs in words. A record
that is not published cannot be made indexable, and the refusal names the actual
state: *"This record is still a draft, so it is not on the site yet. Publish it
first, then allow indexing."* Excluding anything is always permitted, because
turning indexing off cannot make anything worse. `noindex` and `allow_sitemap`
move in one write — only `articles` has the second column, and writing it
elsewhere would be a PostgREST column error, not a no-op.

`SEO_GUIDELINES.md` §11 also allows "an explicit override flag, which is
audited" for a record that is both no-index and sitemap-listed. No such flag
exists in this schema and none was invented to satisfy the sentence; a CHECK
forbids the combination and the override path is recorded as not implemented.

**Private feature switches are unreachable.** `newsletter.enabled`,
`ads.enabled` and `site.maintenance_mode` live in the same table and are read by
the query, but `EDITABLE_SETTING_KEYS` refuses them. A generic settings form is
exactly how a maintenance switch gets flipped by accident.

### Fixed — three defects the end-to-end run found

1. **The index toggle was inverted.** With `noindex = false` the button read
   "Exclude from search" but sent `indexable = true`, because the handler asked
   for `!record.noindex` instead of `record.noindex`. A record that was already
   indexable, clicked, asked to become indexable; a draft was refused with the
   message for the wrong direction and the database was left untouched.
2. **A draft was labelled "indexable".** `noindex ? 'excluded' : 'indexable'` is
   simply false for a draft, which is not on the site at all — telling an editor
   the opposite of the truth about the record they are about to publish. It now
   reads "not on the site yet".
3. **`site_settings.value_type` never reached the form.** The query selected
   `value_type` and the code read `valueType`, so the type rendered empty,
   `parseSettingValue('')` fell through to its string branch, and an `http://`
   address was accepted and stored in a setting declared as `url`. Fixed twice:
   the column is renamed explicitly in the query — PostgREST's `alias:column` is
   a table alias for an embedded resource, not a rename, and fails the query
   with 42703 — and the Server Action now reads `value_type` **from the row
   itself**, because a client that can name the type of the column it is writing
   has already defeated the validation.

### Verified — Phase 5 increment 4

- `npm run verify` exits 0 — **406 unit tests** (33 new)
- **36 end-to-end checks** against a production build and the live database
- The load-bearing checks are the guardrail **refusals**: a draft cannot be made
  indexable, the message names the real state, and **the database is confirmed
  unchanged**. A test that only proves "the button saved" proves nothing when
  the button should never have been allowed to save.
- Also verified: the public page emits `noindex` immediately after the change;
  an excluded article disappears from every sitemap segment in the same write;
  each change is audited with real before/after; the maintenance and feature
  switches are absent from the settings screen
- The temporary `super_admin` was destroyed in the same run; fixtures and audit
  rows removed, and `seo-e2e` records and articles are back to zero

### Changed — alt text is now enforced, and the indexability sweep ran (Phase 5, increment 5 — phase complete)

**Migration 030** adds `media_assets.is_decorative` and the CHECK

```sql
check (is_decorative or alt_text is not null)
```

Enforcement was previously impossible rather than merely unimplemented: `alt_text`
was nullable and the editor was told to "leave empty only if the image is purely
decorative", so a decorative image and a forgotten alt text were the same `NULL`
and no constraint could tell them apart. Now an asset is either described or
explicitly decorative, and "neither" is unrepresentable. Uploads are refused
**before** the bytes are sent, with a message an editor can act on.

Existing rows are backfilled to `is_decorative = true` — a claim the migration
cannot verify, chosen because it does not assert something untrue about content
nobody has described. Inventing alt text would have been fabricated accessibility
copy (`AGENTS.md` §2.7).

**Honest limitation, stated rather than buried: no image is rendered on the public
site.** There is no `<img>` or `next/image` in any public route; the OG cards come
from `ImageResponse`, which has no alt text. So this improves the library and has
**no effect on what a visitor experiences yet**. The Phase 4 featured-image picker
is what makes it matter, and this constraint is what will stand behind it.

### Fixed — two real defects found by the sweep (85 end-to-end checks)

1. **Every page 2+ of `/articles` canonicalised to page 1.** That is the classic
   mistake: it tells a crawler everything after the first page is a duplicate,
   which is how a paginated index loses its tail. Pagination is now
   self-canonical; filters still point at the clean index, because a filter is a
   subset of the same list while page 2 is a different set of records.
2. **A sorted scholarship view was `index, follow`.** `SEO_GUIDELINES.md` says
   sorted search is `noindex, follow`; four sort orders means four near-identical
   pages competing with each other and with `/scholarships`. The page-level
   JSON-LD is now derived from the *same* condition as the robots directive —
   structured data disagreeing with the page's own robots meta is exactly the
   contradiction the sitemap rules exist to prevent.

Also fixed: `/auth/*` sent no `X-Robots-Tag`. The `(auth)` layout already emitted
the meta tag so the page was not indexable, but the header now matches `/admin`,
so the instruction survives a consumer that never parses the body.

### Verified — increment 5, and Phase 5 as a whole

- `npm run verify` exits 0 — **406 unit tests**
- `npm run test:rls` — **111 passed, 0 failed** (2 new assertions for the alt-text
  CHECK; the suite's own media fixture had to be given alt text, which is the
  constraint working rather than the test breaking)
- **85 sweep checks**, including: every public route indexable with a canonical;
  every filter and sort order `noindex, follow` canonicalising to the clean
  listing; a draft URL a hard 404 that becomes 200 when published and 404 again
  when withdrawn; a `noindex` record still rendering for a visitor while
  disappearing from the sitemap; `/admin/*` redirecting anonymous visitors and
  sending `X-Robots-Tag`; and **every sitemap URL resolving 200 with none
  contradicting its own robots meta**

Phase 5 is complete. Known gaps are recorded in `docs/DEVELOPMENT_ROADMAP.md`:
no `rel=next`/`rel=prev` (Google deprecated them in 2024), no `Organization.logo`
(no brand asset exists), the external structured-data validators not yet run, and
`/admin/settings` covering the SEO and social groups only.

### Added — featured-image picker (Phase 4, increment 7)

`articles.featured_image_id` and `scholarships.image_id` have existed since Phase 2
with **no control anywhere in the CMS**. A column an editor cannot set is a column
nobody sets.

`MediaPicker` searches the library, previews it, and writes the chosen id as a real
form field. Archived assets are not offered — a new page should not start life
pointed at something on its way out.

**This is where the Phase 5 alt-text work becomes user-facing.** Each thumbnail is
rendered through `altAttributeFor`, the single function that will also serve the
public pages, so an empty `alt=""` for a decorative image is decided in one place
and cannot drift between the picker and the page that uses the image. The picker
also shows the editor the literal text a screen reader will announce, *before* the
article is published.

The chosen image is verified on the server, not trusted from the form: it must
exist, must not be archived, and must carry alt text or an explicit decorative
flag. Each refusal has its own message rather than a foreign-key constraint error
naming a column the editor never touched.

**The round trip is verified explicitly**, because it is the failure mode that
loses data quietly. An article whose image was chosen from page three of the
library would render with nothing selected while the id was still stored — and the
next save would clear it. The edit screen therefore resolves the chosen asset
separately from the first library page, and the end-to-end run confirms that
reopening shows the image, that **a second save does not clear it**, and that
Remove does.

`<img>` rather than `next/image`, deliberately: admin-only thumbnails of
possibly-signed URLs, where the optimiser would cache a URL that has already
expired. The lint rule is disabled for that single file with the reason recorded.

**Verified:** `npm run verify` exits 0 — **416 unit tests** (10 new);
**21 end-to-end checks** against a production build and the live database,
including the alt attributes on both thumbnail kinds, the archived asset being
absent from the picker, both server-side refusals, and the audit trail recording
the image id. Temporary admin and all fixtures destroyed.

### Added — account menu replaces the email address in the header

The signed-in state of the public header was a bare line of text showing the
account's email address, repeated on every page of the site. It is now an
**"Admin" dropdown** carrying the account actions:

```
Admin ▾
  ├─ Dashboard  → /admin
  └─ Sign out   → posts signOutAction
```

**Why the email was dropped.** This bar is public chrome on every page. An
address there is noise to a visitor, and on a shared or recorded screen it is a
small privacy exposure for no benefit. Nothing was lost: the account's actions
were never available from the header at all, so the menu adds capability rather
than removing it.

**Sign out reuses the existing `signOutAction`** through a form, not a link, so
the browser cannot trigger a sign-out by prefetching. `SignOutButton` in the
admin sidebar is untouched — same action, different presentation.

The menu implements the ARIA APG menu-button pattern: `aria-haspopup="menu"`,
`aria-expanded`, `aria-controls` on the trigger, and the panel is
`aria-labelledby` that trigger. Arrow Up/Down move between items and wrap,
Home/End jump, Escape closes and returns focus to the trigger, click-outside
closes, and Tab closes rather than falling into the panel — every item is
`tabIndex={-1}` because this menu moves focus programmatically instead of
letting Tab walk into it. It is deliberately **not** a focus trap: trapping
focus in a non-modal menu is a keyboard trap, not an accessibility feature.

`focusOnOpen` is a ref rather than state. Reading it once when the panel mounts
and clearing it inside that same effect is the cascading-render pattern
`react-hooks/set-state-in-effect` correctly rejects, and the linter caught it.

Verified with a real `editor` session driven end-to-end in Chromium against the
dev server: **27/27 checks pass**, covering the absence of the email, all the
ARIA wiring, every keyboard interaction above, Dashboard actually routing to
`/admin`, and Sign out actually clearing the session back to a `Sign in` link.
`npm run typecheck`, `npm run lint`, `npm run test` (247) clean; `npm run build`
compiles. The verification account was deleted afterwards — the only account
left in the database is the pre-existing `super_admin`.

### Changed — header reduced to wordmark, four links and Sign in

The top bar is now two zones instead of three: wordmark alone on the left, and
on the right the four database-driven links (Articles, About, Contact, Help)
followed by the auth control. There is no rule between the links and the Sign in
button — the outline button is already a closed shape, so a divider beside it
only added a second vertical edge.

- **The "Search scholarships" button is gone** — both the filled desktop pill and
  the mobile icon-only shortcut. `/scholarships` is still reachable from the
  homepage hero search field, the homepage browse blocks, the scholarship detail
  page, the taxonomy landings, the contact page and the 404/error pages, so no
  entry point was lost. No migration is involved: the button was never a
  `navigation_items` row, so removing it is purely a component change.
- **The nav moved from beside the wordmark to the right-hand group**, and its
  links drop to 14px (`px-2.5 py-1.5 text-sm`) to suit the 64px bar.
- **Sign in uses the `outline` variant** instead of overriding `primary` with
  `bg-ink-100 text-ink-800 hover:bg-ink-200`. The override pinned three grey
  steps at one call site and competed with the brand fill for attention; `outline`
  carries the same border/bg/hover ramp from `@/components/ui/button`, so it tracks
  `@theme` automatically. It also matches the "Sign in" link already rendered on
  `/auth/login`. The brand fill is now reserved for the hero search action.

`NavLink` gained a `size` prop (`bar` | `panel`) instead of taking a `className`
override from the header. `cn` is a plain joiner, so `className="text-sm"` on a
link whose base sets `text-base` emits both classes and the winner depends on
Tailwind's internal utility order — not something the caller can control.

Verified: `npm run typecheck`, `npm run lint` and `npm run test` (247 tests) all
clean, `npm run build` compiles. Layout checked in Chromium against a production
build — at 1280px the nav occupies x 802–1057 and Sign in x 1082–1158 flush with
the container edge, no horizontal overflow; at 390px both are hidden and the
mobile panel is unchanged.

### Added — Phase 4 increment 5: media library

Upload, browse and edit images at `/admin/media`. `media.upload` to add,
`media.manage` to edit and archive; both re-checked server-side, and RLS
enforces them independently.

**Uploaded bytes are sniffed by magic number** (`sniffImageMime`). `file.type` and
the filename are both client-supplied and can be made to agree with each other, so
agreeing with each other proves nothing — an HTML document named `photo.png`
declared `image/png` passes every field-level check. Reading the content is the
only check that cannot be spoofed. SVG is the fiddly case: it is text, so it is
identified by decoding the head, walking past an XML prolog / doctype / comment,
and then requiring `<svg` to be the **root** element. Accepting an `<svg>` element
merely appearing somewhere would accept any HTML page whose body mentions "<svg",
and SVG is the one accepted format that can carry script.

**Storage paths never reuse the uploaded filename.** The original name is
attacker-controlled and can contain path separators, so the object is written as
`<bucket>/<folder>/<generated-uuid>.<ext>`, with the extension derived from the
*validated MIME type* so a renamed file cannot be served under a mismatched
extension. The folder is checked against a slug pattern and falls back to
`general`; `../../public-media` becomes `general`. The original filename is kept in
`media_assets.file_name` for display.

**Private assets are previewed with signed URLs**, generated per request with a
10-minute life and batched into one call per page. A `public_url` only exists for
public assets, so a library reading only that column would show a wall of blanks
for exactly the assets a media manager most needs to review. Signed URLs are never
persisted — a stored one is a stored credential.

**Assets are archived, never hard-deleted.** `scholarships.image_id` and
`articles.featured_image_id` both reference this table with `on delete set null`,
so deleting an asset in use would silently strip the image from a published record
rather than failing loudly.

**Plain `<img>` rather than `next/image` in the gallery**, with the reason recorded
in a code comment and an explicit lint exemption: the optimiser re-fetches bytes
itself, which cannot work for a time-limited signed URL because the signature is in
the query string. Private assets only ever have signed URLs.

### 🔴 Fixed — a media manager could not see or archive an archived asset

`media_select_public` (migration 010) was written with `AND`:

```sql
archived_at is null and (is_public or has_permission('media.manage'))
```

The intent is "public assets are world-readable, everything else needs
`media.manage`", but joining the two with `AND` means that once `archived_at` is
set the row is excluded for **everyone** — the permission branch can never rescue
it, because it sits behind a condition that is already false. Every other table in
the schema gets this right with `OR`. Fixed by migration 027.

Consequences before the fix:

1. `UPDATE media_assets SET archived_at = now()` failed with `new row violates
   row-level security policy`. An UPDATE's RETURNING clause is filtered by the
   SELECT policy, so archiving a row made it instantly invisible and the statement
   errored. **The archive button could not work at all.**
2. An "archived" filter could never return a row.
3. Archiving an asset referenced by a published record would appear to succeed
   while leaving the image unreachable.

Isolating it took a temporary super_admin and driving the Data API with and without
`return=representation`: `alt_text` and `folder` updated fine, only `archived_at`
failed. That asymmetry is what pointed at the SELECT policy rather than the UPDATE
policy. `npm run test:rls` could not have caught this — it asserts a `student`
cannot read media, which was true throughout. Five assertions now cover the
archived case, and the suite is 91/91.

Because archived rows are now correctly visible to managers, the library **labels
them** rather than showing them as available — an archived asset rendered like a
live one could be attached to a published record by mistake.

### 🔴 Fixed — uploads over 1 MB failed silently

Next.js defaults `experimental.serverActions.bodySizeLimit` to 1 MB, and it applies
to the whole request, so a multipart upload through a Server Action is rejected
*before the action function runs*. The media library promised "maximum 5 MB" —
matching the bucket's `file_size_limit` — while anything over 1 MB produced a bare
413 with nothing rendered in the form, because there was no action result to
display. An editor uploading a 2 MB photo would see the button spin and stop.

Set to 8 MB — deliberately **above** the application's own 5 MB limit, not equal to
it. The transport limit is silent; `checkUploadFile` returns a message. The extra
headroom means a 5–6 MB file is rejected by the application with an explanation,
and only a file over 8 MB ever reaches the raw transport error. Verified with a
6 MiB file (rejected with "That file is 6.0 MB. The limit is 5 MB.") and a 4.5 MB
file (accepted, `file_size` stored as 4,718,669).

### Added — Phase 3 part 2 closed: newsletter, robots, sitemap, OG cards, a11y and responsive passes

**Newsletter signup.** Form, Server Action and a read-only admin list at
`/admin/newsletter`. The interesting part is the lifecycle, because `email` is
UNIQUE and a naive insert fails on the second signup from the same person — the
most common case there is. States are handled explicitly instead of being
collapsed into one error: `pending`/`subscribed` says "already on our list" and
changes nothing; `unsubscribed` is a genuine re-subscription and restamps
consent, because the old consent record no longer describes what the visitor just
did; `bounced` is **not** silently reinstated, since an address that hard-bounced
once likely will again and quietly re-adding it damages the sender reputation of
every address on the list.

Written through the service-role client, like the contact form, because
`newsletter_subscribers` is revoked from every client role. That is correct — the
table holds real addresses and a record of what people consented to, and a public
INSERT privilege would let anyone who found the endpoint enumerate addresses by
inserting and reading back.

**It ships switched OFF**, gated on the existing `newsletter.enabled` setting. No
mail provider is configured, so nothing can be sent: not a confirmation, not a
welcome, not an announcement. Collecting real addresses against a promise that
cannot be kept is the fake-feature case `AGENTS.md` §2.5 exists to prevent, so the
success message says "your address has been recorded. We are not sending email yet"
rather than "check your inbox", and the form repeats that in plain text.

**`robots.txt`** (`src/app/robots.ts`). Disallows `/admin` and `/auth`. The
deliberate part is what it does **not** do: indexability is expressed only as
per-page robots meta, never as a `Disallow`. A `Disallow` prevents the fetch that
would reveal a page's `noindex` tag, so disallowing something that should be
deindexed is the one reliably counterproductive thing you can write here.

**`sitemap.xml`** (`src/app/sitemap.ts`, composed by `src/lib/seo.ts`). Every URL
comes from the database, so an unpublished, `noindex` or withdrawn page cannot be
listed. The rule it exists to protect: **a sitemap must never list a URL the page
itself marks `noindex`**, because the sitemap and the page are read by different
consumers and a contradiction between them is a signal to ignore both. Taxonomy
landings are therefore skipped when thin, matching `taxonomyMetadata`. Thinness is
computed by `public.sitemap_taxonomy_terms()` (migration 025) rather than one
query per term, which would issue hundreds of queries once `locations` grows. The
function is SECURITY INVOKER on purpose, so RLS applies and it counts only
published scholarships.

Verified by temporarily linking a fixture to a category and noindexing a record
and a page: the landing page appeared, all three exclusions held, and restoring
returned the sitemap to its original 14 URLs.

**Open Graph / Twitter cards.** `ImageResponse` via a shared renderer, per-record
for scholarships and articles, static for the rest. Award figures and deadlines
come from the record, and an award with no stated amount renders "Amount not
specified" — the same honest wording the page uses — rather than a number. An
unresolved slug returns a neutral card instead of a 404, so asking for the image
of an unpublished record leaks nothing about whether it exists.

**Accessibility and responsive passes.** 126 mechanical checks across 10 pages and
121 across 11 pages at four widths. Both found real defects, which is the argument
for running them at all — see below.

### 🔴 Fixed — the newsletter block could never have rendered

`newsletter.enabled` was seeded `is_public = false`. The policy
`site_settings_select_public` reads `using (is_public or has_permission(...))`, and
`getPublicSettings()` additionally filters `.eq('is_public', true)`, so an anonymous
visitor could never read the flag and `NewsletterBlock` evaluated to `null`
unconditionally. Fixed by migration 026.

The feature was not *visibly* broken — the footer looked right, because the block
correctly renders nothing when disabled. **A gate that can only ever be closed
looks exactly like a gate that works.** It was found only by temporarily setting
the flag and looking for the form, which is now recorded as the verification
method for any settings-driven feature.

### 🔴 Fixed — WCAG 2.2 AA 2.5.8 target size on every filter control

The scholarship filter checkboxes and radios are 16×16, and their wrapping
`<label>` — which is the real target, since clicking it toggles the control —
measured **354×20**, failing the 24×24 minimum on height. Rows now carry
`min-h-7`.

The knock-on was caught too: rows grew from a 20px line box to 28px, so
`FILTER_ROW_REM` in the same file had to move from 1.75 to 2.25. Left alone, the
container would have been under-sized and the internal scrollbar would have come
back — reintroducing the exact defect the adaptive sizing was added to remove.
Re-verified: the field-of-study list still renders unscrolled (316px content in a
316px box).

### 🔴 Fixed — `aria-current` rendered as `"true"` instead of `"page"`

`NavLink` used `aria-current={isCurrent || undefined}`, which React stringifies to
`aria-current="true"`. Technically valid — `true` is the default token — but less
precise, and inconsistent with the explicit `aria-current="page"` used by the
article category chips and both admin inboxes. A consumer looking for the `page`
token would have found nothing. Now `isCurrent ? 'page' : undefined`.

### Added — `sitemap_taxonomy_terms()` (migration 025)

SECURITY INVOKER, aggregated in SQL, returns only terms with at least one
published scholarship — RLS does the filtering, so it cannot be used to infer how
many drafts exist. That would have been the exact mistake migration 017 was written
to avoid for the provenance view.

Verified across the whole increment: `npm run verify` exits 0 (218 unit tests,
lint and build clean); `npm run test:rls` passes 86/86; 126 accessibility and 121
responsive checks pass; the newsletter lifecycle verified end-to-end in a real
browser with rows confirmed in `newsletter_subscribers`; `robots.txt` and
`sitemap.xml` verified against the live database; the OG card confirmed a real
1200×630 PNG with correct data.

### Added — every header and footer link now resolves (Phase 3 part 2, Phase 4 increment 4)

The header advertised Articles, About, Contact and Help, and the footer added
About Us, Contact Us, Help Centre, Privacy Policy, Terms of Use and Editorial
Standards. **None of those seven paths had a route**, so every one of them 404'd.
Verified before this change: `GET /articles` → 404, `/about` → 404, `/contact` →
404, `/help` → 404, `/privacy` → 404, `/terms` → 404, `/editorial-standards` →
404.

**Static pages — `content_pages` (migration 021).** About, Help, Privacy, Terms
and Editorial Standards now render from a new `content_pages` table rather than
from TSX. `AGENTS.md` §2.8 forbids hardcoding CMS content in components, and
legal text changes far more often than code does. One shared component
(`src/components/layout/content-page.tsx`) renders all five, so heading order,
prose styling and the metadata rules are identical everywhere. Bodies are
sanitised on read as well as on write, through the same allowlist as articles
(`src/lib/sanitize.ts`). An inactive page 404s without leaving a dangling footer
link, and `DELETE` is not granted — withdrawing a legal page is a status change,
not a deletion.

**Articles.** A public query layer (`src/features/articles/queries.ts`), a listing
page with category and keyword filters, and a detail page. The reader applies no
status filter at all: `article_is_public()` in RLS is what makes a draft, an
in-review article, a scheduled-but-not-yet-due article and an archived one all
invisible, so a scheduled article cannot leak early and an archived one cannot be
read by guessing its slug. Category filtering uses a PostgREST `!inner` embed —
without it the filter left-joins and returns the whole table with links attached to
some rows.

**Contact and report submissions.** `/contact` serves two jobs chosen by query
string: a message to a person (`contact_submissions`, written through the
service-role client, since that table is revoked from every client role) and a
correction against a named record (`content_reports`, written through the SESSION
client so RLS constrains it). This is what the "Report incorrect information" link
on every scholarship and article page pointed at while it did nothing. The report
slug is resolved to a row id server-side under RLS, so a draft cannot be reported
and cannot be probed for by guessing slugs. Both forms validate with Zod, carry a
honeypot and a minimum fill time, and echo submitted values back on rejection.

**Admin inboxes.** `/admin/contact` (`contact.manage`) and `/admin/reports`
(`report.manage`) exist so the public forms are not black holes. Both are
**read-only**: UPDATE is granted by policy but no triage action is implemented, so
no status control is rendered rather than one that looks real and does nothing.
Both were added to `ADMIN_NAV` in the same change as their routes.

**Rate limiting is deliberately absent**, and is recorded as an open gap rather
than implied. `UPSTASH_REDIS_REST_URL` exists in the environment schema but no
Redis client is installed, and `AGENTS.md` §2.10 forbids adding a dependency
without justification. Honeypot plus a two-second minimum fill time reject naive
scripted submitters; a determined bot that solves the honeypot and waits can
still submit.

**The legal copy is a draft.** It is written against what the code actually does —
the privacy text states plainly that no advertising or analytics is currently
active, and nothing claims a verification team, an address, a response time or a
statistic, because none of those exist. It still needs a lawyer, and there is no
CMS editing screen for it yet.

### 🔴 Fixed — three real defects, all the same shape: a policy with no grant

A Row Level Security **policy** with no underlying table **grant** is unreachable.
PostgreSQL checks the privilege first and the policy second. None of these is
visible to anyone reading the policies, and none would show up in a page render —
they show as an empty screen.

1. **`contact_submissions` had no SELECT policy and no grant.** Migration 022
   added the policy, but migration 013 had revoked every privilege from
   `authenticated` and nothing restored it. Messages were stored and unreadable:
   the contact form told a visitor their message had been received while nobody
   could read it.
2. **`content_reports` had no SELECT grant for anyone.** Migration 010 created
   `content_reports_select_cms`; migration 013 revoked, then re-granted only
   `insert, update`. The reports inbox could never read a row.
3. **The public report form failed silently for every visitor.** `anon` INSERT was
   revoked by migration 013 and re-granted only to `authenticated`, so a
   signed-out visitor — which is who most people are, since sign-up is closed by
   design — received `42501` while the UI reported success. This broke the site's
   most trust-sensitive affordance: corrections to published facts.

Fixed by migrations 023 (`SELECT` on both inboxes) and 024 (`INSERT` on
`content_reports` for `anon`). All three grants are safe because RLS still
constrains every row; the grant is what makes the policy reachable, the policy is
what makes it safe.

**The suite had passed while all of this was broken.** It asserted only that anon
*cannot* read reports and *cannot* forge a pre-resolved one — both true — and never
that a legitimate submission *succeeds*. A positive assertion plus a service-role
control proving the row is stored were added. A suite made only of denials passes
against a feature that does not work; that lesson is worth carrying to the
remaining suites in Phase 7.

### Fixed — a rejected form submission wiped everything the visitor had typed

Found by driving the real form with Playwright, not by reading the code. React 19
resets the fields of a `<form action={serverAction}>` once the action resolves. That
is right on success and destructive on failure: a visitor who mistyped their email
lost the whole message they had just written, while the alert said "Check the
highlighted fields" and every field sat empty.

Re-supplying the values as `defaultValue` does not help — the inputs are not
remounted. The fields are now controlled, so the next render restores the draft.
The fix uses React's documented "adjust state during render" pattern rather than
`setState` in an effect, because the latter cascades a second render (both forms'
first attempt was rejected by `react-hooks/set-state-in-effect`). Focus now moves
to the first field that failed, which is what makes "check the highlighted fields"
actionable, rather than to the alert region.

> Note for later: the sign-in form has the same shape and the same latent bug. It
> was not touched here because auth is outside this change's scope.

### Changed — filter groups on `/scholarships` sized to their own list

`FilterGroup` in `src/app/(public)/scholarships/page.tsx` applied a hard
`max-h-64` to every filter list. Nine academic fields, one of which wraps to two
lines, exceed 16rem, so "Field of study" rendered in a ~15rem inner scroll area
with a visible scrollbar — most of the list was hidden for no reason.

The group now takes its `itemCount` and sizes itself to its content
(`min((itemCount + 1) × 1.75rem, 24rem)`; the extra row absorbs a wrapped label).
Lists that fit the cap render in full with no scrollbar; only taxonomies longer
than the cap scroll, and those apply a bottom `mask-image` fade so the hidden
scrollbar still signals more content. All groups use the pre-existing but
previously unused `no-scrollbar` utility (`src/app/globals.css`), so the
scrollbar is gone while wheel and keyboard scrolling still work — focusing an
off-screen checkbox scrolls it into view.

### Changed — `src/types/database.ts` is now UTF-8

The file was previously UTF-16 encoded, which is why `grep` reported it as a binary
file. Regenerated with `npm run types:db`; the halving in byte size is the
encoding change, not lost content — 59 table/view entries, `Functions` and
`Enums` all present, verified after regeneration.

Verified across this whole increment: `npm run typecheck`, `npm run lint`,
`npm run test` (211 passed) and `npm run build` are clean; `npm run test:rls`
passes 86/86 live assertions; all eight header and footer links return 200; and
the contact and report forms were driven end-to-end in a real browser with rows
confirmed present in `contact_submissions` and `content_reports`.

### Changed — public site redesigned against the bold.org reference

`AGENTS.md` §1 was amended (approved by the operator) to make
<https://bold.org/> the primary visual/UX reference, with TopUniversities
retained as a secondary tone reference. The scope was explicitly limited to
**visual language only** — see the reference analysis for the full adopt/do-not-
adopt list.

**Reference capture.** `bold.org` returns HTTP 429 to plain HTTP fetches, so it
was captured with Playwright driving real Chromium: homepage, listing and detail
pages at 1440/834/390px, plus a computed-style profile of every visible element.
`docs/REFERENCE_ANALYSIS.md` records the measurements — palette (`#5D57FB`
primary, `#100826` ink, `#18AB1A` verified green), type scale, radii (4px
surfaces / 8px controls / 20px panels / pill chips), 1100px content column, and
the horizontal row-card anatomy. Nothing is estimated.

**Design system** (`src/app/globals.css`) — token *names* were preserved so the
admin CMS, which shares them, kept working untouched; the *values* were
re-derived from the reference:
- `--color-brand-*` rebuilt around `#5D57FB`.
- `--color-ink-*` recast toward violet-black, with the contrast budget recorded
  in the file: `ink-500` `#76788C` is 4.03:1 and is therefore barred from body
  text; `--color-muted-foreground` is `ink-600` at 5.89:1.
- `--color-accent-*` rebuilt around the reference verified-green.
- Radii: `sm` 4px (default surface), `md` 8px (controls), `xl` 20px (panels).
- `--shadow-md` is now the reference's card shadow verbatim; hairlines carry
  structure rather than shadows.
- Inter only — `--font-display` resolves to Inter and headings moved from 700 to
  **800**. `Plus_Jakarta_Sans` was removed from `layout.tsx` rather than left
  loading unused.
- New utilities: `.container-wide` (1100px content, 1280px escape hatch),
  `.eyebrow`, `.text-gradient-hero`, `.surface-card`.
- `.container-page` narrowed from 1280px to the measured 1100px. `.skip-link` was
  left intact on purpose — the admin shell depends on it.

**Components**
- `ui/button.tsx`: `rounded-md` controls, `bg-brand-500` primary, 200ms
  transitions.
- `layout/site-header.tsx`: rebuilt — 64px white bar, hairline border, wordmark
  left, text nav, filled primary "Search scholarships" pill and a light "Sign in"
  pill. **Removed the `/auth/register` links**, which pointed at a route that does
  not exist and 404'd on both desktop and mobile.
- `layout/mobile-nav.tsx`: panel offset moved to match the 64px header; nav links
  at 16px/500 with a brand tint on the current page.
- `layout/site-footer.tsx`: uppercase eyebrow micro-labels on the column headings,
  matching the reference footer.
- **New** `features/scholarships/components/scholarship-row.tsx` — the reference's
  signature horizontal card: content column plus a fixed action column split by a
  vertical hairline, with an icon-over-label metadata grid. Interaction is two
  independent links, not a stretched overlay, so the action button stays
  clickable and nothing is nested.

**Pages** — homepage, `/scholarships` and `/scholarships/[slug]` were rebuilt to
the reference composition: tinted gradient hero with a single search affordance,
four-up stats, stacked row cards, a browse block expressed as pill chips instead
of four card grids, and a detail sidebar whose award amount is the hero with an
eyebrow/value fact grid. The detail page's apply CTA moved into the sticky
sidebar on desktop and is repeated only for mobile (`lg:hidden` /
`hidden lg:block`), so it is never rendered twice in one viewport.

**Deliberately not adopted:** student accounts, matched discovery, saved
scholarships, application tracking, donor profiles, the live "total awarded"
ticker and the winners feed. None exist here, sign-up is closed, and each would
have been a non-functional imitation.

**Fixed — horizontal overflow on every public page at 390px**

`document.scrollWidth` was **521px against a 390px viewport** on the homepage,
the listing and the detail page. Cause: `className="hidden sm:inline-flex"` passed
to a `ButtonLink`, whose own base class is `inline-flex`. `cn`
(`src/lib/utils/cn.ts`) is a deliberate plain joiner with no conflict resolution,
so the caller's `hidden` lost and the button stayed visible below `sm`.

Fixed with wrapper elements rather than by adding a class-merge dependency: the
header now wraps its responsive clusters in `<div className="sm:hidden">` and
`<div className="hidden items-center gap-2 sm:flex">`. **Do not pass `hidden` or
`sm:hidden` to a `Button`/`ButtonLink`** — wrap it instead.

**Fixed — award amounts and deadlines were visually truncated**

The new row card truncated its metadata values. On `/scholarships` the filter
sidebar squeezes the card content to roughly 530px, so four columns produced
`"1 Decembe…"` and `"$2,500 - $…"`. Clipping an award amount or a deadline is
worse than wrapping it, so `truncate` was removed and `ScholarshipRow` takes a
`metaColumns` prop: four on full-width pages, two behind the filter sidebar.

**Added — development-only sample data** (`supabase/scripts/sample-data.mjs`)

The database holds no scholarships, so cards, rows and detail pages could not be
reviewed in a browser. Six invented records exist purely for visual review:

- `npm run db:fixtures` — load
- `npm run db:fixtures:remove` — **remove before any launch**

Safeguards: every slug is prefixed `sample-` and every title starts with
`[SAMPLE]`; `application_url` uses the reserved `.invalid` TLD so no link can
resolve; `verification_status` is `unverified`, never `verified`. The loader is a
manual command only and is not part of `supabase/migrations/`, so
`supabase db push` cannot carry it into an environment.

> **These six rows are currently loaded in the linked project
> `nnufigsnijqzcojnpyuw`.** They are visible on the public listing and detail
> pages. Run `npm run db:fixtures:remove` before any launch.

**Verified**
- `npm run verify` exit 0 — typecheck, lint, **185 tests (8 files)**, build.
- Screenshot review at 1440×900 and 390×844 of the homepage, `/scholarships` and
  a scholarship detail page, against the reference captures.
- Horizontal overflow asserted programmatically on all six page/viewport
  combinations: **no overflow** after the header fix (was 521px on all three).
- Zero browser console errors on the mobile pass. The desktop pass still reports
  404s for `/favicon.ico` — there is no `public/` directory; unchanged by this
  work and still tracked as a gap.

### Changed — header navigation no longer lists the browse facets

Editorial decision. The top navigation no longer shows:

- `Find Scholarships` → `/scholarships`
- `Scholarships by Level` → `/scholarships/education-level`
- `Scholarships by Field` → `/scholarships/field`
- `Scholarships by Location` → `/scholarships/location`

The header is database-driven (`navigation_items`, read by
`getHeaderNavigation()`), so no component hardcoded these links and no
application code changed.

**Migration 020** (`supabase/migrations/20260101000020_hide_header_taxonomy_links.sql`)
sets `is_visible = false` on those four `location = 'header'` rows. It is an
update, not a delete: `is_visible` is the supported mechanism for hiding an item,
the rows stay reversible from the CMS, and the `navigation_select_public` RLS
policy already excludes invisible rows from the anon read. Scoped to
`location = 'header'`, so footer and legal navigation are untouched. It carries a
guard block that raises if any of the four paths is still visible in the header.

`supabase/seed.sql` was updated to match, so a local `db reset` does not
reintroduce them. The seed was **not** re-applied to the remote project — it has
no unique constraint on `(location, href)`, so re-running it would duplicate rows.

**Nothing else changed.** The four pages still exist and remain reachable from
the homepage browse blocks, from scholarship detail pages, and from the header
`Search` button, which links to `/scholarships`. No link became dead.

**Verified**
- `supabase db push` applied 020 to project `nnufigsnijqzcojnpyuw`.
- Service-role read: the four rows are `is_visible = false`; `Articles`,
  `About`, `Contact`, `Help` are untouched.
- Publishable-key (anon) read of `location = 'header'` returns exactly
  `[Articles, About, Contact, Help]`, count 4 — confirming the RLS-filtered
  public path the site actually uses.
- `npm run verify` exit 0: typecheck, lint, 185 tests (8 files), build.

### Phase 4 increment 1 — authentication, admin shell and dashboard

Sign-up is **closed**: the CMS is invitation-only, so accounts are created by an
administrator rather than by the public.

**Authentication** (`src/features/auth/`, `src/app/(auth)/`)
- Sign in, sign out, password-reset request and password update.
- Recovery uses Supabase's PKCE flow via `/auth/confirm`, a Route Handler
  because the cookie write cannot happen during a Server Component render.
- Password policy is length-only (minimum 12). Composition rules are
  deliberately excluded: they push people towards predictable substitutions.

**Security decisions worth recording**
- `safeReturnPath` is the open-redirect defence. It rejects absolute URLs,
  protocol-relative URLs (`//host`), backslash variants browsers normalise,
  control characters and absurd lengths. Applied both when rendering the
  form *and* again in the action, so a hostile value never round-trips.
- Sign-in and password-reset failures return identical messages regardless of
  whether the address is registered, so neither form is an account-enumeration
  oracle.
- Authentication is not treated as authorisation. A valid session with no CMS
  role is refused and signed out rather than reaching a dashboard where every
  query would fail.
- The reset form requires an explicit recovery session via `auth.getUser()` and
  deliberately does not fall back to the request cookie, which would let
  anyone reaching the page rewrite an arbitrary account's password.

**Administration** (`src/app/(admin)/`, `src/features/admin/`)
- `/admin` layout guarded by `requireCmsUser`, with a permission-filtered
  sidebar, skip link, mobile drawer and a 403 error boundary.
- Dashboard driven entirely by live aggregate queries. Figures that cannot be
  read render as an em dash, never as zero — zero would be a claim about the
  data rather than about the query.
- The sidebar lists only implemented sections. Planned sections are recorded
  separately in `ADMIN_NAV_PLANNED` and deliberately not rendered, so there are
  no links to screens that would 404.

**Bootstrap** — `supabase/scripts/create-first-admin.mjs`
- Closed sign-up would otherwise leave no way to create the first account.
  Refuses to run without a service-role key, refuses to grant a second
  `super_admin` unless explicitly allowed, and is safe to re-run.
  `npm run admin:create -- you@example.com`

**Fixed**
- `requireAuthState` and the guards that wrap it now return a type narrowed to
  an authenticated user, removing a cast at every call site.
- `src/types/database.ts` regenerated from the replacement project. The
  previous file predated it and did not know `write_audit_log` existed.

**Verified** — `npm run verify` exit 0 (typecheck, lint, 117 tests, build).
`/admin` returns 307 to `/auth/login?returnTo=%2Fadmin`; the three auth pages
return 200; the login page emits `noindex, nofollow, nocache` and does not
reflect a hostile `returnTo` into any field.

> Not yet verified: the authenticated session path. Creating an administrator
> requires a real account, which the operator must create with
> `npm run admin:create`. Until that is done, sign-in, the dashboard queries
> and the 403 boundary are verified structurally but not against a live
> session.

### Fixed — hydration mismatch across the admin area

`AdminNav` re-derived the navigation list from the permission array inside a
Client Component while the surrounding sidebar was a Server Component. Both
sides filtered independently and could disagree on the item count, so React
reported a hydration mismatch on every admin page.

Filtering now happens once, on the server, and the result is passed as plain
data. Icons are referenced by string key because a React component cannot cross
the server/client boundary as a prop.

This was not merely cosmetic: React discards the server tree and rebuilds it
when hydration fails, which destroys the Server Action reference bound to any
form inside it.

### Scholarship management — verified end to end

Create, edit, publish and the resulting public page were exercised through a
real browser session against the live database: `7500.00` stored as `750000`
integer cents, an edit to `900000`, publish setting `status = published` and a
`published_at` timestamp, and the public `/scholarships/<slug>` page rendering
the title. Fixtures were deleted afterwards; the database holds no test records.

While verifying, a persistent "submit is broken" failure turned out to be a
fault in the test, not the application: `page.click('button[type="submit"]')`
matched the sidebar's "Sign out" button, which renders before `<main>`, so the
sign-out action was dispatched instead of save. Confirmed from the request
headers, which carried the sign-out action id. Admin journeys must scope
selectors to the form under test.

### Added — article CMS with rich-text editor

**Editor** (`src/features/articles/admin/components/rich-text-editor.tsx`)
- TipTap editor reusing the same `.prose-editorial` typography as the public
  article page, so what an editor sees is what a reader will see.
- Headings 1–6, bold, italic, underline, strikethrough, inline code, bullet and
  numbered lists, blockquote, link insert/edit/remove with bare-domain
  normalisation, images, tables, horizontal rules, undo/redo and clear
  formatting.
- Toolbar is a real `role="toolbar"` of `<button>` elements with `aria-pressed`
  reflecting the active mark, so the state is announced rather than only shown.
- `immediatelyRender: false` to avoid a hydration mismatch.

**Sanitisation** (`src/lib/sanitize.ts`)
- Allowlist-based, deny-by-default, applied on write AND on render.
- Removes script/style/iframe/form/svg/meta bodies *with their contents*,
  strips every `on*` handler, and rejects `javascript:`, `data:` and
  protocol-relative URLs.
- Adds `rel="noopener noreferrer nofollow"` to every link and an `alt`
  attribute to every image.
- Idempotent, so applying it twice changes nothing.
- Derives `content_plain`, `word_count` and `reading_time_minutes` in one pass.

**Content model**
- Draft / in review / scheduled / published / archived, with scheduling.
- Categories, tags and related-scholarship linking (RLS-scoped, so only
  published scholarships can be linked).
- SEO title, description, canonical URL, noindex and sitemap controls.
- Revision snapshots are produced by the existing database trigger; verified to
  fire on both content and title changes.
- Delete requires `article.delete`; authors are limited by the UPDATE policy to
  their own drafts and cannot self-publish.

### Fixed — article body was silently discarded

The editor's hidden input carried the HTML, but React owned its `value`
attribute. Changing an unrelated field — the title — re-rendered the form,
React re-applied the remembered empty `defaultValue` to the attribute, and the
attribute write reset the property. The result: typing in the title wiped the
article body, and saving stored an empty article that still reported success.

The input now carries no `value` and no `defaultValue` at all; the editor
writes to it directly, so React has nothing to re-assert.

### Fixed — toolbar showed stale active state

TipTap 3 defaults `shouldRerenderOnTransaction` to `false`. The toolbar only
refreshed as a side effect of the word-count state changing, so toggling a
heading — which alters structure but not text — left the button looking
inactive and reported `aria-pressed="false"` even though the heading had been
applied. Now set to `true`.

### Fixed — `htmlToPlainText` merged words across block elements

`<p>One</p><p>Two</p>` became the single token `OneTwo`, which understated the
word count, shortened the reading time and corrupted the search index. Found by
a test written specifically to check for it. Block-level tags are now replaced
with a space before stripping.

### Dependency added

`@tiptap/extension-text-align@3.32.0` — the specification requires text
alignment, and no installed package provides it (StarterKit 3 bundles link,
underline, undoRedo and code blocks but not alignment). Version matches the
other TipTap packages exactly; no existing version was changed.

### Verified end to end — 23/23

Real browser session against the live database: editor mounts, toolbar reports
correct pressed state for bold and heading, table/heading/bold/list markup is
produced, save redirects to the editor with the session intact, stored content
contains the allowed markup with no script, `word_count` 13 and reading time
derived server-side, `content_plain` populated, an edit persists and triggers a
revision snapshot, and publish sets status and `published_at`. No hydration
mismatch. Fixtures deleted; the database holds no test records.

`npm run verify` exit 0: typecheck, lint, 185 tests, production build.

### Incident — repository deleted and recovered (2026-10-16)

The working directory `D:\xampp\htdocs\getscholarship` was deleted in two
stages: the working tree at 22:10, then `.git` at 22:34. At the worst point the
directory was completely empty and the local history was unrecoverable, because
the repository had **no remote**.

**Recovered.** Both deletions had gone to the Windows Recycle Bin on `D:`. The
repository was restored from `$R2NJU9I\.git` (copied, not moved, so the Bin
remained available as a fallback).

- `git fsck` reports no errors; all 5 commits are intact up to `96748c5`.
- All 89 tracked files restored from `HEAD`; `git diff` is empty and the tree
  is clean. Confirmed byte-identical (0 numstat lines, matching blob hashes).
- `.env.local` restored from `$RVU2LLS.local`.
- `node_modules` rebuilt with `npm ci`.

**No source work was lost.** The Recycle Bin was searched for files newer than
the last commit; the only such files were `.next` build artefacts and `.git`
internals. `HEAD` was already the latest source state.

### Fixed

- `npm run test:rls` could never have succeeded unattended: the script reads
  `process.env`, but nothing loaded `.env.local` into it. The script now runs
  `node --env-file=.env.local`.
- The first `npm ci` produced a **corrupt** `node_modules` (`TAR_ENTRY_ERROR`,
  leaving `eslint-config-next/dist/index.js` missing and breaking `npm run
  lint`). A clean reinstall fixed it. Watch for this on Windows.
- Four orphaned `next dev` / `npm run verify` Node processes from before the
  deletion were still running and holding the Next.js build lock; they were
  stopped.

### Changed

- `AGENTS.md` §1: the visual design reference is now
  <https://www.topuniversities.com/>. `ipassgenerator.online` is recorded as
  the functional reference for the administration CMS.

### 🔴 Resolved — Supabase project re-provisioned

Both previous Supabase projects returned NXDOMAIN from public DNS and had been
deleted (`whpozrnyressiznzdhpc`, the documented staging project, and
`cacqrlityxkmhfwyektv`). General connectivity was unaffected — `supabase.com`
returned 200 — so this was not a network fault.

Replaced with **`nnufigsnijqzcojnpyuw`**, linked via the Supabase CLI, and
applied all 19 migrations plus the seed with `supabase db push --include-seed`
(exit 0).

### Fixed — unqualified `citext` broke migrations on any freshly provisioned project

Replaying the migrations on a new project failed at migration 003 with
`type "citext" does not exist (SQLSTATE 42704)`.

Migration 001 creates `citext` in the `extensions` schema, which is the correct
Supabase convention, but 18 column definitions across migrations 003, 005, 007,
008, 009 and 015 referenced the bare type name. That resolved only because the
deleted project's `search_path` happened to include `extensions`. The CLI
connects through a temporary login role that does not, so the reference did not
resolve.

All 18 are now schema-qualified as `extensions.citext`, consistent with the
`extensions.gin_trgm_ops` operators the same migrations already used for the
pg_trgm indexes. This makes the migrations independent of session
`search_path` and safe to replay on any project.

### Verified on the new project

- `npm run test:rls` — **66 passed, 0 failed**; cleanup removed the 4 test users
  and 10 fixture records it created.
- `npm run verify` — exit 0: typecheck, lint, 95 unit tests, production build.
- Seeded reference data present: 6 roles, 24 permissions, 69 role-permissions,
  6 categories, 6 education levels, 9 academic fields, 19 site settings,
  14 navigation items, 14 homepage sections, 1 author.
- **No fabricated content:** 0 scholarships, 0 articles, 0 media assets.
- Public routes served against the live database: `/` 200, `/scholarships` 200,
  filtered search 200, thin taxonomy landing 404 (documented behaviour),
  unknown route 404. Homepage renders 64 KB of database-driven content.

Next up: Phase 4 — administration and CMS.

---

## [0.4.0] — 2026-10-15

Phase 3 (part 1): the core public website — design system, site chrome,
homepage, scholarship search, scholarship detail, and taxonomy landing pages.

### Added

**Design system** (`src/components/ui/`, `src/components/layout/`)
- Button (with Link and external variants), Badge, Alert, EmptyState, Skeleton,
  Pagination, layout primitives.
- Site header with responsive navigation and an accessible mobile menu; footer
  with database-driven columns and legal links.
- Every interactive element has a visible focus ring, and status is conveyed by
  text as well as by colour.

**Readers** — `src/lib/settings.ts`, `navigation.ts`, `homepage.ts`,
`taxonomy.ts`. All memoised per request with React `cache`.

**Pages**
- Homepage assembled from `homepage_sections`, with real aggregate statistics.
- `/scholarships` — server-side search with filters, sorting, pagination,
  shareable URLs and an honest empty state.
- `/scholarships/[slug]` — detail page.
- Four taxonomy landing routes over a shared renderer.

**Formatting** — `src/lib/format.ts`, with 26 unit tests covering currency,
deadlines and date parsing.

### Design decisions worth recording

**No `loading.tsx` in the scholarships segment.** A route-segment
`loading.tsx` opens a Suspense boundary above the page, so the shell is flushed
with `200` before the page resolves, and any `notFound()` below it renders the
404 UI with a `200` status — a soft 404.

Measured: with `loading.tsx` present, `/scholarships/nonexistent-slug` returned
`200` containing the 404 page. Without it, the same URL returns `404`. Correct
status codes beat a loading skeleton. If loading states return, wrap the results
in a `<Suspense>` inside the page, after the notFound() decision.

**Filtered search pages are `noindex, follow`.** Filter permutations are useful
to a visitor but must not flood the index with near-duplicates. The canonical
URL for a filtered page points at `/scholarships`.

**Taxonomy landing pages 404 when empty.** A page matching zero scholarships
would be thin content, so it is not published. The rationale is commented in
`taxonomy-landing.tsx` so it is not later mistaken for a bug.

**Homepage blocks with no content are omitted entirely**, rather than rendering
empty headings. The genuine "nothing published yet" case is handled once, in the
hero, with an explanation of the verification policy.

### Fixed

- **`locations` had no `description` column** (migration 019). It was the only
  taxonomy table created without one, and both `getTermBySlug` and
  `getLocations` select it, so every query failed with
  `42703 column locations.description does not exist`. Consequences:
  `/scholarships/location/texas` 404ed despite three matching scholarships, and
  the homepage's location block was silently empty. Found only by exercising the
  site — the reader logs the error and returns an empty list, which is the right
  failure mode but easy to miss.
- `error.tsx` required the `'use client'` directive; without it the whole
  `(public)` group failed to compile.
- A `<Link>` nested inside a `<Button>` in two places — invalid HTML and a
  nested interactive element. Replaced with `ButtonLink`.
- `TAXONOMY_KINDS` typed as `Record<string, TaxonomyKind>` made every lookup
  `TaxonomyKind | undefined` under `noUncheckedIndexedAccess`. Changed to
  `as const satisfies`.
- The mobile menu closed its panel from a `useEffect`, which the React 19 lint
  rule flags as a cascading render. Replaced with the documented pattern of
  adjusting state during render.

### Verified

Against the live database, using clearly-labelled fictional fixtures that were
deleted afterwards:

```
/                                       200
/scholarships                           200   5 scholarships listed
/scholarships?q=nursing                 200   correct result
/scholarships?deadline=closed           200   correct result
/scholarships?sort=amount_desc          200
/scholarships/education-level/[slug]    200
/scholarships/field/nursing             200
/scholarships/category/merit-based      200
/scholarships/location/texas            200   after migration 019
/scholarships/[slug]                    200
/scholarships/[closed scholarship]      200   shows "Applications have closed"
/scholarships/[draft]                   404   drafts stay invisible
/unknown-page                           404
```

Plus `npm run verify` clean and 95 unit tests passing.

---

## [0.3.0] — 2026-10-15

Phase 2b: the application data-access layer. Verified end-to-end against the
live database through the real Next.js request path, not against mocks.

### Added

**Typed database access**
- `supabase/scripts/generate-database-types.mjs` generates
  `src/types/database.ts` (38 tables, 4 views, 15 enums, 7 functions) by
  introspecting the live schema. It exists because `supabase gen types` requires
  CLI authentication, which is not available in every environment.
- All three Supabase clients are now typed against `Database`.

**Authorization** (`src/lib/auth/`)
- `session.ts` — identity from `auth.getClaims()` (signature-verified, never
  `getSession()`), plus roles, permissions and profile in one nested query,
  memoised per request with React `cache`.
- `guards.ts` — `requireUser`, `requireRole`, `requirePermission`,
  `requireAnyPermission`, `requireCmsUser`.
- `permissions.ts` — the role and permission vocabulary as compile-time unions,
  so a typo is a build error rather than a silently denied permission.

**Data access**
- `src/lib/db/errors.ts` — maps SQLSTATE/PostgREST codes to a typed
  `DatabaseError` with a `userMessage` that never leaks schema details.
- `src/features/scholarships/search-params.ts` — pure parsing, validation,
  canonical serialisation and RPC argument mapping.
- `src/features/scholarships/queries.ts` — search, detail, curated lists and
  related scholarships. Always uses the SESSION client, so RLS applies to our
  own queries exactly as it does to everyone else's.

**Tests** — 69 unit tests.

### Changed

Scholarship search moved from PostgREST `.or()` chains to a single SQL function,
`public.search_scholarships()`.

### Why search moved to SQL

Live verification found the PostgREST approach could not work correctly:

1. supabase-js `.order('published_at.desc.nullslast')` **appends** a direction,
   producing `published_at.desc.nullslast.asc` — a parse error.
2. Sorting by relevance requires ordering by `ts_rank(...)`, which is not a real
   column and cannot appear in PostgREST's `order=` at all.
3. Five taxonomy groups meant stacking `.or()` calls, each ANDed, which is easy
   to get subtly wrong.

One SQL function is a single round trip, gives correct rank ordering, and
returns the total count via `count(*) over ()`. It is `SECURITY INVOKER`, so the
caller's RLS still applies and drafts cannot leak.

PostgreSQL rejects a variable `OFFSET`, so pagination uses `row_number()`
windowing instead. The cost is materialising the ordered set rather than
skipping rows — noted for revisiting if the table grows.

### Fixed

- **`search-params.ts`**: `amountInput` used `.nullable()`, which rejects
  `undefined`. The object therefore failed `safeParse`, so **every search filter
  was silently discarded** and every request returned the default search.
  Rewritten so each field sanitises its own input and cannot fail.
- **`search-params.ts`**: filter lists were serialised as repeated query
  parameters, which silently collapse to a single value under
  `URLSearchParams.get()` and `Object.fromEntries()`. Now emitted as one
  comma-joined value.
- **`search-params.ts`**: filter lists are now sorted at parse time, so two
  visitors who pick the same filters in a different order get byte-identical
  canonical URLs.
- **Migration 018**: migration 013 granted INSERT/UPDATE/DELETE on
  `scholarship_sources` to `authenticated` but never SELECT, so no editor or
  administrator could read a scholarship's provenance at all — the verification
  workflow was unusable. Caught by the RLS suite.

### Security decision documented

**Migrations 016 → 017.** The public detail page must show source provenance,
but `scholarship_sources` is CMS-only because its `notes` column is editorial.

Migration 016 first created the view with `security_invoker = true`, which
changed nothing: under security invoker, anon still needed SELECT on the base
table and got `42501`. Migration 017 makes the view owner-executed instead, and
documents that this is deliberate:

- Exposed: `source_url`, `source_name`, `retrieved_at`, only for published
  scholarships.
- Not exposed: `notes`, and any draft/pending/archived record.
- Migration 017 ends with assertions that fail it if the view ever exposes
  `notes`, contains a non-published row, or if anon gains SELECT on the base
  table.

The alternative — granting anon SELECT on the base table and filtering with RLS
— would expose `notes` to every visitor, a strictly larger disclosure.

### Test methodology

The RLS suite grew to **66 assertions** and now covers the provenance view: anon
can read published provenance, cannot read draft provenance, the view has no
`notes` column, and neither anon nor a student can read the base table.

Two further assertions were corrected from status-code checks to data-state
checks — the same trap as before. A student's read of `scholarship_sources`
returns `200` with zero rows because RLS filtered it; that is correct, not a
failure.

### Verification

Run live, through the Next.js request path with the session cookie replayed:

```
Search cases:     17/17 correct (filters, sorting, paging, AND/OR, injection)
Curated lists:    featured 1, closing-soon 3, recent 3
Detail:           sources 1, taxonomy 5 groups, required docs
Related:          2
Auth (editor):    roles [editor], 14 permissions, audit.view denied
Auth (anonymous): no user, no roles, no permissions
RLS policy suite: 66 passed, 0 failed
Unit tests:       69 passed, 4 files
npm run verify:   typecheck, lint, test, build all clean
Database state:   0 scholarships, 0 articles, 0 users — fixtures removed
```

All fixtures were clearly-labelled fictional records and were deleted afterwards.
No fabricated scholarship data remains in the database.

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
