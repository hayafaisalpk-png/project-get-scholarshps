-- =============================================================================
-- 008_articles.sql
-- Editorial content: authors, articles, revision history, review workflow and
-- the article <-> scholarship relationship used for related-content blocks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- authors (public bylines)
-- -----------------------------------------------------------------------------
create table public.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        citext not null unique,
  full_name   text not null,
  bio         text,
  avatar_url  text,
  title       text,
  -- Optional link to a login account, when the author is also a CMS user.
  user_id     uuid unique references auth.users (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint authors_name_not_blank check (char_length(btrim(full_name)) > 0)
);

create index authors_active_idx on public.authors (is_active);

select public.attach_updated_at_trigger('authors');

-- -----------------------------------------------------------------------------
-- articles
-- -----------------------------------------------------------------------------
create table public.articles (
  id             uuid primary key default gen_random_uuid(),
  slug           citext not null unique,
  title          text not null,
  excerpt        text,

  -- Sanitized HTML. The allowlist is enforced server-side before storage.
  content        text not null default '',
  -- Plain-text derivative used for search, excerpts and reading time.
  content_plain  text not null default '',

  word_count              integer not null default 0,
  reading_time_minutes    integer not null default 0,

  status         public.article_status not null default 'draft',

  author_id      uuid references public.authors (id) on delete set null,
  editor_id      uuid references auth.users (id) on delete set null,

  featured_image_id uuid references public.media_assets (id) on delete set null,
  social_image_id   uuid references public.media_assets (id) on delete set null,

  published_at   timestamptz,
  scheduled_for  timestamptz,
  reviewed_at    timestamptz,
  archived_at    timestamptz,

  -- SEO
  seo_title        text,
  seo_description  text,
  canonical_url    text,
  noindex          boolean not null default false,
  allow_sitemap    boolean not null default true,

  created_by     uuid references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  search_vector tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(content_plain, '')), 'C')
  ) stored,

  constraint articles_title_not_blank check (char_length(btrim(title)) > 0),
  constraint articles_word_count_valid  check (word_count >= 0),
  constraint articles_reading_valid     check (reading_time_minutes >= 0),

  -- Published articles must be fully specified.
  --
  -- Deliberately does NOT include `published_at <= now()`: a CHECK constraint
  -- is evaluated only when the row is written, so a time-based predicate here
  -- would be misleading (it would not re-evaluate as time passes) and would
  -- couple writes to the clock. Visibility for scheduled content is handled by
  -- public.article_is_public() at read time instead.
  constraint articles_published_complete check (
    status <> 'published'
    or (
      published_at is not null
      and char_length(btrim(content)) > 0
    )
  ),

  -- A scheduled article must carry a future publish time.
  constraint articles_scheduled_has_time check (
    status <> 'scheduled' or scheduled_for is not null
  ),

  -- Noindexed pages must not also be advertised for sitemap inclusion.
  constraint articles_noindex_not_in_sitemap check (
    not (noindex and allow_sitemap)
  )
);

comment on table public.articles is
  'Editorial articles. content holds server-sanitized HTML.';

create index articles_published_idx
  on public.articles (published_at desc)
  where status = 'published';

create index articles_status_idx  on public.articles (status);
create index articles_author_idx  on public.articles (author_id);
create index articles_scheduled_idx
  on public.articles (scheduled_for)
  where status = 'scheduled';

create index articles_review_idx
  on public.articles (status, created_at desc)
  where status = 'in_review';

create index articles_search_idx on public.articles using gin (search_vector);

select public.attach_updated_at_trigger('articles');

-- -----------------------------------------------------------------------------
-- article_categories / article_tags joins
-- -----------------------------------------------------------------------------
create table public.article_category_links (
  article_id         uuid not null references public.articles (id) on delete cascade,
  article_category_id uuid not null references public.article_categories (id) on delete cascade,
  primary key (article_id, article_category_id)
);

create index article_category_links_category_idx
  on public.article_category_links (article_category_id);

create table public.article_tag_links (
  article_id  uuid not null references public.articles (id) on delete cascade,
  tag_id      uuid not null references public.article_tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create index article_tag_links_tag_idx on public.article_tag_links (tag_id);

-- -----------------------------------------------------------------------------
-- article_scholarships (related content, both directions)
-- -----------------------------------------------------------------------------
create table public.article_scholarships (
  article_id     uuid not null references public.articles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  sort_order     integer not null default 0,
  primary key (article_id, scholarship_id)
);

create index article_scholarships_scholarship_idx
  on public.article_scholarships (scholarship_id);

-- -----------------------------------------------------------------------------
-- Revision history
-- -----------------------------------------------------------------------------
create table public.article_revisions (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references public.articles (id) on delete cascade,
  revision_number integer not null,
  title           text not null,
  excerpt         text,
  content         text not null default '',
  content_plain   text not null default '',
  change_note     text,
  changed_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint article_revisions_number_positive check (revision_number > 0),
  constraint article_revisions_unique unique (article_id, revision_number)
);

create index article_revisions_article_idx
  on public.article_revisions (article_id, revision_number desc);

-- -----------------------------------------------------------------------------
-- Review workflow
-- -----------------------------------------------------------------------------
create table public.article_reviews (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.articles (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  decision    public.review_decision not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index article_reviews_article_idx
  on public.article_reviews (article_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Revision helper
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER is required: without an INSERT policy on article_revisions,
-- a plain trigger would run with the invoking user's privileges and every
-- article update would fail. search_path is pinned.
create or replace function public.record_article_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Snapshot the previous state when an article's body or title changes.
  if (
    tg_op = 'UPDATE'
    and (new.content is distinct from old.content or new.title is distinct from old.title)
  ) then
    insert into public.article_revisions (
      article_id, revision_number, title, excerpt, content, content_plain,
      change_note, changed_by
    )
    values (
      old.id,
      coalesce((
        select max(revision_number) + 1
        from public.article_revisions r
        where r.article_id = old.id
      ), 1),
      old.title,
      old.excerpt,
      old.content,
      old.content_plain,
      'Automatic snapshot',
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger articles_snapshot_revision
  before update on public.articles
  for each row execute function public.record_article_revision();

-- -----------------------------------------------------------------------------
-- Public listing view
-- -----------------------------------------------------------------------------
create view public.published_articles
with (security_invoker = true) as
  select
    a.id,
    a.slug,
    a.title,
    a.excerpt,
    a.content,
    a.author_id,
    a.featured_image_id,
    a.social_image_id,
    a.published_at,
    a.updated_at,
    a.reading_time_minutes,
    a.word_count,
    a.seo_title,
    a.seo_description
  from public.articles a
  where public.article_is_public(a.status, a.published_at);
