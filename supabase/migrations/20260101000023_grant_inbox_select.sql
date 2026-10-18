-- =============================================================================
-- 023_grant_inbox_select.sql
--
-- Two real defects, both found by `npm run test:rls` and both of the same shape:
-- a Row Level Security POLICY existed but the underlying table GRANT did not, so
-- the policy was unreachable and the screen it protected could never read
-- anything.
--
-- PostgreSQL checks the table privilege first and the policy second. A policy
-- with no grant is not a permissive rule; it is dead code. That is why these
-- bugs are invisible to a read of the policies alone and only surface when an
-- actual request is made.
--
-- DEFECT 1 — content_reports
--
-- Migration 010 created `content_reports_select_cms` for `report.manage`.
-- Migration 013 then revoked all privileges from `anon` and `authenticated` and
-- re-granted by capability — but its inbox line (013 line 173) granted only
--   grant insert, update on public.content_reports to authenticated;
-- omitting SELECT. The net effect was that NO role could read a content report,
-- ever. The inbox was unreachable.
--
-- DEFECT 2 — contact_submissions
--
-- Migration 022 added `contact_submissions_select_cms`, but migration 013 line
-- 184 had already revoked every privilege from `authenticated` and nothing ever
-- granted it back. Migration 022 added the policy without the grant, so the same
-- dead-code condition applied. This is a mistake in 022 itself: adding a policy
-- to a table with no privilege is not enough.
--
-- WHY GRANTING SELECT TO authenticated IS SAFE HERE
--
-- The grant is to the ROLE, not to a person. RLS still applies to every one of
-- those rows, and both policies require an explicit permission
-- (`report.manage` / `contact.manage`). A `student` or `author` holds neither,
-- so their request is filtered to zero rows. Granting the privilege is what
-- makes the policy reachable; the policy is what makes it safe.
--
-- DELETE remains withheld on both tables. Corresponding with the public is not
-- something a single CMS action should be able to erase.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

grant select on public.content_reports to authenticated;
grant select on public.contact_submissions to authenticated;

-- -----------------------------------------------------------------------------
-- Self-check: fail loudly if either table privilege is still missing.
--
-- Reads `information_schema.role_table_grants`, which is what PostgREST consults
-- after the blanket revoke. Without this, a future `revoke all` would silently
-- break the inbox again and the next signal would be an empty page rather than a
-- failed migration.
-- -----------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  -- The expected two tables, minus whichever actually hold the grant. An
  -- EXCEPT is used rather than a NOT EXISTS so the result reads as "what is
  -- absent" instead of having to invert a predicate twice.
  select string_agg(t, ', ')
    into missing
    from (
      select unnest(array['content_reports', 'contact_submissions']) as t
      except
      select table_name
        from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee = 'authenticated'
         and privilege_type = 'SELECT'
    ) absent;

  if missing is not null then
    raise exception 'authenticated is still missing SELECT on: %', missing;
  end if;
end;
$$;

notify pgrst, 'reload schema';