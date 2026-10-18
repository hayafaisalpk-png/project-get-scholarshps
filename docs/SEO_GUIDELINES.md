# SEO Guidelines

Organic search is a primary business channel for GetScholarship. SEO is built
into the architecture, not retrofitted.

Status: **complete** (Phase 3, plus Phase 5 increments 1–5: structured data,
segmented sitemaps, redirect enforcement, SEO admin controls with guardrails,
alt-text enforcement and the indexability sweep). Known gaps are listed in
`docs/DEVELOPMENT_ROADMAP.md`.

---

## 1. Principles

1. **One page, one topic.** Every indexable URL targets a distinct query.
2. **Accurate over clever.** Never use a schema type or claim the page does not
   actually satisfy. Misleading structured data risks manual action.
3. **No thin or doorway pages.** A landing page is only created if it has
   original introduction copy, real listings, and supporting content.
4. **No duplicate content.** Canonicals, consistent taxonomy and unique
   intros prevent competing URLs.
5. **No keyword stuffing.** Write for a student who is genuinely looking for
   money to study.

---

## 2. URL structure

| Page | Pattern |
| --- | --- |
| Homepage | `/` |
| Search results | `/scholarships` |
| Scholarship detail | `/scholarships/[slug]` |
| Category landing | `/scholarships/category/[slug]` |
| Education level | `/scholarships/education-level/[slug]` |
| Academic field | `/scholarships/field/[slug]` |
| Location | `/scholarships/location/[slug]` |
| Article listing | `/articles` |
| Article detail | `/articles/[slug]` |
| Static page | `/about`, `/contact`, `/help`, `/privacy`, `/terms` |

Rules: lowercase, hyphen-separated, no dates, no pagination in the canonical
path, stable slugs (never changed once published — a change requires a redirect).

---

## 3. Metadata

Every page exports `generateMetadata` or a `metadata` object.

- **Title:** unique, ≤ 60 characters, primary term first.
  Template: `%s | GetScholarship`.
- **Meta description:** unique, 120–160 characters, specific and truthful.
- **Canonical:** absolute URL to the canonical variant of the page.
- **Open Graph:** `og:title`, `og:description`, `og:image`, `og:url`, `og:type`.
- **Twitter:** `summary_large_image` with a real 1200×630 image.
- **Images:** every content image requires meaningful alt text.

### Canonicalisation rules

| Page | Canonical |
| --- | --- |
| Paginated listings | Page 1 canonicalises to itself; pages 2+ self-canonicalise and are indexable, never canonicalised to page 1. *(Verified in Phase 5 increment 5: `/articles` page 2+ was canonicalising to page 1, which is how a paginated index loses its tail. `rel=next`/`rel=prev` are deliberately not emitted — Google deprecated them in 2024.)* |
| Filtered search (`?level=…`) | **Self-canonical**, `noindex, follow` — filter permutations must not flood the index. |
| Sorted search | Self-canonical, `noindex, follow`. *(Implemented in Phase 5 increment 5. `relevance` and `newest` are the default presentation for an unfiltered page and do not count as a re-order; every other sort is `noindex, follow` and canonicalises to `/scholarships`.)* |
| Draft / preview | `noindex, nofollow` and `X-Robots-Tag: noindex`. |
| Admin | `noindex, nofollow, noarchive` (set in `next.config.ts`). |
| Expired scholarship | `index, follow` — the page still has archival value. |

---

## 4. Sitemaps and robots.txt

- `src/app/sitemap.xml/route.ts` produces a `<sitemapindex>` of segmented child
  sitemaps, split by **content type**: `pages`, `scholarships`, `articles`,
  `taxonomy`. A Route Handler is used rather than the `sitemap.(xml|ts)`
  convention because that convention can only emit a `<urlset>`, and
  `generateSitemaps` would leave `/sitemap.xml` asserting that a list of pages is
  a list of sitemaps.
- Each segment is served by `src/app/sitemaps/[segment]/route.ts`. The segment
  name is untrusted public input: only names the composer could itself have
  produced are accepted, and anything else is a **404 — never an empty
  `<urlset>`**, which would assert that a collection exists and is empty.
- A group with no indexable entries produces **no segment and no index entry**.
- Only indexable, published URLs are included. The 50,000-URL cap is enforced
  inside each group by `chunkEntries`, so a group that outgrows it gains numbered
  parts (`articles-1`, `articles-2`) and no file can exceed the cap.
- `src/app/robots.ts` emits `robots.txt` referencing the **index**, never a
  segment file directly, and disallowing `/admin`, `/api`, `/auth` and
  query-string search permutations.
- Sitemap entries use `lastModified` from real `updated_at` values; the index
  carries the newest `lastmod` per segment so a crawler can skip unchanged files.
- The union of every segment is asserted to equal the complete indexable set. A
  packaging bug that dropped a URL would produce a valid sitemap that silently
  de-indexes content.

---

## 5. Structured data (JSON-LD)

Emit JSON-LD **only** where the page genuinely satisfies the type. Each block
must be validated and must match visible content.

| Page | Types |
| --- | --- |
| Global site | `Organization`, `WebSite` (with `SearchAction` only if site search is crawlable) |
| Any page | `BreadcrumbList` |
| Homepage / landing | `WebPage`, `ItemList` for listings |
| Article | `BlogPosting` + `Person` (author) |
| Taxonomy landing | `CollectionPage` + `ItemList` |
| Scholarship detail | *Evaluated carefully — see below* |

### On the `Scholarship` schema type

There is no general, widely-supported schema.org type that search engines
guarantee will produce rich results for a scholarship listing. `Course` and
`EducationalOccupationalCredential` do not describe a scholarship award.

**Policy:** we will only emit a scholarship-specific type after confirming the
current schema.org vocabulary and the relevant search engine's guidelines
support it, and only if every required property is real. Otherwise the page
emits `WebPage` + `BreadcrumbList` only. **We will never promise rich results
merely because JSON-LD was added.**

Structured data must be validated before deployment (Schema Markup Validator
and the Rich Results Test) and re-validated whenever templates change.

**Status (Phase 5 increment 1).** Implemented in `src/lib/structured-data.ts`
and emitted on every public template. Both of the "only if accurate" rules above
are enforced in code rather than by convention:

- `Organization.logo` was **absent** while the project had no brand asset,
  because a logo URL that 404s is a fabricated claim about the publisher. **It is
  now present**: the operator supplied `logo-getscholarship.jpg`, and
  `src/lib/brand.ts` owns the derived transparent MARK that is served at
  `/brand/getscholarship-mark.png`. It is emitted as an `ImageObject` carrying the
  file's intrinsic width and height, with `Organization.image` pointing at the
  same file. The URL is asserted to resolve, not merely to be well-formed. The
  declared dimensions come from `src/lib/brand.ts` and are tested against the file
  on disk, so a replaced brand asset cannot leave stale dimensions in the markup.
  Note it points at the **mark, not the wordmark**: the site renders the name as
  live text, and a consumer reading this wants an identifier for the organisation
  rather than a picture of its name.
  Note the deliberate choice to point at the **derived PNG, not the JPEG master**:
  the logo should be the asset that is actually rendered.
- `WebSite` carries **no `SearchAction`**, because site search resolves to `?q=`,
  which is `noindex`. Advertising a search endpoint that asks not to be indexed
  is the same contradiction the noindex rule prevents.

The external validators named above have **not** been run. The documents are
asserted well-formed and self-consistent in unit tests and against real pages;
that is not the same as a consumer-side validation pass.

---

## 6. Landing page strategy

Indexable landing pages are created only where they add genuine value:

- **Education level** — Undergraduate Scholarships, Graduate Scholarships,
  Scholarships for High School Students.
- **Audience** — Scholarships for International Students (only where a
  scholarship explicitly permits them).
- **Basis** — Merit-Based Scholarships, Need-Based Scholarships, Renewable
  Scholarships.
- **Field** — STEM Scholarships, Nursing Scholarships, Computer Science
  Scholarships.
- **Location** — Scholarships by State, and country/region pages where volumes
  justify them.

Each landing page requires:
1. A unique, original 150–300 word introduction written by an editor.
2. A real, non-empty list of matching scholarships.
3. Supporting content (FAQs, application guidance, internal links).
4. Its own metadata and canonical URL.

A page with zero matching scholarships is **not published** and returns `404`.
Empty category pages are worse than no page.

---

## 7. Internal linking

- Breadcrumbs on every detail and listing page, mirrored in `BreadcrumbList`.
- Articles link to related scholarships; scholarship pages link to related
  articles (populated through `article_scholarships`).
- Taxonomies cross-link where genuinely relevant (e.g. level → field).
- Anchor text is descriptive; no "click here".
- Orphan pages are prevented by requiring an inbound link from navigation,
  a listing page, or a related-content block before publishing.

---

## 8. Performance and Core Web Vitals

| Metric | Target |
| --- | --- |
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |

Practices: Server Components by default; self-hosted fonts via `next/font`;
explicit `width`/`height` and `sizes` on every image; reserved space for ad
slots to prevent ad-induced CLS; no render-blocking third-party scripts;
consent-gated analytics and ads so they cannot delay LCP.

---

## 9. Content and E-E-A-T

- Named authors or a clearly identified editorial team with bios.
- Published and updated dates displayed.
- An editorial standards page explaining how scholarships are sourced and
  verified.
- "Report incorrect information" on scholarship pages, with a real resolution
  workflow and a visible status.
- No affiliate-driven ordering of listings. Ranking reflects relevance and
  usefulness to the student, not commission.

---

## 10. Advertising and SEO

- Sponsored content must be labelled `sponsored` and must not be presented as
  editorial.
- `rel="sponsored nofollow"` on paid outbound links.
- Ads must not be placed inside buttons or imitate navigation.
- No cloaking, no `robots.txt` manipulation to hide content from users while
  showing it to crawlers.

---

## 11. Admin SEO controls *(Phase 5 increment 4 — built)*

Editors with the appropriate permission may set per-page: SEO title, meta
description, canonical URL, index/noindex, social image, sitemap inclusion and
structured-data fields. Guardrails:

- Private, draft or expired-excluded content cannot be forced indexable.
- Sitemap inclusion defaults to on only for `published` records.
- A page cannot be excluded from the sitemap and indexable at the same time
  without an explicit override flag, which is audited.

**Status.** Implemented in two screens with two permissions, because deciding
what is indexable and rewriting the site's defaults are different powers:

- `/admin/seo` (`seo.manage`) — the cross-content indexability audit and the
  per-record control. Guardrails live in `src/features/seo/guardrails.ts` as pure
  functions and refuse **in words**: an unpublished record cannot be made
  indexable, and the message names the actual state and what to do about it.
- `/admin/settings` (`settings.manage`) — the SEO and social groups of
  `site_settings`. The other groups are Phase 4 work; one screen, so an editor
  learns one place.

**Not implemented:** the "explicit override flag" in the third guardrail. No such
column exists in the schema and none was added to satisfy the sentence; a CHECK
forbids the `noindex` + sitemap-listed combination outright, and the override
path is recorded here rather than assumed.

**Privacy boundary:** `newsletter.enabled`, `ads.enabled`,
`site.maintenance_mode` and `privacy.require_consent` live in the same table and
are readable by the query, but `EDITABLE_SETTING_KEYS` refuses them. A generic
settings form is exactly how a maintenance switch gets flipped by accident.

---

## 12. Pre-launch SEO checklist

- [x] Every public route exports unique metadata.
- [x] Canonicals verified for all templates, including paginated listings.
- [x] `robots.txt` correct; `/admin` and `/api` disallowed.
- [x] Sitemaps generate without error and contain only indexable URLs.
      *(`/sitemap.xml` is a `<sitemapindex>` of content-type segments; the union
      of every segment is asserted to equal the full indexable set.)*
- [ ] JSON-LD validated for every template that emits it. *(Emitted and
      internally consistent; the Schema Markup Validator and Rich Results Test
      have not been run.)*
- [ ] Redirect map checked; no redirect chains or loops. *(Enforcement shipped in
      Phase 5 increment 2. Chains are followed up to 5 hops; a loop is refused
      at write time and again at request time. A redirect edit takes up to 15
      seconds to reach live traffic, because the proxy caches the rule map in its
      own process and an action cannot clear another process's cache.)*
- [x] No `noindex` on pages that should rank; no index on drafts.
      *(Verified end-to-end in Phase 5 increment 5: 85 sweep checks, including
      every sitemap URL resolving 200 with none contradicting its own robots
      meta, drafts 404ing, and `/admin` + `/auth` sending `X-Robots-Tag`.)*
- [x] Social images render at 1200×630.
- [ ] Hreflang only if multiple locales are actually published.
