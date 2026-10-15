-- =============================================================================
-- 016_published_scholarship_sources_view.sql
--
-- The public scholarship detail page must show provenance: the official source
-- URL, who published it, and when it was last retrieved. That information
-- lives in `scholarship_sources`, which is deliberately CMS-only.
--
-- Granting anon SELECT on that table would also expose `notes`, which is
-- editorial commentary and must not be public. So this exposes exactly the
-- three columns a visitor is entitled to see, and only for published
-- scholarships.
--
-- Found by live verification: the detail query failed with
--   42501 permission denied for table scholarship_sources
-- because the embed joined a table anon cannot read at all.
-- =============================================================================

create or replace view public.published_scholarship_sources
with (security_invoker = true) as
  select
    ss.id,
    ss.scholarship_id,
    ss.source_url,
    ss.source_name,
    ss.retrieved_at
  from public.scholarship_sources ss
  join public.scholarships s on s.id = ss.scholarship_id
  where s.status = 'published'
    and s.archived_at is null;

comment on view public.published_scholarship_sources is
  'Public provenance for published scholarships. Excludes editorial notes.';

grant select on public.published_scholarship_sources to anon, authenticated;

-- The detail page no longer embeds scholarship_sources, so nothing else needs
-- the base table. anon keeps no privilege on it.
revoke all on public.scholarship_sources from anon;
