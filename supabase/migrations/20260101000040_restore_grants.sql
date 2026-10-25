-- Auto-generated: consolidated grants from all migrations
-- Source: supabase/migrations/*.sql (grant/revoke + alter default privileges statements only)

-- from 20260101000004_authorization_helpers.sql
-- -----------------------------------------------------------------------------
-- Execute grants
--
-- These functions must be callable from RLS policies running as anon/authenticated,
-- but only anon/authenticated/ service_role need them. Revoke from PUBLIC.
-- -----------------------------------------------------------------------------
revoke execute on function public.current_user_role_keys() from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.has_role(text) from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.has_any_role(text[]) from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.has_permission(text) from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.can(text, text[]) from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.is_cms_role() from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.can_publish() from public;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.current_user_role_keys() to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.has_role(text) to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.has_any_role(text[]) to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.has_permission(text) to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.can(text, text[]) to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.is_cms_role() to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
grant execute on function public.can_publish() to anon, authenticated, service_role;

-- from 20260101000004_authorization_helpers.sql
-- Internal helpers: not callable by end users.
revoke execute on function public.scholarship_is_public(public.scholarship_status) from public;

-- from 20260101000004_authorization_helpers.sql
revoke execute on function public.article_is_public(public.article_status, timestamptz) from public;

-- from 20260101000009_platform.sql
revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb) from public;

-- from 20260101000009_platform.sql
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb)
  to authenticated, service_role;

-- from 20260101000010_rls_policies.sql
revoke execute on function public.is_article_author(uuid) from public;

-- from 20260101000010_rls_policies.sql
grant execute on function public.is_article_author(uuid) to authenticated, service_role;

-- from 20260101000010_rls_policies.sql
-- NOTE: deliberately NO insert, update or delete policy.
-- Writes go through the SECURITY DEFINER function public.write_audit_log().
-- Without an INSERT policy, clients cannot append to the log directly, which
-- prevents both forgery and tampering.

-- =============================================================================
-- Grants
--
-- Default Supabase privileges are broad. Tighten explicitly.
-- =============================================================================

-- Private tables: no client privileges at all.
revoke all on public.newsletter_subscribers from anon, authenticated;

-- from 20260101000010_rls_policies.sql
revoke all on public.contact_submissions  from anon, authenticated;

-- from 20260101000010_rls_policies.sql
-- Audit logs: read-only for privileged users; writes via the definer function.
revoke all on public.audit_logs from anon, authenticated;

-- from 20260101000010_rls_policies.sql
grant select on public.audit_logs to authenticated;

-- from 20260101000010_rls_policies.sql
-- Identity: user_roles is never directly writable.
revoke all on public.user_roles from anon;

-- from 20260101000010_rls_policies.sql
grant select on public.user_roles to authenticated;

-- from 20260101000010_rls_policies.sql
grant select on public.roles, public.permissions, public.role_permissions to authenticated;

-- from 20260101000010_rls_policies.sql
-- Role management happens server-side via the service-role client.
revoke insert, update, delete on public.roles            from authenticated;

-- from 20260101000010_rls_policies.sql
revoke insert, update, delete on public.permissions      from authenticated;

-- from 20260101000010_rls_policies.sql
revoke insert, update, delete on public.role_permissions from authenticated;

-- from 20260101000010_rls_policies.sql
grant select, insert, update on public.profiles to authenticated;

-- from 20260101000010_rls_policies.sql
revoke delete on public.profiles from authenticated;

-- from 20260101000010_rls_policies.sql
-- Public content: SELECT only for anonymous users, everywhere else.
grant select on
  public.scholarships,
  public.scholarship_categories,
  public.scholarship_tags,
  public.scholarship_education_levels,
  public.scholarship_fields,
  public.scholarship_locations,
  public.articles,
  public.article_category_links,
  public.article_tag_links,
  public.article_scholarships,
  public.authors,
  public.media_assets,
  public.categories,
  public.education_levels,
  public.academic_fields,
  public.locations,
  public.tags,
  public.article_categories,
  public.article_tags,
  public.navigation_items,
  public.homepage_sections,
  public.site_settings
to anon, authenticated;

-- from 20260101000010_rls_policies.sql
-- Anonymous users may submit a content report; nothing else is writable.
grant insert on public.content_reports to anon, authenticated;

-- from 20260101000010_rls_policies.sql
grant select on public.consent_records to anon, authenticated;

-- from 20260101000010_rls_policies.sql
grant insert on public.consent_records to anon, authenticated;

-- from 20260101000013_tighten_privileges.sql
-- -----------------------------------------------------------------------------
-- Revoke everything currently held, for both client roles.
-- This removes TRUNCATE, TRIGGER, REFERENCES and all writes in one step.
-- -----------------------------------------------------------------------------
revoke all privileges on all tables in schema public from anon;

-- from 20260101000013_tighten_privileges.sql
revoke all privileges on all tables in schema public from authenticated;

-- from 20260101000013_tighten_privileges.sql
revoke all privileges on all sequences in schema public from anon;

-- from 20260101000013_tighten_privileges.sql
revoke all privileges on all sequences in schema public from authenticated;

-- from 20260101000013_tighten_privileges.sql
-- -----------------------------------------------------------------------------
-- ANONYMOUS: read-only, and only for genuinely public content.
-- -----------------------------------------------------------------------------
grant select on
  public.scholarships,
  public.scholarship_categories,
  public.scholarship_tags,
  public.scholarship_education_levels,
  public.scholarship_fields,
  public.scholarship_locations,
  public.articles,
  public.article_category_links,
  public.article_tag_links,
  public.article_scholarships,
  public.authors,
  public.media_assets,
  public.categories,
  public.education_levels,
  public.academic_fields,
  public.locations,
  public.tags,
  public.article_categories,
  public.article_tags,
  public.navigation_items,
  public.homepage_sections,
  public.site_settings,
  public.published_scholarships,
  public.published_articles
to anon;

-- from 20260101000013_tighten_privileges.sql
-- The only two writes an anonymous visitor may ever perform.
grant insert on public.content_reports to anon;

-- from 20260101000013_tighten_privileges.sql
grant insert on public.consent_records to anon;

-- from 20260101000013_tighten_privileges.sql
-- -----------------------------------------------------------------------------
-- AUTHENTICATED: public reads plus the writes the RLS policies actually permit.
-- Anything not listed here is denied at the privilege layer as well as by RLS.
-- -----------------------------------------------------------------------------

-- Public reads
grant select on
  public.scholarships,
  public.scholarship_categories,
  public.scholarship_tags,
  public.scholarship_education_levels,
  public.scholarship_fields,
  public.scholarship_locations,
  public.articles,
  public.article_category_links,
  public.article_tag_links,
  public.article_scholarships,
  public.authors,
  public.media_assets,
  public.categories,
  public.education_levels,
  public.academic_fields,
  public.locations,
  public.tags,
  public.article_categories,
  public.article_tags,
  public.navigation_items,
  public.homepage_sections,
  public.site_settings,
  public.published_scholarships,
  public.published_articles
to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Profiles: read and update own row only (RLS-scoped). No insert, no delete.
grant update on public.profiles to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Identity reads. Role assignment is server-side via the service role.
grant select on
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_roles,
  public.user_role_summary
to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Scholarships CMS
grant insert, update, delete on public.scholarships to authenticated;

-- from 20260101000013_tighten_privileges.sql
grant insert, update, delete on
  public.scholarship_categories,
  public.scholarship_tags,
  public.scholarship_education_levels,
  public.scholarship_fields,
  public.scholarship_locations,
  public.scholarship_sources
to authenticated;

-- from 20260101000013_tighten_privileges.sql
grant insert on public.scholarship_verification_logs to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Articles CMS
grant insert, update, delete on public.articles to authenticated;

-- from 20260101000013_tighten_privileges.sql
grant insert, update, delete on
  public.article_category_links,
  public.article_tag_links,
  public.article_scholarships,
  public.authors
to authenticated;

-- from 20260101000013_tighten_privileges.sql
grant insert on public.article_reviews to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Revisions are written by the SECURITY DEFINER snapshot trigger only.
grant select on public.article_revisions to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Taxonomy CMS
grant insert, update, delete on
  public.categories,
  public.education_levels,
  public.academic_fields,
  public.locations,
  public.tags,
  public.article_categories,
  public.article_tags
to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Media CMS
grant insert, update, delete on public.media_assets to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Configuration CMS
grant insert, update, delete on
  public.site_settings,
  public.navigation_items,
  public.homepage_sections,
  public.ad_placements,
  public.redirects
to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Inbox
grant insert, update on public.content_reports to authenticated;

-- from 20260101000013_tighten_privileges.sql
grant insert on public.consent_records to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- Audit log: read only. Writes go through public.write_audit_log().
grant select on public.audit_logs to authenticated;

-- from 20260101000013_tighten_privileges.sql
-- -----------------------------------------------------------------------------
-- Explicitly deny the tables that must never be client-accessible.
-- (Redundant after the blanket revoke, but stated so intent is auditable.)
-- -----------------------------------------------------------------------------
revoke all on public.newsletter_subscribers from anon, authenticated;

-- from 20260101000013_tighten_privileges.sql
revoke all on public.contact_submissions  from anon, authenticated;

-- from 20260101000013_tighten_privileges.sql
revoke all on public.audit_logs           from anon;

-- from 20260101000013_tighten_privileges.sql
-- -----------------------------------------------------------------------------
-- Audit verification helper (migration 010).
-- -----------------------------------------------------------------------------
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb)
  to authenticated, service_role;

-- from 20260101000014_restore_profile_select.sql
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

-- from 20260101000015_search_scholarships_function.sql
-- ---------------------------------------------------------------------------
-- Grants: callable by visitors, subject to RLS.
-- ---------------------------------------------------------------------------
revoke execute on function public.search_scholarships(text, text[], text[], text[], text[], text[], bigint, bigint, text, boolean, boolean, boolean, text, integer, integer) from public;

-- from 20260101000015_search_scholarships_function.sql
grant execute on function public.search_scholarships(text, text[], text[], text[], text[], text[], bigint, bigint, text, boolean, boolean, boolean, text, integer, integer)
  to anon, authenticated, service_role;

-- from 20260101000016_published_scholarship_sources_view.sql
grant select on public.published_scholarship_sources to anon, authenticated;

-- from 20260101000016_published_scholarship_sources_view.sql
-- The detail page no longer embeds scholarship_sources, so nothing else needs
-- the base table. anon keeps no privilege on it.
revoke all on public.scholarship_sources from anon;

-- from 20260101000017_fix_published_sources_view_privileges.sql
revoke all on public.published_scholarship_sources from public;

-- from 20260101000017_fix_published_sources_view_privileges.sql
grant select on public.published_scholarship_sources to anon, authenticated;

-- from 20260101000017_fix_published_sources_view_privileges.sql
-- The base table remains entirely CMS-only.
revoke all on public.scholarship_sources from anon;

-- from 20260101000018_grant_source_read_to_authenticated.sql
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

-- from 20260101000021_content_pages.sql
-- NOTE: deliberately no DELETE policy and no DELETE grant. See the header note.

-- -----------------------------------------------------------------------------
-- Privileges
--
-- `revoke all` first: tables inherit broad Supabase defaults, and RLS cannot
-- filter an operation such as TRUNCATE. This is the same correction made for
-- every other table in migration 013.
-- -----------------------------------------------------------------------------

revoke all on public.content_pages from anon, authenticated;

-- from 20260101000021_content_pages.sql
grant select on public.content_pages to anon, authenticated;

-- from 20260101000021_content_pages.sql
grant select, insert, update on public.content_pages to authenticated;

-- from 20260101000023_grant_inbox_select.sql
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

-- from 20260101000023_grant_inbox_select.sql
grant select on public.contact_submissions to authenticated;

-- from 20260101000024_grant_anon_content_report_insert.sql
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

-- from 20260101000025_sitemap_taxonomy_terms.sql
-- Callable by the roles that render public pages. Revoke from PUBLIC first, as
-- with every other helper in migration 004.
revoke execute on function public.sitemap_taxonomy_terms() from public;

-- from 20260101000025_sitemap_taxonomy_terms.sql
grant execute on function public.sitemap_taxonomy_terms() to anon, authenticated, service_role;

-- from 20260101000028_grant_contact_inbox_update.sql
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

-- from 20260101000029_grant_redirect_select.sql
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

-- from 20260101000036_allow_contact_message_deletion.sql
-- Contact deletion is an explicitly authorized, audited CMS action.
grant delete on public.contact_submissions to authenticated;

-- from 20260101000039_article_faq_items.sql
-- The helper is called by a CHECK constraint, so the role performing the
-- insert needs EXECUTE on it. It reveals nothing: it only inspects the value
-- it is given.
revoke execute on function public.article_faq_items_valid(jsonb) from public;

-- from 20260101000039_article_faq_items.sql
grant execute on function public.article_faq_items_valid(jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Restore service_role default privileges (Supabase cloud default; missing in this project).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
notify pgrst, 'reload schema';

-- Internal helpers used by RLS policies and security_invoker views.
grant execute on function public.scholarship_is_public(public.scholarship_status) to anon, authenticated, service_role;
grant execute on function public.article_is_public(public.article_status, timestamptz) to anon, authenticated, service_role;
grant execute on function public.is_article_author(uuid) to anon, authenticated, service_role;
