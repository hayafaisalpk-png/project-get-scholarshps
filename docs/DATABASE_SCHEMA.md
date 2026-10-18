# Database Schema

Status: **IMPLEMENTED and applied** to the project
`nnufigsnijqzcojnpyuw` (PostgreSQL 17.11, Storage v1.80.2, GoTrue v2.197.0).
27 migrations, 39 tables, RLS verified by 91 live assertions
(`npm run test:rls`).

> Re-provisioned 2026-10-16. The previous project `whpozrnyressiznzdhpc` was
> deleted; all migrations were replayed from scratch onto the replacement
> project. See `docs/CHANGELOG.md`.

This document describes the deployed structure. It was written as a design
first and revised as testing found real defects — see `docs/CHANGELOG.md` 0.2.0.

Database: **Supabase PostgreSQL**. All migrations live in
`supabase/migrations/` as version-controlled SQL.

---

## 1. Global conventions

| Rule | Detail |
| --- | --- |
| Primary keys | `uuid` with `gen_random_uuid()` default |
| Timestamps | `created_at timestamptz not null default now()`, `updated_at` via trigger |
| Slugs | `citext`-safe lowercase, unique per table, immutable once published |
| Enums | Native Postgres `enum` types for statuses; changing them later requires a migration |
| Money | `integer`/`bigint` minor units (USD cents) — never float |
| Soft delete | `archived_at timestamptz` instead of `DELETE`, to preserve history |
| Naming | `snake_case` tables, plural; join tables `<a>_<b>` |
| RLS | Enabled on **every** table reachable from the Data API |

---

## 2. Entity relationship overview

```
auth.users (Supabase managed)
      │ 1:1
      ▼
 profiles ──< user_roles >── roles ──< role_permissions >── permissions
      │
      ├──< audit_logs
      └──< authors

 scholarships ──< scholarship_categories >── categories
      │      ──< scholarship_tags >───────── tags
      │      ──< scholarship_education_levels >── education_levels
      │      ──< scholarship_fields >──── academic_fields
      │      ──< scholarship_locations >── locations
      │      ──< scholarship_sources
      │      ──< scholarship_verification_logs
      │      ──< content_reports
      │
      └──(referenced by)── articles.related_scholarships

 articles ──< article_categories >── article_categories (taxonomy)
      │  ──< article_tags >──────── tags
      │  ──< article_revisions
      │  ──< article_reviews
      │  └── author_id → authors

 media_assets        site_settings      navigation_items
 homepage_sections   newsletter_subscribers   contact_submissions
 consent_records     redirects          ad_placements
 content_pages       (static + legal pages, public read of active rows)
```

---

## 3. Identity and permissions

### `profiles`
Mirrors `auth.users` with profile-only data. **Never stores passwords.**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users(id)` on delete cascade |
| `email` | `text` | For admin display only |
| `full_name` | `text` | |
| `avatar_url` | `text` | |
| `status` | enum | `active`, `suspended`, `pending` |
| `last_sign_in_at` | `timestamptz` | |
| `created_at` / `updated_at` | `timestamptz` | |

### `roles`
`id uuid` PK, `key text unique` (`super_admin`, `admin`, `editor`, `author`,
`reviewer`, `student`), `name`, `description`, `is_system boolean` (system
roles cannot be deleted).

### `permissions`
`id uuid` PK, `key text unique` (e.g. `scholarship.publish`,
`article.review`, `user.manage`, `settings.manage`), `description`.

### `role_permissions`
`role_id` FK, `permission_id` FK, composite PK.

### `user_roles`
`user_id` FK → `auth.users`, `role_id` FK, composite PK, `granted_by`,
`granted_at`.

---

## 4. Taxonomy

Shared shape across taxonomies: `id`, `slug (unique)`, `name`, `description`,
`status`, `sort_order`, `seo_*`, `created_at`, `updated_at`, `archived_at`.

| Table | Notes |
| --- | --- |
| `categories` | Scholarship categories: merit-based, need-based, renewable, … |
| `education_levels` | High school, community college, undergraduate, graduate, doctoral |
| `academic_fields` | STEM, nursing, computer science, business, arts, … |
| `locations` | US states, countries, regions. `type` enum: `country`, `state`, `region` |
| `tags` | Free-form scholarship tags |
| `article_categories` | Editorial categories |
| `article_tags` | Editorial tags |

`locations` uses a self-referencing `parent_id` so regions can nest, plus
`iso_code` for countries and `state_code` for US states.

---

## 5. Scholarships

### `scholarships` (core table)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `slug` | `citext` | **unique**, immutable once published |
| `title` | `text` | not null |
| `sponsor_name` | `text` | Provider or organisation |
| `summary` | `text` | Original editorial summary (not copied) |
| `description` | `text` | Rich details |
| `award_amount_min` | `bigint` | USD cents |
| `award_amount_max` | `bigint` | USD cents, nullable |
| `award_amount_text` | `text` | For non-numeric awards ("up to full tuition") |
| `number_of_awards` | `integer` | Nullable — only when verified |
| `application_fee` | `numeric` | `0` only when verified as free |
| `is_renewable` | `boolean` | |
| `renewal_details` | `text` | |
| `eligibility_requirements` | `text` | |
| `application_instructions` | `text` | |
| `required_documents` | `text[]` | |
| `application_url` | `text` | **Verified official URL**, not null when published |
| `opens_at` | `date` | |
| `deadline` | `date` | Index; nullable for rolling awards |
| `is_rolling` | `boolean` | |
| `status` | enum | `draft`, `pending_review`, `published`, `expired`, `archived` |
| `published_at` | `timestamptz` | |
| `archived_at` | `timestamptz` | |
| `verification_status` | enum | `unverified`, `pending`, `verified`, `disputed` |
| `verified_at` | `timestamptz` | |
| `last_reviewed_at` | `timestamptz` | Shown to users |
| `featured` | `boolean` | Homepage feature flag |
| `featured_until` | `timestamptz` | Auto-unfeature |
| `internal_notes` | `text` | Never exposed publicly |
| `image_id` | `uuid` | FK → `media_assets` |
| `created_by` / `updated_by` | `uuid` | FK → `auth.users` |
| `created_at` / `updated_at` | `timestamptz` | |

**Key indexes**

```sql
-- Public listing + filtering
CREATE INDEX scholarships_published_idx
  ON scholarships (published_at DESC)
  WHERE status = 'published';

CREATE INDEX scholarships_deadline_idx
  ON scholarships (deadline)
  WHERE status = 'published' AND deadline IS NOT NULL;

CREATE INDEX scholarships_status_idx  ON scholarships (status);
CREATE INDEX scholarships_featured_idx ON scholarships (featured, published_at DESC)
  WHERE status = 'published';
```

### Full-text search

```sql
ALTER TABLE scholarships ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(sponsor_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(eligibility_requirements, '')), 'D')
  ) STORED;

CREATE INDEX scholarships_search_idx ON scholarships USING gin (search_vector);
```

Search uses `websearch_to_tsquery` against the weighted vector, with
`ts_rank` driving relevance sorting.

### Join tables

`scholarship_categories`, `scholarship_tags`, `scholarship_education_levels`,
`scholarship_fields`, `scholarship_locations` — each `(scholarship_id, x_id)`
composite PK, FKs with `on delete cascade`, plus an index on the non-leading
column for reverse lookups.

### `scholarship_sources`
Provenance. `scholarship_id` FK, `source_url`, `source_name`,
`retrieved_at`, `notes`. Multiple rows per scholarship are allowed.

### `scholarship_verification_logs`
Audit trail of verification. `scholarship_id`, `checked_by`, `checked_at`,
`result` enum (`confirmed`, `updated`, `deadline_extended`, `disputed`,
`unreachable`), `previous_deadline`, `new_deadline`, `notes`.

### `content_reports`
Student-submitted error reports. `scholarship_id` or `article_id` (exactly one,
enforced by a check constraint), `reporter_email`, `reason`, `details`,
`status` enum (`open`, `reviewing`, `resolved`, `dismissed`), `resolved_by`,
`resolved_at`.

---

## 6. Articles

### `articles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `slug` | `citext` | unique |
| `title` | `text` | not null |
| `excerpt` | `text` | |
| `content` | `text` | **Sanitized HTML** (server-side allowlist) |
| `content_plain` | `text` | Derived plain text for search/reading time |
| `word_count` | `integer` | Maintained by trigger or application |
| `reading_time_minutes` | `integer` | |
| `status` | enum | `draft`, `in_review`, `scheduled`, `published`, `archived` |
| `author_id` | `uuid` | FK → `authors` |
| `editor_id` | `uuid` | FK → `auth.users`, nullable |
| `featured_image_id` | `uuid` | FK → `media_assets` |
| `social_image_id` | `uuid` | FK → `media_assets` |
| `published_at` | `timestamptz` | |
| `scheduled_for` | `timestamptz` | For `scheduled` status |
| `reviewed_at` | `timestamptz` | |
| `seo_title` / `seo_description` | `text` | Fall back to title/excerpt |
| `canonical_url` | `text` | |
| `noindex` | `boolean` | Default false |
| `allow_sitemap` | `boolean` | Default true |
| `created_by` / `updated_by` | `uuid` | |
| `created_at` / `updated_at` | `timestamptz` | |

**Indexes:** unique on `slug`; `(status, published_at DESC)`;
`(status, scheduled_for)` partial for `scheduled`; GIN on `search_vector`.

### `article_revisions`
`article_id` FK, `revision_number integer`, `title`, `content`, `excerpt`,
`changed_by`, `change_note`, `created_at`. Unique `(article_id, revision_number)`.

### `article_reviews`
`article_id` FK, `reviewer_id` FK, `decision` enum (`approved`, `changes_requested`,
`rejected`), `notes`, `created_at`.

### `authors`
Public bylines. `id`, `slug`, `full_name`, `bio`, `avatar_url`, `user_id`
(nullable FK → `auth.users`), `is_active`.

### `article_scholarships` *(relates articles to scholarships)*
`article_id` FK, `scholarship_id` FK, composite PK, `sort_order`.

---

## 7. Media

### `media_assets`
`id`, `storage_path` (unique), `public_url`, `file_name`, `mime_type`,
`file_size` (bytes), `width`, `height`, `alt_text`, `caption`, `attribution`,
`folder`, `uploaded_by`, `created_at`, `updated_at`.

Indexes on `mime_type`, `created_at DESC`, and a trigram index on `file_name`
for search.

**Storage buckets:** `public` (published media) and `private` (unpublished
uploads, originals pending review). Policies enforce that writes require an
authenticated user with `media.upload` and reads match the bucket.

---

## 8. Platform configuration

### `site_settings`
Key/value with typed access: `key text primary key`, `value jsonb`,
`value_type enum`, `group text`, `is_public boolean`, `updated_by`, `updated_at`.
Never store secrets here. Supported groups: `general`, `seo`, `social`,
`newsletter`, `contact`, `ads`, `privacy`, `verification`, `publishing`.

### `navigation_items`
`id`, `label`, `href`, `parent_id` (self-FK), `location` enum (`header`,
`footer_column_1..4`, `legal`), `sort_order`, `is_visible`, `opens_in_new_tab`,
`created_at`, `updated_at`.

### `homepage_sections`
`id`, `key text unique` (`hero`, `featured`, `deadlines`, `levels`, …),
`heading`, `subheading`, `is_visible`, `sort_order`, `config jsonb`
(item limit, source query, layout), `updated_by`, `updated_at`.

### `ad_placements`
`id`, `key text unique` (`homepage_top`, `search_results`, `detail_inline`,
`article_sidebar`), `display_name`, `is_enabled`, `min_content_blocks`
(prevent ads appearing on thin pages), `created_at`, `updated_at`.

### `redirects`
`from_path` (PK, unique), `to_path`, `status_code` (301/302), `is_active`,
`hit_count`, `created_by`, `created_at`, `updated_at`.

### `newsletter_subscribers`
`id`, `email citext unique`, `status` enum (`pending`, `subscribed`,
`unsubscribed`, `bounced`), `consent_given_at`, `source`, `ip_hash`,
`unsubscribed_at`, `created_at`. **Private — never publicly readable.**

### `newsletter_subscribers`
`id`, `email citext unique`, `status` enum (`pending`, `subscribed`,
`unsubscribed`, `bounced`), `consent_given_at`, `ip_hash` (salted hash only — a
raw IP is never stored), `source`, `unsubscribed_at`, `created_at`, `updated_at`.
**Private — revoked from every client role.** Read and written through the
service-role client only, so `requirePermission('newsletter.manage')` is the sole
application boundary and there is no RLS second layer.

Rows land in `pending` and stay there: no mail provider is configured, so no
confirmation can be sent and nothing has been confirmed.
**Private.** No privilege at all for `anon`; `SELECT` and `UPDATE` for
`authenticated` granted in migration 023 and gated by `contact.manage` (policy
added in 022). No `DELETE` — correspondence is not erased by one CMS action.
Written only by `submitContactAction` through the service-role client, so
validation is the sole bound.

### `content_pages` *(migration 021)*
Database-driven static and legal pages — About, Help, Privacy, Terms, Editorial
Standards. `AGENTS.md` §2.8 forbids hardcoding CMS content in components, and
these five documents change far more often than code does.

`id`, `slug citext unique`, `title`, `excerpt`, `body` (**sanitized HTML**),
`status` enum (`active`, `inactive`), `sort_order`,
`seo_title` / `seo_description` / `canonical_url` / `noindex`, `updated_by`,
`created_at`, `updated_at`.

Public read of `status = 'active'` rows only; writing needs `settings.manage`
(or `seo.manage` for updates). `SELECT`, `INSERT` and `UPDATE` are granted to
`authenticated` but `DELETE` is not. An inactive page 404s for visitors without a
dangling link, which is how a legal page is withdrawn safely. Seeded with draft
copy in migration 021 — **requires legal review before launch**.

### `content_reports` privilege note
Migrations 010/013 shipped the INSERT policy but, after the blanket revoke, no
`anon` INSERT privilege — so the public report form failed silently for every
visitor. Fixed by migration 024. This class of bug (a policy with no underlying
grant) is unreachable by reading policies alone; `npm run test:rls` now asserts
the positive path explicitly.

### `contact_submissions` privilege note *(migration 028)*
The same defect class, fourth occurrence. Migration 022 created both the SELECT
and the UPDATE policy for `contact_submissions`, and documented that granting
UPDATE is what stops the inbox growing unbounded. But migration 013's blanket
revoke was only ever undone for SELECT (migration 023), so no UPDATE privilege
ever existed. PostgreSQL checks the privilege before the policy: triage failed
with `42501` for an administrator holding `contact.manage`.

Migration 028 grants `UPDATE` to `authenticated` (never `anon`) and asserts both
`SELECT` and `UPDATE` with `pg_catalog.has_table_privilege`. `DELETE` remains
withheld from every application role.

**Why it survived 91/91 green assertions:** every `contact_submissions` assertion
was a SELECT or a "cannot", and the "author CANNOT triage" denial passed for the
wrong reason — refused by the missing grant rather than by the policy. A denial
test that cannot distinguish "blocked by the boundary" from "the feature does not
work at all" proves nothing. `npm run test:rls` now pairs each triage denial
with a positive case for a permitted identity.

### `content_reports` triage CHECK
```sql
check ((status in ('resolved','dismissed')) = (resolved_at is not null))
```
A closed status and a resolution timestamp must be written **together**. An UPDATE
that sets `status` alone fails with `23514`. `buildReportStatusPatch` in
`src/lib/validation/inbox.ts` constructs the pair, and a unit test restates this
CHECK as an assertion so the two cannot drift apart.

### `media_assets` SELECT policy *(migration 027)*
Migration 010 wrote the public read as

```sql
archived_at is null and (is_public or has_permission('media.manage'))
```

The `AND` makes the permission branch unreachable once `archived_at` is set, so an
archived row was invisible to **everyone** — including a media manager. Because an
UPDATE's `RETURNING` clause is filtered by the SELECT policy, `UPDATE … SET
archived_at = now()` failed with `new row violates row-level security policy`, i.e.
the archive action could not work at all. Corrected to:

```sql
(archived_at is null and is_public)
or public.has_permission('media.manage')
```

Every other table in this schema already joined these two branches with `OR`.
Covered by five assertions in `npm run test:rls`, including one that reads an
archived row back as a manager and one that confirms anon still cannot.

### `sitemap_taxonomy_terms()` *(migration 025)*
Returns `(kind, slug, listings)` for taxonomy landing pages that have at least one
**published** scholarship, so `sitemap.xml` never lists a page that
`taxonomyMetadata` marks `noindex` for being thin.

SECURITY INVOKER (the default), `stable`, `search_path` pinned. RLS therefore
applies to the underlying tables: `scholarships` exposes only published records to
anon/authenticated, so the counts are counts of published scholarships and the
function cannot be used to infer how many drafts exist. An owner-executed function
would have leaked exactly that — the mistake migration 017 was written to avoid
for the provenance view.

Aggregating here rather than per term in the application keeps sitemap generation
at a constant query count; `locations` alone would otherwise mean hundreds of
round trips. Granted to `anon`, `authenticated` and `service_role`.

### `newsletter.enabled` is public *(migration 026)*
Seeded `is_public = false`, which meant the anonymous page could never read it and
the signup block could never render. The value is not sensitive — the presence or
absence of the form already reveals it. The `ads.*` and `analytics.*` settings stay
private on purpose: those decide whether a script loads in the browser, and a
public flag would expose the publisher ID.

### `consent_records`
`id`, `visitor_id` (pseudonymous cookie/UUID), `analytics boolean`,
`ads boolean`, `functionality boolean`, `version text`, `source` enum
(`banner`, `settings`), `created_at`, `updated_at`. Append-oriented: the latest
row per `visitor_id` is the current preference.

### `audit_logs`
`id bigserial`, `actor_id` (FK, nullable for system actions), `actor_email`,
`action text` (e.g. `scholarship.publish`), `entity_type`, `entity_id`,
`before jsonb`, `after jsonb`, `ip_address`, `user_agent`,
`created_at timestamptz`. **Insert-only for app roles; no UPDATE or DELETE.**

---

## 9. Row Level Security

### Helper functions (`SECURITY DEFINER`, `search_path` pinned)

```sql
-- Roles held by the current authenticated user, read from the verified JWT.
create function public.current_user_roles()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select ur.role_id from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

create function public.current_user_has_role(v_role text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.roles r
    join public.user_roles ur on ur.role_id = r.id
    where r.key = v_role and ur.user_id = auth.uid()
  );
$$;
```

`SECURITY DEFINER` is required so policies do not recurse; `search_path` is
pinned to defeat search-path hijacking.

### `redirects` SELECT privilege *(migration 029)*
The fifth instance of the same defect class. Migration 013 granted

```sql
grant insert, update, delete on public.redirects to authenticated;
```

and omitted `SELECT`, so the four `redirects` policies were live except the read
path: an administrator holding `seo.manage` could write a rule and could not read
one back, and `/admin/redirects` rendered its error state. Migration 029 grants
SELECT to `authenticated` (never `anon`) and asserts it.

Request-time enforcement reads this table with the **service-role** client from
`src/features/redirects/store.ts`, because the proxy has no session cookie to
authorise with. That is deliberate: widening the table to `anon` would publish the
entire redirect map and make it a place to store spam links.

### `media_assets` alt-text constraint *(migration 030)*
```sql
check (is_decorative or alt_text is not null)
```
An asset is either described or explicitly decorative; the third state is
unrepresentable. Before this, an empty `alt_text` meant both "decorative" and
"nobody wrote it", so no constraint could require either. Existing rows are
backfilled `is_decorative = true` — the reading that asserts nothing untrue
about undescribed content. Covered by live assertions in `npm run test:rls`.

**No image is rendered on the public site yet**, so this constraint governs the
media library rather than what a visitor experiences. The featured-image picker
(Phase 4) is what makes it user-facing.

### Policy matrix (summary)

| Table | anon | authenticated | Notes |
| --- | --- | --- | --- |
| `scholarships` | SELECT `status='published'` | SELECT published; full CRUD with permission | Anonymous cannot write |
| `articles` | SELECT public & due | SELECT unpublished w/ `article.manage`/`article.review`/own draft | Authors limited to own `draft`/`in_review` |
| `categories`, `tags`, `education_levels`, `academic_fields`, `locations` | SELECT `status='active'` | SELECT; write with permission | |
| `media_assets` | SELECT (public only) | SELECT; INSERT with `media.upload` | |
| `content_reports` | INSERT only | SELECT with `report.manage`; INSERT; UPDATE with `report.manage` | anon INSERT granted in migration 024 |
| `profiles` | none | SELECT own; UPDATE own | SELECT restored in migration 014 |
| `user_roles` | none | SELECT own | No write policy at all; managed server-side |
| `newsletter_subscribers` | none | **none** | Zero client privileges |
| `contact_submissions` | none | SELECT + UPDATE with `contact.manage` | No INSERT/DELETE for any client role; INSERT goes through the service-role action. UPDATE granted in migration 028 |
| `redirects` | none | SELECT with `seo.manage`/`settings.manage`; write with `seo.manage` | SELECT granted in migration 029. Request-time enforcement reads it with the service-role client, not a client role |
| `audit_logs` | none | SELECT with `audit.view` | No INSERT/UPDATE/DELETE policy for any app role |
| `site_settings` | SELECT where `is_public` | SELECT + write with `settings.manage` | |
| `redirects` | none | SELECT/manage with permission | |

**Global rule:** no `INSERT`/`UPDATE`/`DELETE` policy is ever created for the
`anon` role, except `INSERT` on `content_reports` and `consent_records`.

### Permission model (corrected in migration 012)

`article.manage` originally doubled as both "edit any article" and "authored
article", which let authors publish their own drafts. The capability is now
split so that each role grant and each policy branch mean the same thing:

| Permission | Grants | Held by |
| --- | --- | --- |
| `article.create` | Create a new own draft | author, reviewer, editor, admin |
| `article.edit_own` | Edit **own** article, only while `draft`/`in_review` | author, editor, admin |
| `article.manage` | Edit **any** article in any status | editor, admin |
| `article.publish` | Publish / schedule / archive | editor, admin |
| `article.review` | Read unpublished content, record review decisions | reviewer, editor, admin |

The author UPDATE branch is bounded three ways — permission, ownership, and
resulting status — so self-publishing fails even if the grant is widened.

### Table privileges vs. RLS

RLS is the primary control. Table grants are a second layer, tightened in
migration 013:

- Supabase grants `ALL` to `anon`/`authenticated` by default. That was revoked.
- **RLS does not filter `TRUNCATE`**, so the default `TRUNCATE` privilege was
  particularly dangerous. `anon` and `authenticated` now hold no `TRUNCATE`,
  `TRIGGER` or `REFERENCES` on any public table.
- `anon` holds `SELECT` only, plus `INSERT` on exactly two tables.
- `alter default privileges` was updated so future tables do not re-inherit
  blanket grants.
- Migration 013 ends with an assertion that fails the migration if a dangerous
  privilege reappears.

### Testing RLS

`supabase/tests/rls-policy-tests.mjs` runs 59 live assertions against five
identities. Run with `npm run test:rls`.

Negative assertions verify **resulting data state via the service role**, not
HTTP status codes: PostgREST returns `204` (not `403`) when RLS filters a row so
zero rows match, and a role may legitimately be unable to read back the very row
it just modified when read anonymously.

---

## 10. Seed data

`supabase/seed.sql` is safe by construction:
- Uses `on conflict do nothing` / `on conflict … do update` only.
- Contains no `DELETE`, `TRUNCATE`, or `DROP`.
- Inserts roles, permissions, taxonomy and settings.
- Optional development example content is gated behind an explicit flag so it
  can never be mistaken for real scholarship data.

**Development example data must be clearly labelled as fictional.** Real
scholarship records may only be added through the verified editorial workflow.
