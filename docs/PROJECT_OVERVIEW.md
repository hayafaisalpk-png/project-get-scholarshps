# GetScholarship — Project Overview

**Production URL:** <https://getscholarship.online>
**Canonical host policy:** `getscholarship.online` (apex); `www.getscholarship.online` 301-redirects to the apex.

---

## 1. Purpose

GetScholarship helps students find scholarships, grants, financial aid and
college-funding resources, and teaches them how to apply successfully.

The platform has two audiences:

| Audience | Needs |
| --- | --- |
| **Students / visitors** | Fast, trustworthy scholarship discovery; clear deadlines and eligibility; honest editorial guidance; easy application. |
| **Editors / administrators** | A reliable CMS to enter, verify, review, schedule and publish scholarship and article content with a full audit trail. |

Organic search is a primary business channel. Advertising (AdSense) is a
secondary revenue stream and must never degrade content quality or trust.

---

## 2. Core value propositions

1. **Verified information.** Every scholarship carries provenance: an official
   source URL, the date it was last checked, and a verification status. Facts
   sourced externally are visually distinguished from our own editorial advice.
2. **Structured discovery.** Scholarships are not free-text blobs. They are
   filterable by education level, academic field, location, award amount,
   deadline, category and eligibility — so a student can narrow thousands of
   results to the ones they can actually apply for.
3. **Honest lifecycle.** Deadlines pass. A scholarship becomes *expired*, but
   its page, facts and history remain. Nothing is silently deleted.
4. **Educational content.** Original guides on applications, financial aid,
   essays and budgeting, written by editors — never generated and auto-published.

---

## 3. Principal user journeys

### Visitor
1. Lands on the homepage (hero + search) or arrives from a search engine on a
   category/location landing page.
2. Searches or filters scholarships (level, field, location, amount, deadline).
3. Opens a scholarship detail page, checks eligibility and the deadline.
4. Follows the verified official application link (external).
5. Optionally reads a related guide, then subscribes to the newsletter.

### Registered student
Same as above, plus managing an account. Students have **no** administrative
capability.

### Author / Editor / Reviewer / Administrator
1. Signs in to `/admin`; navigation is filtered by role.
2. Author creates or edits a draft article or scholarship record.
3. Reviewer approves or returns content per the configured workflow.
4. Administrator publishes, schedules, expires or archives records, manages
   taxonomy, media, users, settings, ads and audit logs.
5. Every privileged action is written to `audit_logs`.

---

## 4. Scope

### In scope
- Public website: homepage, scholarship search, scholarship detail pages,
  taxonomy landing pages (category / education level / academic field /
  location), article listing and detail, static informational pages.
- Authentication: register, verify email, sign in/out, password reset/update.
- Admin CMS: dashboard, scholarships, articles, taxonomy, media, users,
  newsletter, navigation, homepage composition, SEO, ads, analytics, settings,
  audit logs.
- Scholarship verification and provenance tracking.
- SEO: metadata, canonicals, sitemaps, `robots.txt`, redirects, JSON-LD.
- Consent management gating GA4 and AdSense.
- Automated tests (Vitest + Playwright).

### Out of scope (explicitly)
- Processing scholarship applications on behalf of students.
- Any claim of affiliation with a scholarship provider.
- Any feature that requires the platform to hold funds or disburse awards.
- Scraping third-party scholarship data without a licence or permission.

---

## 5. Content integrity commitments

These are product requirements, not aspirations:

- We never publish a scholarship we have not verified against an official
  source, or that is explicitly marked unverified in the CMS.
- We never republish a provider's description verbatim. Editorial summaries are
  original; provider facts are attributed and linked.
- Expired scholarships keep their pages and are labelled, so historical
  search traffic and student research remain useful.
- We never display invented statistics. Dashboard and homepage numbers come
  from live queries.
- We clearly separate **facts** (externally sourced, dated) from **guidance**
  (our editorial advice, uncompensated).

---

## 6. Success measures

| Area | Measure |
| --- | --- |
| Discovery | Scholarship pages served, search usage, filter usage, apply-button click-through |
| SEO | Indexed pages, non-brand organic sessions, ranking on category/location queries |
| Trust | Verification coverage of published scholarships, error-report resolution time |
| Engagement | Article read depth, newsletter signups, return visitors |
| Revenue | AdSense impressions and RPM on high-intent pages |
| Quality | Core Web Vitals, error rate, accessibility conformance |

---

## 7. Related documents

| Document | Contents |
| --- | --- |
| `docs/SYSTEM_ARCHITECTURE.md` | Layers, request flow, caching, module layout |
| `docs/DATABASE_SCHEMA.md` | Tables, relationships, indexes, RLS summary |
| `docs/SECURITY_POLICY.md` | Threat model, controls, reporting |
| `docs/SEO_GUIDELINES.md` | Metadata, structured data, indexation rules |
| `docs/DEVELOPMENT_ROADMAP.md` | Phases, status, acceptance criteria |
| `docs/DEPLOYMENT_GUIDE.md` | Supabase, Vercel, DNS, migrations, rollback |
| `docs/CHANGELOG.md` | Dated record of changes |
| `AGENTS.md` | Permanent agent instructions |
