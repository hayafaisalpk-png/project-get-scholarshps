-- =============================================================================
-- 042_institutions.sql
--
-- Normalised institution (university / college / provider) data model.
-- Multiple scholarships can reference one institution, so a logo or name change
-- propagates to every associated scholarship.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- institutions
-- -----------------------------------------------------------------------------
create table if not exists public.institutions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             extensions.citext not null unique,
  institution_type text not null default 'other',
  logo_url         text,
  website_url      text,
  country          text,
  description      text,
  is_verified      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint institutions_name_not_blank check (char_length(btrim(name)) > 0),
  constraint institutions_type_allowed check (
    institution_type in ('university', 'college', 'government', 'foundation', 'other')
  ),
  constraint institutions_logo_url_https check (
    logo_url is null or logo_url ~ '^https?://'
  ),
  constraint institutions_website_url_https check (
    website_url is null or website_url ~ '^https?://'
  )
);

create index if not exists institutions_name_idx
  on public.institutions using gin (name extensions.gin_trgm_ops);
create index if not exists institutions_slug_idx on public.institutions (slug);

select public.attach_updated_at_trigger('institutions');

comment on table public.institutions is
  'Awarding bodies (universities, colleges, governments, foundations). Shared across scholarships so logos and names stay consistent.';

-- -----------------------------------------------------------------------------
-- Link scholarships to institutions
-- -----------------------------------------------------------------------------
alter table public.scholarships
  add column if not exists institution_id uuid
    references public.institutions (id) on delete set null;

create index if not exists scholarships_institution_idx
  on public.scholarships (institution_id);

-- -----------------------------------------------------------------------------
-- Data migration: one institution per distinct sponsor_name (exact match only).
-- No fuzzy merging; similarly named sponsors remain separate until verified.
-- -----------------------------------------------------------------------------
insert into public.institutions (name, slug, institution_type, is_verified)
select distinct s.sponsor_name,
       lower(regexp_replace(btrim(s.sponsor_name), '[^a-zA-Z0-9]+', '-', 'g')),
       'other',
       false
from public.scholarships s
where s.sponsor_name is not null
  and btrim(s.sponsor_name) <> ''
on conflict (slug) do nothing;

update public.scholarships s
set institution_id = i.id
from public.institutions i
where i.name = s.sponsor_name;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.institutions enable row level security;

drop policy if exists institutions_select_public on public.institutions;
create policy institutions_select_public on public.institutions
  for select
  using (true);

drop policy if exists institutions_insert_manage on public.institutions;
create policy institutions_insert_manage on public.institutions
  for insert
  with check (public.has_permission('scholarship.manage'));

drop policy if exists institutions_update_manage on public.institutions;
create policy institutions_update_manage on public.institutions
  for update
  using (public.has_permission('scholarship.manage'))
  with check (public.has_permission('scholarship.manage'));

drop policy if exists institutions_delete_manage on public.institutions;
create policy institutions_delete_manage on public.institutions
  for delete
  using (public.has_permission('scholarship.manage'));

-- -----------------------------------------------------------------------------
-- Grants (policy needs a backing grant to function)
-- -----------------------------------------------------------------------------
grant select on public.institutions to anon, authenticated;
grant insert, update, delete on public.institutions to authenticated;

-- -----------------------------------------------------------------------------
-- Refresh published view to expose institution_id
-- -----------------------------------------------------------------------------
create or replace view public.published_scholarships
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.title,
  s.sponsor_name,
  s.summary,
  s.award_amount_min_cents,
  s.award_amount_max_cents,
  s.award_amount_text,
  s.award_currency,
  s.number_of_awards,
  s.is_renewable,
  s.application_fee_cents,
  s.opens_at,
  s.deadline,
  s.is_rolling,
  s.status,
  s.verification_status,
  s.verified_at,
  s.last_reviewed_at,
  s.featured,
  s.image_id,
  s.published_at,
  s.updated_at,
  s.search_vector,
  public.scholarship_is_expired(s.status, s.deadline, s.is_rolling) as is_expired,
  public.scholarship_days_remaining(s.deadline) as days_remaining,
  s.institution_id
from public.scholarships s
where s.status = 'published';

comment on view public.published_scholarships is
  'Published scholarships with derived expiry data. RLS still applies via security_invoker.';