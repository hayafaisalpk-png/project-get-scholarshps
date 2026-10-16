-- =============================================================================
-- 007_scholarships.sql
-- The core domain table, its taxonomy joins, provenance and verification trail.
--
-- Money is stored as integer minor units (USD cents). Never use float for money.
-- =============================================================================

create table public.scholarships (
  id                uuid primary key default gen_random_uuid(),

  -- Immutable once published. A slug change requires a redirect entry.
  slug              extensions.citext not null unique,
  title             text not null,
  sponsor_name      text not null,

  -- Original editorial copy. Never a verbatim provider description.
  summary           text,
  description       text,

  -- Award
  award_amount_min_cents  bigint,
  award_amount_max_cents  bigint,
  -- For awards that are not a simple currency amount ("full tuition", "varies").
  award_amount_text       text,
  award_currency          text not null default 'USD',
  number_of_awards        integer,
  award_per_year          boolean not null default false,

  application_fee_cents   integer not null default 0,

  -- Renewal
  is_renewable       boolean not null default false,
  renewal_details    text,
  max_renewals       integer,

  -- Eligibility and application
  eligibility_requirements text,
  application_instructions text,
  required_documents       text[] not null default '{}',
  application_url          text,

  -- Timeline
  opens_at      date,
  deadline      date,
  is_rolling    boolean not null default false,

  -- Lifecycle
  status            public.scholarship_status not null default 'draft',
  published_at      timestamptz,
  archived_at       timestamptz,

  -- Verification / provenance
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  verified_by          uuid references auth.users (id) on delete set null,
  last_reviewed_at     timestamptz,

  -- Editorial
  featured         boolean not null default false,
  featured_until   timestamptz,
  internal_notes   text,
  image_id         uuid references public.media_assets (id) on delete set null,

  -- SEO
  seo_title        text,
  seo_description  text,
  noindex          boolean not null default false,

  -- Provenance of record
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Full-text search, weighted. Title and sponsor matter most.
  search_vector tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(sponsor_name, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(eligibility_requirements, '')), 'D') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored,

  constraint scholarships_title_not_blank check (char_length(btrim(title)) > 0),
  constraint scholarships_sponsor_not_blank check (char_length(btrim(sponsor_name)) > 0),

  constraint scholarships_amounts_valid check (
    award_amount_min_cents is null
    or award_amount_min_cents >= 0
  ),
  constraint scholarships_amount_range_valid check (
    award_amount_max_cents is null
    or award_amount_min_cents is null
    or award_amount_max_cents >= award_amount_min_cents
  ),
  constraint scholarships_awards_positive check (
    number_of_awards is null or number_of_awards > 0
  ),
  constraint scholarships_fee_non_negative check (application_fee_cents >= 0),

  -- A rolling scholarship has no fixed deadline; a dated one must have one.
  constraint scholarships_deadline_consistent check (
    (is_rolling and deadline is null)
    or (not is_rolling)
  ),

  -- Published records must have a publication timestamp and an official URL.
  constraint scholarships_published_complete check (
    status <> 'published'
    or (published_at is not null and application_url is not null)
  ),

  -- Only verified or explicitly unverified content may go live; "pending"
  -- and "disputed" must be resolved first.
  constraint scholarships_verified_to_publish check (
    status <> 'published'
    or verification_status in ('verified', 'unverified')
  ),

  -- Applications must use HTTPS so credentials are never sent in clear text.
  constraint scholarships_application_url_https check (
    application_url is null
    or application_url ~ '^https://'
  )
);

comment on table public.scholarships is
  'Scholarship records. Expired records keep their page and history; never delete them.';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

-- Default public listing: newest first among published rows only.
create index scholarships_published_idx
  on public.scholarships (published_at desc)
  where status = 'published';

-- Deadline browsing / "closing soon".
create index scholarships_deadline_idx
  on public.scholarships (deadline)
  where status = 'published' and deadline is not null;

create index scholarships_status_idx    on public.scholarships (status);
create index scholarships_updated_idx  on public.scholarships (updated_at desc);
create index scholarships_sponsor_idx   on public.scholarships (sponsor_name);

-- Amount sorting / filtering.
create index scholarships_amount_idx
  on public.scholarships (award_amount_max_cents desc nulls last)
  where status = 'published';

-- Homepage featured block.
create index scholarships_featured_idx
  on public.scholarships (featured, published_at desc)
  where status = 'published' and featured = true;

-- Full-text search.
create index scholarships_search_idx
  on public.scholarships using gin (search_vector);

-- Trigram fallback for typo-tolerant title matching.
create index scholarships_title_trgm_idx
  on public.scholarships using gin (title extensions.gin_trgm_ops);

select public.attach_updated_at_trigger('scholarships');

-- -----------------------------------------------------------------------------
-- Join tables
-- -----------------------------------------------------------------------------

create table public.scholarship_categories (
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  category_id    uuid not null references public.categories (id) on delete cascade,
  primary key (scholarship_id, category_id)
);

create index scholarship_categories_category_idx
  on public.scholarship_categories (category_id);

create table public.scholarship_tags (
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  tag_id         uuid not null references public.tags (id) on delete cascade,
  primary key (scholarship_id, tag_id)
);

create index scholarship_tags_tag_idx on public.scholarship_tags (tag_id);

create table public.scholarship_education_levels (
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  education_level_id uuid not null references public.education_levels (id) on delete cascade,
  primary key (scholarship_id, education_level_id)
);

create index scholarship_education_levels_level_idx
  on public.scholarship_education_levels (education_level_id);

create table public.scholarship_fields (
  scholarship_id   uuid not null references public.scholarships (id) on delete cascade,
  academic_field_id uuid not null references public.academic_fields (id) on delete cascade,
  primary key (scholarship_id, academic_field_id)
);

create index scholarship_fields_field_idx
  on public.scholarship_fields (academic_field_id);

create table public.scholarship_locations (
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  location_id    uuid not null references public.locations (id) on delete cascade,
  primary key (scholarship_id, location_id)
);

create index scholarship_locations_location_idx
  on public.scholarship_locations (location_id);

-- -----------------------------------------------------------------------------
-- Provenance and verification trail
-- -----------------------------------------------------------------------------

create table public.scholarship_sources (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  source_url     text not null,
  source_name    text not null,
  retrieved_at   timestamptz,
  notes          text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint scholarship_sources_url_https check (source_url ~ '^https://')
);

create index scholarship_sources_scholarship_idx
  on public.scholarship_sources (scholarship_id);

select public.attach_updated_at_trigger('scholarship_sources');

create table public.scholarship_verification_logs (
  id                 uuid primary key default gen_random_uuid(),
  scholarship_id     uuid not null references public.scholarships (id) on delete cascade,
  checked_by         uuid references auth.users (id) on delete set null,
  checked_at         timestamptz not null default now(),
  result             public.verification_result not null,
  previous_deadline  date,
  new_deadline       date,
  notes              text,
  created_at         timestamptz not null default now()
);

create index scholarship_verification_logs_scholarship_idx
  on public.scholarship_verification_logs (scholarship_id, checked_at desc);

-- -----------------------------------------------------------------------------
-- Derived helpers
-- -----------------------------------------------------------------------------

-- True when a published scholarship is past its deadline and not rolling.
-- Used to render the "expired" badge without changing the stored status.
--
-- STABLE (not IMMUTABLE) because it reads current_date.
create or replace function public.scholarship_is_expired(
  p_status public.scholarship_status,
  p_deadline date,
  p_is_rolling boolean
)
returns boolean
language sql
stable
as $$
  select p_status = 'published'
     and not p_is_rolling
     and p_deadline is not null
     and p_deadline < current_date;
$$;

-- Days until the deadline. Negative once past. NULL for rolling awards.
create or replace function public.scholarship_days_remaining(p_deadline date)
returns integer
language sql
stable
as $$
  select case when p_deadline is null then null
              else (p_deadline - current_date) end;
$$;

comment on function public.scholarship_is_expired(public.scholarship_status, date, boolean) is
  'True when a published, non-rolling scholarship is past its deadline.';

-- -----------------------------------------------------------------------------
-- Public listing view
--
-- security_invoker = true is essential: without it the view would execute with
-- the definer's privileges and silently bypass RLS on the base table.
-- -----------------------------------------------------------------------------
create view public.published_scholarships
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
    public.scholarship_days_remaining(s.deadline) as days_remaining
  from public.scholarships s
  where s.status = 'published';

comment on view public.published_scholarships is
  'Published scholarships with derived expiry data. RLS still applies via security_invoker.';
