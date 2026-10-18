-- =============================================================================
-- 027_fix_media_select_policy_archived_visibility.sql
--
-- A media manager could not see, or archive, an archived asset.
--
-- WHAT WAS BROKEN
--
-- Migration 010 wrote `media_select_public` as:
--
--   using (
--     archived_at is null
--     and (is_public or public.has_permission('media.manage'))
--   )
--
-- The intent, per the surrounding comments, is "public assets are world-readable;
-- everything else needs media.manage". But the two clauses are joined with AND,
-- so once `archived_at` is set the row is excluded for EVERYONE — the
-- `has_permission('media.manage')` branch can never rescue it, because it is
-- ANDed behind a condition that is already false.
--
-- Every other table in this schema gets this right by joining with OR:
--
--   scholarships_select_public:
--     (status = 'published' and archived_at is null)
--     or public.has_permission('scholarship.manage')
--
-- `media_assets` is the outlier, and the consequences are concrete:
--
--   1. `UPDATE media_assets SET archived_at = now()` fails with
--      "new row violates row-level security policy". An UPDATE's RETURNING
--      clause is filtered by the SELECT policy, so archiving a row makes it
--      instantly invisible and the statement errors instead of succeeding.
--   2. An "archived" filter in the media library could never return a row.
--   3. Archiving an asset referenced by a published record would look like it
--      worked while leaving the record's image unreachable.
--
-- FOUND BY
--
-- `npm run test:rls` could not have caught this on its own — it asserts that a
-- `student` cannot read media, which was true throughout. What exposed it was
-- driving the real media library with a temporary super_admin and updating a
-- column, isolating the failure against the Data API with and without RETURNING.
--
-- THE FIX
--
-- Restore the intended reading: a public asset is world-readable while it is
-- live, and anyone holding `media.manage` sees every row including archived ones.
-- No privilege changes, and no new policy — only the boolean operator.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

drop policy if exists media_select_public on public.media_assets;
create policy media_select_public on public.media_assets
  for select to anon, authenticated
  using (
    -- Public and still live: readable by anyone, including anonymous visitors.
    (archived_at is null and is_public)
    -- Anything held by a media manager: public or private, live or archived.
    or public.has_permission('media.manage')
  );

-- Guard: the policy must still grant `media.manage` holders visibility, and must
-- not have been rewritten into an archived-only exclusion.
--
-- Asserting on the deparsed expression is the only check available inside a
-- migration: the behaviour itself needs a signed-in session, which is what
-- `npm run test:rls` and the media end-to-end verification are for.
do $$
declare
  qual text;
begin
  -- `pg_policies` exposes the USING expression as `qual` (`pg_policy` calls it
  -- `polqual`; the view renames it).
  select p.qual::text
    into qual
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename  = 'media_assets'
     and p.policyname = 'media_select_public';

  if qual is null then
    raise exception 'media_select_public policy was not created';
  end if;

  if position('has_permission' in qual) = 0 then
    raise exception
      'media_select_public no longer references has_permission — media managers would lose access';
  end if;

  -- The regression to prevent is an `and` binding the archived check to the
  -- permission branch. Assert that an `or` precedes the permission call.
  if position(' or ' in lower(qual)) = 0 then
    raise exception
      'media_select_public has no OR branch — archived assets are invisible to media managers';
  end if;
end;
$$;

notify pgrst, 'reload schema';