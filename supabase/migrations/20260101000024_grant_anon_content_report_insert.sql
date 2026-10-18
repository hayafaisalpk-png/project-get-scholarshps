-- =============================================================================
-- 024_grant_anon_content_report_insert.sql
--
-- A third instance of the same class of defect as migration 023, and the most
-- consequential of the three: it broke a public feature outright.
--
-- WHAT WAS BROKEN
--
-- `content_reports` is the table behind the "Report incorrect information"
-- link on every scholarship and article page. The Server Action
-- (`submitReportAction` in `src/features/contact/actions.ts`) deliberately uses
-- the SESSION client rather than the service role, so that RLS constrains the
-- write exactly as it constrains everyone else.
--
-- Migration 010 created `content_reports_insert_public` for `anon` and
-- authenticated, and granted anon INSERT. Migration 013 then revoked every
-- privilege from anon and re-granted only to authenticated:
--
--   grant insert, update on public.content_reports to authenticated;
--
-- So for an anonymous visitor — which is who most people are, and who cannot
-- sign in because sign-up is closed by design — the INSERT policy existed but
-- the privilege did not. Every report was rejected with:
--
--   {"code":"42501","hint":"... GRANT INSERT ON public.content_reports TO anon"}
--
-- The form would have reported success to the visitor while the report was
-- discarded. Under `AGENTS.md` §2.5 that is the worst possible outcome: a
-- feature that looks real and silently does nothing, and it runs against the
-- site's most trust-sensitive affordance — corrections to published facts.
--
-- HOW IT WAS FOUND
--
-- `npm run test:rls` previously asserted only that anon CANNOT READ reports and
-- CANNOT forge a pre-resolved one. Both passed, because both were true. There
-- was no assertion that a legitimate anon report SUCCEEDS, so the broken public
-- write path was invisible. A positive assertion was added with this fix:
--
--   check('anon CAN file a legitimate report', ...)
--
-- A suite made only of denials will happily pass against a feature that does not
-- work. That is worth remembering for the remaining suites.
--
-- WHY GRANTING ANON INSERT IS SAFE
--
-- The grant is to the role; RLS still constrains every row. `with check
-- (status = 'open' and resolved_at is null)` means an anonymous insert cannot
-- arrive pre-resolved, pre-approved, or attributed to a staff member, and there
-- is no UPDATE grant for anon so it can never be altered afterwards. The visitor
-- controls the reason, the details and the reporter email, and nothing else.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

grant insert on public.content_reports to anon;

-- -----------------------------------------------------------------------------
-- Self-check.
--
-- Verifies the privilege PostgREST actually consults. Written as an EXCEPT of
-- the granted set against the required set so a future blanket revoke fails the
-- migration loudly instead of quietly disabling the public report path.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name   = 'content_reports'
       and grantee      = 'anon'
       and privilege_type = 'INSERT'
  ) then
    raise exception
      'anon is missing INSERT on public.content_reports — the public report form cannot work';
  end if;
end;
$$;

notify pgrst, 'reload schema';