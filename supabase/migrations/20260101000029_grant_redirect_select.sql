-- =============================================================================
-- 029_grant_redirect_select.sql
--
-- The FIFTH instance of the defect class fixed in migrations 022, 023, 024 and
-- 028: a Row Level Security POLICY exists, but the underlying table GRANT does
-- not, so the policy is unreachable dead code.
--
-- WHAT WAS BROKEN
--
-- Migration 010 created `redirects_select_cms` for `seo.manage` or
-- `settings.manage`. Migration 013 then granted, at line 164:
--
--   grant insert, update, delete on
--     public.site_settings, public.navigation_items, public.homepage_sections,
--     public.ad_placements, public.redirects
--   to authenticated;
--
-- SELECT is absent from that list. So an administrator holding `seo.manage`
-- could write a redirect and could not read one back — the CMS list query failed
-- and the screen rendered "Redirects could not be loaded".
--
-- The INSERT/UPDATE/DELETE policies were all live and all reachable; only the
-- read path was dead. That is what makes this class so easy to miss: reading
-- `pg_policies` shows four correct policies and nothing wrong.
--
-- HOW IT WAS FOUND
--
-- End-to-end verification of Phase 5 increment 2, by signing in as a real
-- `super_admin` and opening /admin/redirects. The page rendered its error state,
-- which meant the query — not the guard — had failed. See
-- `supabase/tests/rls-policy-tests.mjs`, where the new assertions pair a denial
-- for a role without `seo.manage` with a positive read for one that has it.
--
-- WHY GRANTING SELECT TO authenticated IS SAFE HERE
--
-- The grant is to the ROLE; RLS still filters every row. `redirects_select_cms`
-- requires `seo.manage` or `settings.manage` in its USING clause, so a `student`,
-- an `author` or a signed-out visitor reads nothing at all. The grant is what
-- makes the policy reachable; the policy is what makes it safe.
--
-- `anon` is deliberately excluded. A public redirect map is an invitation to
-- store spam links, and the request-time resolver reads this table with the
-- service-role client from `src/features/redirects/store.ts` precisely so that
-- no public read path needs to exist.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

grant select on public.redirects to authenticated;

-- -----------------------------------------------------------------------------
-- Self-check.
--
-- Uses `pg_catalog.has_table_privilege` rather than
-- `information_schema.role_table_grants`: that view only reveals grants the
-- CURRENT role may see, and migrations do not run as a member of
-- `authenticated`, so it can report a grant made moments earlier as absent.
-- That mistake cost a failed deployment once already (migration 028).
-- -----------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(p.privilege, ', ')
    into missing
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(privilege)
   where not has_table_privilege('authenticated', 'public.redirects', p.privilege);

  if missing is not null then
    raise exception 'authenticated is missing % on public.redirects', missing;
  end if;

  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'redirects'
       and policyname = 'redirects_select_cms'
  ) then
    raise exception 'redirects_select_cms policy is missing — a grant without a policy would be unrestricted';
  end if;
end;
$$;

notify pgrst, 'reload schema';