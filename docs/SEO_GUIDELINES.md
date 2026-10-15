# SEO Guidelines

Organic search is a primary business channel for GetScholarship. SEO is built
into the architecture, not retrofitted.

Status: **foundation implemented** (metadata base, template, robots/sitemap
scaffolding pending Phase 5).

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
| Paginated listings | Page 1 canonicalises to itself; pages 2+ self-canonicalise and carry `rel=next/prev` semantics via sitemap pagination, never canonicalised to page 1. |
| Filtered search (`?level=…`) | **Self-canonical**, `noindex, follow` — filter permutations must not flood the index. |
| Sorted search | Self-canonical, `noindex, follow`. |
| Draft / preview | `noindex, nofollow` and `X-Robots-Tag: noindex`. |
| Admin | `noindex, nofollow, noarchive` (set in `next.config.ts`). |
| Expired scholarship | `index, follow` — the page still has archival value. |

---

## 4. Sitemaps and robots.txt

- `src/app/sitemap.ts` produces a sitemap index with segmented child sitemaps
  (scholarships, articles, categories, levels, fields, locations, static).
- Only indexable, published URLs are included. Segments beyond 50,000 URLs use
  `generateSitemaps`.
- `src/app/robots.ts` emits `robots.txt` referencing the sitemap and disallowing
  `/admin`, `/api`, `/auth`, and any query-string search permutations.
- Sitemap entries use `lastModified` from real `updated_at` values.

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

## 11. Admin SEO controls *(planned, Phase 5)*

Editors with the appropriate permission may set per-page: SEO title, meta
description, canonical URL, index/noindex, social image, sitemap inclusion and
structured-data fields. Guardrails:

- Private, draft or expired-excluded content cannot be forced indexable.
- Sitemap inclusion defaults to on only for `published` records.
- A page cannot be excluded from the sitemap and indexable at the same time
  without an explicit override flag, which is audited.

---

## 12. Pre-launch SEO checklist

- [ ] Every public route exports unique metadata.
- [ ] Canonicals verified for all templates, including paginated listings.
- [ ] `robots.txt` correct; `/admin` and `/api` disallowed.
- [ ] Sitemaps generate without error and contain only indexable URLs.
- [ ] JSON-LD validated for every template that emits it.
- [ ] Redirect map checked; no redirect chains or loops.
- [ ] No `noindex` on pages that should rank; no index on drafts.
- [ ] Social images render at 1200×630.
- [ ] Hreflang only if multiple locales are actually published.
