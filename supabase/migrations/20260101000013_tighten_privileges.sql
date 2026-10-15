-- =============================================================================
-- 013_tighten_privileges.sql
--
-- CORRECTIVE MIGRATION (hardening).
--
-- Problem found by grant auditing after migration 012:
--
--   Supabase applies `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
--   authenticated`. Every table created by our migrations therefore inherited
--   INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER for anon and authenticated.
--
--   Migration 010 only ADDED `grant select ... to anon`; it never revoked the
--   inherited privileges. RLS happened to block the row-level operations, which
--   is why the policy tests still passed — but this is a single point of
--   failure:
--
--     * Row Level Security does NOT filter TRUNCATE. No policy can protect a
--       table from a TRUNCATE granted at the table level.
--     * Any future migration that accidentally disables RLS on one table would
--       immediately expose full write access to the public publishable key.
--
-- Fix: revoke the default privileges, then grant each role the MINIMUM it
-- actually needs. RLS remains the primary control; this is defence in depth.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Stop future tables from inheriting blanket privileges.
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;

-- -----------------------------------------------------------------------------
-- Revoke everything currently held, for both client roles.
-- This removes TRUNCATE, TRIGGER, REFERENCES and all writes in one step.
-- -----------------------------------------------------------------------------
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from authenticated;

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

-- The only two writes an anonymous visitor may ever perform.
grant insert on public.content_reports to anon;
grant insert on public.consent_records to anon;

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

-- Profiles: read and update own row only (RLS-scoped). No insert, no delete.
grant update on public.profiles to authenticated;

-- Identity reads. Role assignment is server-side via the service role.
grant select on
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_roles,
  public.user_role_summary
to authenticated;

-- Scholarships CMS
grant insert, update, delete on public.scholarships to authenticated;
grant insert, update, delete on
  public.scholarship_categories,
  public.scholarship_tags,
  public.scholarship_education_levels,
  public.scholarship_fields,
  public.scholarship_locations,
  public.scholarship_sources
to authenticated;
grant insert on public.scholarship_verification_logs to authenticated;

-- Articles CMS
grant insert, update, delete on public.articles to authenticated;
grant insert, update, delete on
  public.article_category_links,
  public.article_tag_links,
  public.article_scholarships,
  public.authors
to authenticated;
grant insert on public.article_reviews to authenticated;

-- Revisions are written by the SECURITY DEFINER snapshot trigger only.
grant select on public.article_revisions to authenticated;

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

-- Media CMS
grant insert, update, delete on public.media_assets to authenticated;

-- Configuration CMS
grant insert, update, delete on
  public.site_settings,
  public.navigation_items,
  public.homepage_sections,
  public.ad_placements,
  public.redirects
to authenticated;

-- Inbox
grant insert, update on public.content_reports to authenticated;
grant insert on public.consent_records to authenticated;

-- Audit log: read only. Writes go through public.write_audit_log().
grant select on public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Explicitly deny the tables that must never be client-accessible.
-- (Redundant after the blanket revoke, but stated so intent is auditable.)
-- -----------------------------------------------------------------------------
revoke all on public.newsletter_subscribers from anon, authenticated;
revoke all on public.contact_submissions  from anon, authenticated;
revoke all on public.audit_logs           from anon;

-- -----------------------------------------------------------------------------
-- Audit verification helper (migration 010).
-- -----------------------------------------------------------------------------
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Sanity check: fail loudly if a client role can still TRUNCATE anything.
-- -----------------------------------------------------------------------------
do $$
declare
  offending text;
begin
  select string_agg(distinct table_name, ', ') into offending
  from information_schema.role_table_grants
  where grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
    and table_schema = 'public';

  if offending is not null then
    raise exception 'Unexpected privileges still granted to client roles on: %', offending;
  end if;
end;
$$;
