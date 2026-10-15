-- =============================================================================
-- 018_grant_source_read_to_authenticated.sql
--
-- Corrective migration.
--
-- Found by supabase/tests/rls-policy-tests.mjs:
--   FAIL  admin CAN read the sources base table including notes  <- status=403
--
-- Migration 013 revoked all client privileges and then re-granted the minimum
-- required. For `scholarship_sources` it granted INSERT, UPDATE and DELETE to
-- `authenticated` but never SELECT, so the RLS policy
-- `scholarship_sources_cms` could not take effect — the table privilege is
-- checked first and denied the statement outright.
--
-- The net effect was that no editor or administrator could read a scholarship's
-- provenance in the CMS, which makes the verification workflow unusable.
--
-- anon deliberately still has NO access to this table: public provenance is
-- served by the owner-executed `published_scholarship_sources` view.
-- ---------------------------------------------------------------------------

grant select on public.scholarship_sources to authenticated;

-- Guard: authenticated must be able to read it, anon must not.
do $$
begin
  if not has_table_privilege('authenticated', 'public.scholarship_sources', 'SELECT') then
    raise exception 'authenticated still lacks SELECT on public.scholarship_sources';
  end if;

  if has_table_privilege('anon', 'public.scholarship_sources', 'SELECT') then
    raise exception 'anon must not hold SELECT on public.scholarship_sources';
  end if;
end;
$$;
