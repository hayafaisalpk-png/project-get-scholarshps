-- =============================================================================
-- 039_article_faq_items.sql
-- Frequently-asked-questions blocks on articles, so an article can publish the
-- questions it answers and have that described in JSON-LD.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The column
-- -----------------------------------------------------------------------------
--
-- `jsonb`, not a child table. The FAQ block is read and written whole, never
-- queried across articles ("which articles mention scholarships?"), so a
-- child table would buy referential integrity the application cannot use and
-- cost a second query on the page that has to render it.
--
-- The default is an empty array, not NULL: "this article has no FAQ" is a
-- real state, and it should not have to be distinguished from "nobody has
-- looked yet".
--
-- Existing rows pick up the default without a backfill.
alter table public.articles
  add column if not exists faq_items jsonb not null default '[]'::jsonb;

comment on column public.articles.faq_items is
  'FAQ items for the article. An array of {question, answer} objects with plain-text answers.';

-- -----------------------------------------------------------------------------
-- The shape check
-- -----------------------------------------------------------------------------
--
-- A CHECK constraint cannot contain a subquery, and validating each element of
-- a JSON array is exactly that. So the rule lives in an IMMUTABLE function and
-- the constraint calls it.
--
-- The function is the same rule the application enforces in Zod
-- (`src/lib/validation/faq.ts`); the database is still the authority.
create or replace function public.article_faq_items_valid(p_items jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    case
      -- Guard first: `jsonb_array_length` raises an error on a non-array, and
      -- SQL does not promise to short-circuit an AND. The CASE does.
      when p_items is null or jsonb_typeof(p_items) <> 'array' then false
      else
        jsonb_array_length(p_items) <= 20
        and not exists (
          select 1
          from jsonb_array_elements(p_items) as item
          where
            -- A missing key yields SQL NULL, and `jsonb_typeof(NULL)` is NULL,
            -- so the comparison would be NULL rather than true. COALESCE turns
            -- "not a string" into a definite false.
            coalesce(jsonb_typeof(item -> 'question'), '') <> 'string'
            or btrim(item ->> 'question') = ''
            or coalesce(jsonb_typeof(item -> 'answer'), '') <> 'string'
            or btrim(item ->> 'answer') = ''
        )
    end;
$$;

comment on function public.article_faq_items_valid(jsonb) is
  'True when p_items is an array of at most 20 {question, answer} objects, both non-blank strings.';

-- The helper is called by a CHECK constraint, so the role performing the
-- insert needs EXECUTE on it. It reveals nothing: it only inspects the value
-- it is given.
revoke execute on function public.article_faq_items_valid(jsonb) from public;
grant execute on function public.article_faq_items_valid(jsonb) to anon, authenticated, service_role;

-- Drop first so the migration is safe to re-run against a database where an
-- earlier version of this rule exists with a different definition.
alter table public.articles
  drop constraint if exists articles_faq_items_valid;

alter table public.articles
  add constraint articles_faq_items_valid
  check (public.article_faq_items_valid(faq_items));

-- -----------------------------------------------------------------------------
-- The public listing view
-- -----------------------------------------------------------------------------
--
-- `published_articles` is the reader-facing projection of the table. The
-- column is appended last so the existing column order — and therefore the
-- view's grants and any column references — are untouched.
--
-- CREATE OR REPLACE VIEW keeps the privileges granted on the view in
-- migration 013.
create or replace view public.published_articles
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
    a.seo_description,
    a.faq_items
  from public.articles a
  where public.article_is_public(a.status, a.published_at);
