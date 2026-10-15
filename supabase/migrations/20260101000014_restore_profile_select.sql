-- =============================================================================
-- 014_restore_profile_select.sql
--
-- CORRECTIVE MIGRATION.
--
-- Migration 013 correctly stripped blanket privileges but, while granting
-- `update` on public.profiles to authenticated, it failed to grant `select`.
-- The blanket revoke had removed the inherited SELECT, so a signed-in user
-- could no longer read their own profile.
--
-- Caught by supabase/tests/rls-policy-tests.mjs:
--   FAIL  reads own profile
--   FAIL  cannot read another profile   <- both caused by the missing grant
--
-- The second failure is a useful reminder: an "access denied" assertion can
-- pass for the wrong reason. Here the denial was a missing table privilege
-- rather than the intended per-row RLS policy.
-- =============================================================================

grant select on public.profiles to authenticated;

-- Guard: a signed-in user must be able to read their own profile. RLS still
-- restricts this to their own row plus rows visible to user.manage holders.
do $$
begin
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'authenticated still lacks SELECT on public.profiles';
  end if;
end;
$$;
