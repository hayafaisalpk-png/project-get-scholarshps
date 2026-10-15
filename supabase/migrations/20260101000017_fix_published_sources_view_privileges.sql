-- =============================================================================
-- 017_fix_published_sources_view_privileges.sql
--
-- Corrective migration.
--
-- Problem discovered by live verification: migration 016 created
-- `published_scholarship_sources` with `security_invoker = true`. Under
-- security invoker, reading the view executes with the CALLER's privileges, so
-- anonymous requests still needed SELECT on `scholarship_sources` and failed
-- with 42501. The invoker view therefore achieved nothing.
--
-- DELIBERATE PRIVILEGE DECISION
--
-- This view intentionally runs as its owner (security definer), NOT as the
-- caller. That is a conscious trade-off and is documented so a future reviewer
-- does not "fix" it back:
--
--   Exposed: exactly three columns — source_url, source_name, retrieved_at —
--   and only for scholarships where status = 'published'. That is precisely
--   the provenance a visitor is entitled to see on a public scholarship page.
--
--   Not exposed: `scholarship_sources.notes`, which is editorial commentary,
--   and any row belonging to a draft, pending, archived or unpublished record.
--
--   The residual risk is that the view bypasses the RLS policy on the base
--   table, which is CMS-only. That risk is bounded by the WHERE clause below,
--   which is the single place a draft could ever leak from and is covered by
--   the assertions at the end of this migration.
--
-- The alternative — granting anon SELECT on the base table and filtering with
-- RLS — would expose the `notes` column to every visitor, which is a strictly
-- larger disclosure than the one made here.
-- =============================================================================

drop view if exists public.published_scholarship_sources;

create view public.published_scholarship_sources as
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
  'Public provenance for published scholarships. Owner-executed; excludes notes and all non-published records.';

revoke all on public.published_scholarship_sources from public;
grant select on public.published_scholarship_sources to anon, authenticated;

-- The base table remains entirely CMS-only.
revoke all on public.scholarship_sources from anon;

-- ---------------------------------------------------------------------------
-- Assertions: fail the migration if the view can expose anything it must not.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  -- 1. The view must not expose the editorial `notes` column.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'published_scholarship_sources'
      and column_name = 'notes'
  ) then
    raise exception 'published_scholarship_sources must not expose editorial notes';
  end if;

  -- 2. The view must never contain a row for a non-published scholarship.
  select count(*) into leaked
  from public.published_scholarship_sources v
  join public.scholarships s on s.id = v.scholarship_id
  where s.status <> 'published' or s.archived_at is not null;

  if leaked > 0 then
    raise exception 'published_scholarship_sources leaked % non-published row(s)', leaked;
  end if;

  -- 3. anon must hold no privilege on the base table.
  if has_table_privilege('anon', 'public.scholarship_sources', 'SELECT') then
    raise exception 'anon must not hold SELECT on public.scholarship_sources';
  end if;
end;
$$;
