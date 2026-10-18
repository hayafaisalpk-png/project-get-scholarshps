-- =============================================================================
-- 025_sitemap_taxonomy_terms.sql
--
-- Aggregates, in SQL, which taxonomy landing pages are worth submitting.
--
-- WHY THIS EXISTS
--
-- A taxonomy landing page is `noindex` when it is THIN — zero published
-- scholarships (see `taxonomyMetadata` in
-- `src/features/scholarships/components/taxonomy-landing.tsx`). A sitemap that
-- listed thin pages anyway would contradict the pages' own robots meta, which is
-- exactly the kind of internal inconsistency search engines are taught to
-- distrust.
--
-- The obvious implementation is one `search_scholarships` call per term. That is
-- wrong at scale: `locations` alone is a large table, so sitemap generation would
-- issue hundreds of queries on every regeneration. Doing the aggregation here
-- keeps the sitemap at a CONSTANT query count regardless of taxonomy size.
--
-- WHY SECURITY INVOKER (the default)
--
-- This must run as the CALLING role, not as the owner, so that Row Level
-- Security applies to the underlying tables. `scholarships` has a policy that
-- exposes only published records to anon/authenticated, so the counts below are
-- automatically counts of PUBLISHED scholarships. Nothing here needs a
-- hand-written `status = 'published'` predicate, and nothing can be used to
-- infer how many drafts exist — an owner-executed function would have leaked
-- exactly that, which is the mistake migration 017 was written to avoid for the
-- provenance view.
--
-- Only terms that are themselves visible are returned, for the same reason.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.sitemap_taxonomy_terms()
returns table (
  kind       text,
  slug       text,
  listings   bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select 'category', c.slug, count(distinct s.id)
    from public.categories c
    join public.scholarship_categories sc on sc.category_id = c.id
    join public.scholarships s on s.id = sc.scholarship_id
   group by c.slug

  union all

  select 'education-level', e.slug, count(distinct s.id)
    from public.education_levels e
    join public.scholarship_education_levels se on se.education_level_id = e.id
    join public.scholarships s on s.id = se.scholarship_id
   group by e.slug

  union all

  select 'field', f.slug, count(distinct s.id)
    from public.academic_fields f
    join public.scholarship_fields sf on sf.academic_field_id = f.id
    join public.scholarships s on s.id = sf.scholarship_id
   group by f.slug

  union all

  select 'location', l.slug, count(distinct s.id)
    from public.locations l
    join public.scholarship_locations sl on sl.location_id = l.id
    join public.scholarships s on s.id = sl.scholarship_id
   group by l.slug;
$$;

comment on function public.sitemap_taxonomy_terms() is
  'Taxonomy landing pages with their published-scholarship counts. RLS applies, so only publicly visible scholarships are counted.';

-- Callable by the roles that render public pages. Revoke from PUBLIC first, as
-- with every other helper in migration 004.
revoke execute on function public.sitemap_taxonomy_terms() from public;
grant execute on function public.sitemap_taxonomy_terms() to anon, authenticated, service_role;

notify pgrst, 'reload schema';