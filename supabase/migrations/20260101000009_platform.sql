-- =============================================================================
-- 009_platform.sql
-- Site configuration, navigation, homepage composition, advertising placement,
-- newsletter, contact, consent, redirects, audit logging and error reports.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- site_settings
--
-- Typed key/value store. NEVER store secrets here: this table is readable by
-- the browser for rows where is_public is true, and is a CMS-managed table, not
-- a secret vault. Secrets belong in environment variables.
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key         text primary key,
  value       jsonb,
  value_type  public.setting_value_type not null default 'string',
  -- Logical group used by the admin settings screen.
  "group"     text not null default 'general',
  label       text,
  description text,
  -- When true, readable by anonymous visitors through the Data API.
  is_public   boolean not null default false,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint site_settings_key_format check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$')
);

create index site_settings_group_idx on public.site_settings ("group");

comment on table public.site_settings is
  'Database-backed site configuration. Never store credentials or API keys here.';

select public.attach_updated_at_trigger('site_settings');

-- -----------------------------------------------------------------------------
-- navigation_items
-- -----------------------------------------------------------------------------
create table public.navigation_items (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,
  href              text not null,
  parent_id         uuid references public.navigation_items (id) on delete cascade,
  location          public.navigation_location not null default 'header',
  sort_order        integer not null default 0,
  is_visible        boolean not null default true,
  opens_in_new_tab  boolean not null default false,
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint navigation_items_label_not_blank check (char_length(btrim(label)) > 0),
  -- Internal links must be site-relative; external links must be absolute HTTPS.
  constraint navigation_items_href_valid check (
    href ~ '^/'
    or href ~ '^https://'
    or href ~ '^mailto:'
  ),
  constraint navigation_items_not_self_parent check (parent_id is null or parent_id <> id)
);

create index navigation_items_location_idx
  on public.navigation_items (location, sort_order)
  where is_visible;

select public.attach_updated_at_trigger('navigation_items');

-- -----------------------------------------------------------------------------
-- homepage_sections
--
-- The homepage is composed from these records so editors control ordering,
-- visibility, headings and item limits without a redeploy.
-- -----------------------------------------------------------------------------
create table public.homepage_sections (
  id          uuid primary key default gen_random_uuid(),
  key         citext not null unique,
  heading     text,
  subheading  text,
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  -- Section-specific options: item limit, layout, source query.
  config      jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index homepage_sections_order_idx
  on public.homepage_sections (sort_order)
  where is_visible;

select public.attach_updated_at_trigger('homepage_sections');

-- -----------------------------------------------------------------------------
-- ad_placements
-- -----------------------------------------------------------------------------
create table public.ad_placements (
  id                 uuid primary key default gen_random_uuid(),
  key                citext not null unique,
  display_name       text not null,
  description        text,
  is_enabled         boolean not null default false,
  -- Suppress the slot until the page has enough content, so ads never appear
  -- on thin pages.
  min_content_blocks integer not null default 0,
  sort_order         integer not null default 0,
  updated_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index ad_placements_enabled_idx on public.ad_placements (is_enabled);

select public.attach_updated_at_trigger('ad_placements');

-- -----------------------------------------------------------------------------
-- redirects
-- -----------------------------------------------------------------------------
create table public.redirects (
  from_path   text primary key,
  to_path     text not null,
  status_code integer not null default 301,
  is_active   boolean not null default true,
  hit_count   bigint not null default 0,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint redirects_from_valid check (from_path ~ '^/'),
  constraint redirects_to_valid check (to_path ~ '^/' or to_path ~ '^https://'),
  constraint redirects_no_loop check (from_path <> to_path),
  constraint redirects_status_valid check (status_code in (301, 302, 307, 308))
);

create index redirects_active_idx on public.redirects (is_active);

select public.attach_updated_at_trigger('redirects');

-- -----------------------------------------------------------------------------
-- newsletter_subscribers  (PRIVATE — never publicly readable)
-- -----------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  status            public.newsletter_status not null default 'pending',
  consent_given_at  timestamptz,
  -- Salted hash only; the raw IP is never stored.
  ip_hash           text,
  source            text,
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index newsletter_status_idx on public.newsletter_subscribers (status);

select public.attach_updated_at_trigger('newsletter_subscribers');

-- -----------------------------------------------------------------------------
-- contact_submissions  (PRIVATE)
-- -----------------------------------------------------------------------------
create table public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  subject     text not null,
  message     text not null,
  status      public.contact_status not null default 'new',
  handled_by  uuid references auth.users (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contact_message_not_blank check (char_length(btrim(message)) > 0),
  constraint contact_subject_not_blank check (char_length(btrim(subject)) > 0)
);

create index contact_status_idx on public.contact_submissions (status, created_at desc);

select public.attach_updated_at_trigger('contact_submissions');

-- -----------------------------------------------------------------------------
-- consent_records
--
-- Append-oriented. The newest row per visitor_id is the current preference.
-- visitor_id is a pseudonymous random id, never a raw IP or fingerprint.
-- -----------------------------------------------------------------------------
create table public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid not null,
  analytics     boolean not null default false,
  ads           boolean not null default false,
  functionality boolean not null default false,
  -- Bumped when the consent presentation changes materially.
  version       text not null default '1',
  source        public.consent_source not null default 'banner',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index consent_records_visitor_idx
  on public.consent_records (visitor_id, created_at desc);

select public.attach_updated_at_trigger('consent_records');

-- -----------------------------------------------------------------------------
-- content_reports
-- "Report incorrect information" on a scholarship or an article.
-- Exactly one target must be set.
-- -----------------------------------------------------------------------------
create table public.content_reports (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid references public.scholarships (id) on delete cascade,
  article_id     uuid references public.articles (id) on delete cascade,
  reporter_email citext,
  reason         public.report_reason not null,
  details        text,
  status         public.report_status not null default 'open',
  resolved_by    uuid references auth.users (id) on delete set null,
  resolved_at    timestamptz,
  resolution_note text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint content_reports_exactly_one_target check (
    (scholarship_id is not null)::int + (article_id is not null)::int = 1
  ),
  constraint content_reports_resolved_consistent check (
    (status in ('resolved', 'dismissed')) = (resolved_at is not null)
  )
);

create index content_reports_status_idx on public.content_reports (status, created_at desc);
create index content_reports_scholarship_idx on public.content_reports (scholarship_id);
create index content_reports_article_idx on public.content_reports (article_id);

select public.attach_updated_at_trigger('content_reports');

-- -----------------------------------------------------------------------------
-- audit_logs  (append-only)
--
-- Application roles may INSERT and SELECT (with permission) but never UPDATE or
-- DELETE. RLS in migration 010 enforces this.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  -- Null for system-initiated actions (scheduled jobs, cron).
  actor_id     uuid references auth.users (id) on delete set null,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  -- Previous and new state for the changed entity.
  before       jsonb,
  after        jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only record of privileged actions. No UPDATE or DELETE policy is granted.';

create index audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- Audit helper
--
-- SECURITY DEFINER so that logging works even when the caller's transaction
-- would otherwise be rolled back by an RLS failure. Revoke from PUBLIC below.
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action      text,
  p_entity_type text,
  p_entity_id   text default null,
  p_before      jsonb default null,
  p_after       jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id      bigint;
  v_user_id uuid;
  v_email   text;
begin
  v_user_id := auth.uid();

  if v_user_id is not null then
    select p.email into v_email from public.profiles p where p.id = v_user_id;
  end if;

  insert into public.audit_logs (
    actor_id, actor_email, action, entity_type, entity_id, before, after
  )
  values (
    v_user_id, v_email, p_action, p_entity_type, p_entity_id, p_before, p_after
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.write_audit_log(text, text, text, jsonb, jsonb) is
  'Appends a row to audit_logs attributed to the current user.';

revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb) from public;
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb)
  to authenticated, service_role;
