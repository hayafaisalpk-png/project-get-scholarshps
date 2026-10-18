-- =============================================================================
-- 028_grant_contact_inbox_update.sql
--
-- A fourth instance of the defect class fixed in migrations 022, 023 and 024: a
-- Row Level Security POLICY exists, but the underlying table GRANT does not, so
-- the policy is unreachable dead code.
--
-- WHAT WAS BROKEN
--
-- Migration 022 created BOTH `contact_submissions_select_cms` and
-- `contact_submissions_update_cms`, both requiring `contact.manage`, and its own
-- header comment states the intent plainly: "Granting UPDATE lets staff mark a
-- message in_progress or resolved". But migration 013 line 184 had revoked every
-- privilege from `anon` and `authenticated`, and migration 023 restored only
-- SELECT. No migration ever granted UPDATE.
--
-- PostgreSQL checks the table privilege first and the policy second. So an
-- UPDATE from an administrator holding `contact.manage` failed at the privilege
-- layer with HTTP 403 / SQLSTATE 42501 before the policy was ever consulted.
--
-- HOW IT WAS FOUND
--
-- `npm run test:rls`, via the two triage assertions added with increment 6:
--
--   FAIL  admin (contact.manage) CAN resolve a message and record the handler
--         <- status=403 row={"status":"new","handled_at":null,"handled_by":null}
--
-- Note that the pre-existing suite passed 91/91 while this was broken. Every
-- contact_submissions assertion before this one was a SELECT or a "cannot", and
-- the "author CANNOT triage" denial passed for the wrong reason — the author was
-- refused by the missing GRANT, not by the policy. A test that cannot tell the
-- difference between "denied for the right reason" and "denied because the
-- feature is entirely unreachable" is not testing the boundary.
--
-- WHY GRANTING UPDATE TO authenticated IS SAFE HERE
--
-- The grant is to the ROLE, not to a person. RLS still applies to every one of
-- those rows, and `contact_submissions_update_cms` requires an explicit
-- `contact.manage` in BOTH its USING and WITH CHECK clauses. A `student`, an
-- `author` or a signed-out visitor holds nothing that satisfies it. The grant is
-- what makes the policy reachable; the policy is what makes it safe.
--
-- The live assertion that proves both halves are correct now lives in
-- `supabase/tests/rls-policy-tests.mjs`: the same PATCH is refused for an author
-- and accepted for an administrator, and the refusal is verified by reading the
-- row back rather than by trusting a status code.
--
-- STILL NO DELETE
--
-- `contact_submissions` continues to grant no DELETE to any application role.
-- Correspondence with a member of the public must not be erasable by a single
-- CMS action; triage is expressed as a status. See `AGENTS.md` §2.1.
--
-- `anon` is deliberately excluded. A visitor cannot read or write this table at
-- all, and must not gain UPDATE by association with `authenticated`.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

grant update on public.contact_submissions to authenticated;

-- Re-assert the two privileges the inbox depends on. INSERT is granted to the
-- contact Server Action through the service-role client rather than to a role,
-- so only SELECT and UPDATE are expected here — and an UPDATE on a table with no
-- SELECT is unreachable, because an UPDATE's RETURNING clause is filtered by the
-- SELECT policy. Both must be present for triage to work at all.
--
-- `pg_catalog.has_table_privilege` is used rather than
-- `information_schema.role_table_grants` because the information_schema view only
-- reveals grants the CURRENT role is entitled to see. Migrations run as a
-- superuser-ish role that is not a member of `authenticated`, so that view can
-- report the grant as absent even when it is present — which is what happened to
-- the first draft of this check. `has_table_privilege` asks the question directly.
do $$
declare
  missing text;
begin
  select string_agg(p.privilege, ', ')
    into missing
    from unnest(array['SELECT', 'UPDATE']) as p(privilege)
   where not has_table_privilege('authenticated', 'public.contact_submissions', p.privilege);

  if missing is not null then
    raise exception 'authenticated is still missing % on public.contact_submissions', missing;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Self-check: fail loudly if the update policy is absent.
--
-- Without this, a future blanket revoke would silently reintroduce the dead-policy
-- condition and the next signal would be a generic "you do not have permission"
-- message in the CMS rather than a failed migration.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'contact_submissions'
       and policyname = 'contact_submissions_update_cms'
  ) then
    raise exception 'contact_submissions_update_cms policy is missing — a grant without a policy would be unrestricted';
  end if;
end;
$$;

notify pgrst, 'reload schema';