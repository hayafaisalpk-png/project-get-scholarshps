# Database Schema

Status: **IMPLEMENTED and applied** to the staging project
`whpozrnyressiznzdhpc` (PostgreSQL 17.11). 14 migrations, 38 tables, RLS
verified by 59 live assertions (`npm run test:rls`).

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

### `contact_submissions`
`id`, `name`, `email`, `subject`, `message`, `status` enum
(`new`, `in_progress`, `resolved`, `spam`), `handled_by`, `created_at`.

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

### Policy matrix (summary)

| Table | anon | authenticated | Notes |
| --- | --- | --- | --- |
| `scholarships` | SELECT `status='published'` | SELECT published; full CRUD with permission | Anonymous cannot write |
| `articles` | SELECT public & due | SELECT unpublished w/ `article.manage`/`article.review`/own draft | Authors limited to own `draft`/`in_review` |
| `categories`, `tags`, `education_levels`, `academic_fields`, `locations` | SELECT `status='active'` | SELECT; write with permission | |
| `media_assets` | SELECT (public only) | SELECT; INSERT with `media.upload` | |
| `profiles` | none | SELECT own; UPDATE own | SELECT restored in migration 014 |
| `user_roles` | none | SELECT own | No write policy at all; managed server-side |
| `newsletter_subscribers` | none | **none** | Zero client privileges |
| `contact_submissions` | none | **none** | Zero client privileges |
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
