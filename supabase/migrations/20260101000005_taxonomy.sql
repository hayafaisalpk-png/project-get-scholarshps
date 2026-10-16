-- =============================================================================
-- 005_taxonomy.sql
-- Shared vocabulary: scholarship categories, education levels, academic fields,
-- locations, free-form tags, and the article-side taxonomy.
--
-- All taxonomies share the same shape: slug, name, description, status,
-- sort_order, optional SEO overrides, and archived_at for soft deletion.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories (scholarship categories: merit-based, need-based, renewable, …)
-- -----------------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  description      text,
  icon             text,
  status           public.taxonomy_status not null default 'active',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  intro_content    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint categories_name_not_blank check (char_length(btrim(name)) > 0)
);

create index categories_status_sort_idx
  on public.categories (status, sort_order);

select public.attach_updated_at_trigger('categories');

-- -----------------------------------------------------------------------------
-- education_levels (high school, community college, undergraduate, …)
-- -----------------------------------------------------------------------------
create table public.education_levels (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  description      text,
  -- Higher rank sorts later (postgraduate above undergraduate).
  rank             integer not null default 0,
  status           public.taxonomy_status not null default 'active',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  intro_content    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint education_levels_name_not_blank check (char_length(btrim(name)) > 0)
);

create index education_levels_status_sort_idx
  on public.education_levels (status, sort_order);

select public.attach_updated_at_trigger('education_levels');

-- -----------------------------------------------------------------------------
-- academic_fields (STEM, nursing, computer science, business, arts, …)
-- -----------------------------------------------------------------------------
create table public.academic_fields (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  description      text,
  -- Broad grouping, e.g. 'stem' | 'health' | 'arts' | 'business' | 'other'.
  parent_group     text,
  status           public.taxonomy_status not null default 'active',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  intro_content    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint academic_fields_name_not_blank check (char_length(btrim(name)) > 0)
);

create index academic_fields_status_sort_idx
  on public.academic_fields (status, sort_order);
create index academic_fields_parent_group_idx
  on public.academic_fields (parent_group);

select public.attach_updated_at_trigger('academic_fields');

-- -----------------------------------------------------------------------------
-- locations (countries, US states, regions)
--
-- Self-referencing so regions can nest (e.g. Europe -> United Kingdom).
-- -----------------------------------------------------------------------------
create table public.locations (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  type             public.location_type not null,
  parent_id        uuid references public.locations (id) on delete set null,
  -- ISO 3166-1 alpha-2 for countries; USPS code for US states.
  code             text,
  status           public.taxonomy_status not null default 'active',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  intro_content    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint locations_name_not_blank check (char_length(btrim(name)) > 0),
  -- A location cannot be its own parent.
  constraint locations_not_self_parent check (parent_id is null or parent_id <> id)
);

create index locations_status_sort_idx on public.locations (status, sort_order);
create index locations_type_idx on public.locations (type);
create index locations_parent_idx on public.locations (parent_id);
create unique index locations_type_code_uniq
  on public.locations (type, code) where code is not null;

select public.attach_updated_at_trigger('locations');

-- -----------------------------------------------------------------------------
-- tags (free-form scholarship tags)
-- -----------------------------------------------------------------------------
create table public.tags (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  description      text,
  status           public.taxonomy_status not null default 'active',
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint tags_name_not_blank check (char_length(btrim(name)) > 0)
);

create index tags_status_idx on public.tags (status);

select public.attach_updated_at_trigger('tags');

-- -----------------------------------------------------------------------------
-- article_categories / article_tags
-- -----------------------------------------------------------------------------
create table public.article_categories (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  description      text,
  status           public.taxonomy_status not null default 'active',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint article_categories_name_not_blank check (char_length(btrim(name)) > 0)
);

create index article_categories_status_sort_idx
  on public.article_categories (status, sort_order);

select public.attach_updated_at_trigger('article_categories');

create table public.article_tags (
  id               uuid primary key default gen_random_uuid(),
  slug             extensions.citext not null unique,
  name             text not null,
  status           public.taxonomy_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  constraint article_tags_name_not_blank check (char_length(btrim(name)) > 0)
);

select public.attach_updated_at_trigger('article_tags');
