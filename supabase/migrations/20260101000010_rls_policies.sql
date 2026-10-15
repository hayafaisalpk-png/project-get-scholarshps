-- =============================================================================
-- 010_rls_policies.sql
-- Row Level Security for every table reachable through the Data API.
--
-- Design rules:
--   * Deny by default. A capability exists only because a policy grants it.
--   * Anonymous users can SELECT published content only. They never write.
--   * Writes require a named permission, checked via the SECURITY DEFINER
--     helpers from migration 004 (which read the verified JWT, never a
--     client-supplied value).
--   * Views are created with security_invoker = true so they cannot be used to
--     bypass the policies on their base tables.
--   * audit_logs is append-only: no UPDATE or DELETE policy is ever created.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ownership helper for articles
--
-- An "author" of an article is the linked login account, or the user who
-- created it. SECURITY DEFINER to avoid recursing through articles' own RLS.
-- -----------------------------------------------------------------------------
create or replace function public.is_article_author(p_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.articles a
    left join public.authors au on au.id = a.author_id
    where a.id = p_article_id
      and (a.created_by = auth.uid() or au.user_id = auth.uid())
  );
$$;

comment on function public.is_article_author(uuid) is
  'True when the current user is the author or creator of the given article.';

revoke execute on function public.is_article_author(uuid) from public;
grant execute on function public.is_article_author(uuid) to authenticated, service_role;

-- =============================================================================
-- Enable RLS on every table
-- =============================================================================
alter table public.profiles                        enable row level security;
alter table public.roles                           enable row level security;
alter table public.permissions                     enable row level security;
alter table public.role_permissions                enable row level security;
alter table public.user_roles                      enable row level security;
alter table public.categories                      enable row level security;
alter table public.education_levels                enable row level security;
alter table public.academic_fields                 enable row level security;
alter table public.locations                       enable row level security;
alter table public.tags                            enable row level security;
alter table public.article_categories              enable row level security;
alter table public.article_tags                    enable row level security;
alter table public.media_assets                    enable row level security;
alter table public.scholarships                    enable row level security;
alter table public.scholarship_categories          enable row level security;
alter table public.scholarship_tags                enable row level security;
alter table public.scholarship_education_levels    enable row level security;
alter table public.scholarship_fields              enable row level security;
alter table public.scholarship_locations           enable row level security;
alter table public.scholarship_sources             enable row level security;
alter table public.scholarship_verification_logs   enable row level security;
alter table public.authors                         enable row level security;
alter table public.articles                        enable row level security;
alter table public.article_category_links          enable row level security;
alter table public.article_tag_links               enable row level security;
alter table public.article_scholarships            enable row level security;
alter table public.article_revisions               enable row level security;
alter table public.article_reviews                 enable row level security;
alter table public.site_settings                   enable row level security;
alter table public.navigation_items                enable row level security;
alter table public.homepage_sections               enable row level security;
alter table public.ad_placements                   enable row level security;
alter table public.redirects                       enable row level security;
alter table public.newsletter_subscribers          enable row level security;
alter table public.contact_submissions             enable row level security;
alter table public.consent_records                 enable row level security;
alter table public.content_reports                 enable row level security;
alter table public.audit_logs                      enable row level security;

-- Force RLS even for the table owner, so a careless query cannot bypass it.
alter table public.scholarships        force row level security;
alter table public.articles           force row level security;
alter table public.newsletter_subscribers force row level security;
alter table public.contact_submissions   force row level security;
alter table public.audit_logs           force row level security;
alter table public.profiles             force row level security;

-- =============================================================================
-- Identity
-- =============================================================================

-- profiles --------------------------------------------------------------------
-- A user may read their own profile. Administrators may read all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('user.manage'));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- roles / permissions ---------------------------------------------------------
-- Read-only for authenticated users; managed server-side by privileged actions.
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated on public.roles
  for select to authenticated
  using (public.is_cms_role() or has_role('super_admin'));

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated on public.permissions
  for select to authenticated
  using (public.is_cms_role());

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated on public.role_permissions
  for select to authenticated
  using (public.is_cms_role());

-- user_roles -----------------------------------------------------------------
-- A user may read their own assignments. Role management is server-side only.
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('user.manage'));

-- No INSERT/UPDATE/DELETE policy on user_roles: those are performed by the
-- server using the service-role client after an explicit permission check.

-- =============================================================================
-- Taxonomy — public read of active rows, write for taxonomy managers
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'education_levels', 'academic_fields',
    'locations', 'tags', 'article_categories', 'article_tags'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_public', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (
           (status = ''active'' and archived_at is null)
           or public.has_permission(''taxonomy.manage'')
         )',
      t || '_select_public', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.has_permission(''taxonomy.manage''))
         with check (public.has_permission(''taxonomy.manage''))',
      t || '_write_manage', t
    );
  end loop;
end;
$$;

-- =============================================================================
-- Media
-- =============================================================================
drop policy if exists media_select_public on public.media_assets;
create policy media_select_public on public.media_assets
  for select to anon, authenticated
  using (
    archived_at is null
    and (is_public or public.has_permission('media.manage'))
  );

drop policy if exists media_insert_upload on public.media_assets;
create policy media_insert_upload on public.media_assets
  for insert to authenticated
  with check (
    public.has_permission('media.upload')
    and uploaded_by = auth.uid()
  );

drop policy if exists media_update_manage on public.media_assets;
create policy media_update_manage on public.media_assets
  for update to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));

drop policy if exists media_delete_manage on public.media_assets;
create policy media_delete_manage on public.media_assets
  for delete to authenticated
  using (public.has_permission('media.manage'));

-- =============================================================================
-- Scholarships
-- =============================================================================

-- Public read: published only. Expired records remain published and therefore
-- remain readable, so historical pages and their facts survive.
drop policy if exists scholarships_select_public on public.scholarships;
create policy scholarships_select_public on public.scholarships
  for select to anon, authenticated
  using (
    (status = 'published' and archived_at is null)
    or public.has_permission('scholarship.manage')
  );

-- Create: requires the manage permission and self-attribution.
drop policy if exists scholarships_insert_manage on public.scholarships;
create policy scholarships_insert_manage on public.scholarships
  for insert to authenticated
  with check (
    public.has_permission('scholarship.manage')
    and created_by = auth.uid()
  );

-- Update: requires the manage permission. Authors are NOT granted scholarship
-- write access; that is an editorial-admin capability.
drop policy if exists scholarships_update_manage on public.scholarships;
create policy scholarships_update_manage on public.scholarships
  for update to authenticated
  using (public.has_permission('scholarship.manage'))
  with check (public.has_permission('scholarship.manage'));

drop policy if exists scholarships_delete_manage on public.scholarships;
create policy scholarships_delete_manage on public.scholarships
  for delete to authenticated
  using (public.has_permission('scholarship.delete'));

-- Scholarship joins are readable alongside the scholarship itself.
do $$
declare
  t text;
begin
  foreach t in array array[
    'scholarship_categories', 'scholarship_tags', 'scholarship_education_levels',
    'scholarship_fields', 'scholarship_locations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (
           exists (
             select 1 from public.scholarships s
             where s.id = %I.scholarship_id
               and ((s.status = ''published'' and s.archived_at is null)
                    or public.has_permission(''scholarship.manage''))
           )
         )',
      t || '_select', t, t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.has_permission(''scholarship.manage''))
         with check (public.has_permission(''scholarship.manage''))',
      t || '_write', t
    );
  end loop;
end;
$$;

-- Provenance and verification trail: CMS-only.
drop policy if exists scholarship_sources_cms on public.scholarship_sources;
create policy scholarship_sources_cms on public.scholarship_sources
  for select to authenticated
  using (public.has_permission('scholarship.manage'));

drop policy if exists scholarship_sources_write on public.scholarship_sources;
create policy scholarship_sources_write on public.scholarship_sources
  for all to authenticated
  using (public.has_permission('scholarship.manage'))
  with check (public.has_permission('scholarship.manage'));

drop policy if exists scholarship_verification_logs_cms
  on public.scholarship_verification_logs;
create policy scholarship_verification_logs_cms
  on public.scholarship_verification_logs
  for select to authenticated
  using (public.has_permission('scholarship.manage'));

drop policy if exists scholarship_verification_logs_write
  on public.scholarship_verification_logs;
create policy scholarship_verification_logs_write
  on public.scholarship_verification_logs
  for insert to authenticated
  with check (
    public.has_permission('scholarship.verify')
    and checked_by = auth.uid()
  );

-- =============================================================================
-- Articles
-- =============================================================================

-- Public read: published and actually due for publication.
drop policy if exists articles_select_public on public.articles;
create policy articles_select_public on public.articles
  for select to anon, authenticated
  using (
    public.article_is_public(status, published_at)
    or public.has_permission('article.manage')
    or public.is_article_author(id)
  );

drop policy if exists articles_insert_manage on public.articles;
create policy articles_insert_manage on public.articles
  for insert to authenticated
  with check (
    (public.has_permission('article.manage') or public.has_role('author'))
    and created_by = auth.uid()
  );

-- Authors may edit their own work, but ONLY while it has not been published or
-- scheduled. Once published, only an editor or administrator may change it.
drop policy if exists articles_update_policy on public.articles;
create policy articles_update_policy on public.articles
  for update to authenticated
  using (
    public.has_permission('article.manage')
    or (
      public.has_role('author')
      and public.is_article_author(id)
      and status in ('draft', 'in_review')
    )
  )
  with check (
    public.has_permission('article.manage')
    or (
      public.has_role('author')
      and public.is_article_author(id)
      -- An author must not be able to self-publish or self-schedule.
      and status in ('draft', 'in_review')
    )
  );

drop policy if exists articles_delete_policy on public.articles;
create policy articles_delete_policy on public.articles
  for delete to authenticated
  using (
    public.has_permission('article.delete')
    or (public.has_role('author') and public.is_article_author(id) and status = 'draft')
  );

-- Joins and supporting tables
do $$
declare
  t text;
begin
  foreach t in array array['article_category_links', 'article_tag_links', 'article_scholarships']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (
           exists (
             select 1 from public.articles a
             where a.id = %I.article_id
               and (public.article_is_public(a.status, a.published_at)
                    or public.has_permission(''article.manage'')
                    or public.is_article_author(a.id))
           )
         )',
      t || '_select', t, t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      -- An author may only attach taxonomy/links to their own article while it
      -- is still a draft or awaiting review. They must not be able to modify
      -- links on published or scheduled articles.
      'create policy %I on public.%I for all to authenticated
         using (
           public.has_permission(''article.manage'')
           or (
             public.has_role(''author'')
             and public.is_article_author(%I.article_id)
             and exists (
               select 1 from public.articles a
               where a.id = %I.article_id
                 and a.status in (''draft'', ''in_review'')
             )
           )
         )
         with check (
           public.has_permission(''article.manage'')
           or (
             public.has_role(''author'')
             and public.is_article_author(%I.article_id)
             and exists (
               select 1 from public.articles a
               where a.id = %I.article_id
                 and a.status in (''draft'', ''in_review'')
             )
           )
         )',
      t || '_write', t, t, t, t, t
    );
  end loop;
end;
$$;

-- Authors (bylines) ------------------------------------------------------------
drop policy if exists authors_select_public on public.authors;
create policy authors_select_public on public.authors
  for select to anon, authenticated
  using (is_active or public.has_permission('article.manage'));

drop policy if exists authors_write_manage on public.authors;
create policy authors_write_manage on public.authors
  for all to authenticated
  using (public.has_permission('article.manage'))
  with check (public.has_permission('article.manage'));

-- Revisions: authors see their own article history; editors see all.
drop policy if exists article_revisions_select on public.article_revisions;
create policy article_revisions_select on public.article_revisions
  for select to authenticated
  using (
    public.has_permission('article.manage')
    or public.is_article_author(article_id)
  );

-- Revisions are written by the snapshot trigger (definer) — no client policy.

-- Reviews: visible to reviewers, editors and the article's author.
drop policy if exists article_reviews_select on public.article_reviews;
create policy article_reviews_select on public.article_reviews
  for select to authenticated
  using (
    public.has_permission('article.review')
    or public.is_article_author(article_id)
  );

drop policy if exists article_reviews_insert on public.article_reviews;
create policy article_reviews_insert on public.article_reviews
  for insert to authenticated
  with check (
    public.has_permission('article.review')
    and reviewer_id = auth.uid()
  );

-- =============================================================================
-- Platform configuration
-- =============================================================================

-- site_settings: public rows readable by anyone; writes need settings.manage.
drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated
  using (is_public or public.has_permission('settings.manage'));

drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Navigation, homepage sections, ad placements: public read of enabled rows.
drop policy if exists navigation_select_public on public.navigation_items;
create policy navigation_select_public on public.navigation_items
  for select to anon, authenticated
  using (is_visible or public.has_permission('navigation.manage'));

drop policy if exists navigation_write on public.navigation_items;
create policy navigation_write on public.navigation_items
  for all to authenticated
  using (public.has_permission('navigation.manage'))
  with check (public.has_permission('navigation.manage'));

drop policy if exists homepage_sections_select_public on public.homepage_sections;
create policy homepage_sections_select_public on public.homepage_sections
  for select to anon, authenticated
  using (is_visible or public.has_permission('homepage.manage'));

drop policy if exists homepage_sections_write on public.homepage_sections;
create policy homepage_sections_write on public.homepage_sections
  for all to authenticated
  using (public.has_permission('homepage.manage'))
  with check (public.has_permission('homepage.manage'));

drop policy if exists ad_placements_select_cms on public.ad_placements;
create policy ad_placements_select_cms on public.ad_placements
  for select to authenticated
  using (public.has_permission('ads.manage'));

drop policy if exists ad_placements_write on public.ad_placements;
create policy ad_placements_write on public.ad_placements
  for all to authenticated
  using (public.has_permission('ads.manage'))
  with check (public.has_permission('ads.manage'));

-- Redirects: CMS only. Never readable anonymously.
drop policy if exists redirects_select_cms on public.redirects;
create policy redirects_select_cms on public.redirects
  for select to authenticated
  using (public.has_permission('seo.manage') or public.has_permission('settings.manage'));

drop policy if exists redirects_write on public.redirects;
create policy redirects_write on public.redirects
  for all to authenticated
  using (public.has_permission('seo.manage'))
  with check (public.has_permission('seo.manage'));

-- =============================================================================
-- Private data
-- =============================================================================

-- Newsletter subscribers: no client access at all. The server-side signup route
-- uses the service-role client. FORCE RLS is set above.
-- (No policies are created here on purpose.)

-- Contact submissions: no client access. Server-side only.

-- Consent records: a visitor may record their decision anonymously.
-- Reading the stored record is CMS-only — the visitor-facing banner reads the
-- preference from its own cookie/localStorage, which is the authoritative
-- source for that browser anyway.
drop policy if exists consent_records_insert_public on public.consent_records;
create policy consent_records_insert_public on public.consent_records
  for insert to anon, authenticated
  with check (true);

drop policy if exists consent_records_select_cms on public.consent_records;
create policy consent_records_select_cms on public.consent_records
  for select to authenticated
  using (public.has_permission('settings.manage'));

-- =============================================================================
-- Content reports
-- =============================================================================

-- Anyone may report a problem; the object being reported stays readable so the
-- form can confirm it exists.
drop policy if exists content_reports_insert_public on public.content_reports;
create policy content_reports_insert_public on public.content_reports
  for insert to anon, authenticated
  with check (status = 'open' and resolved_at is null);

drop policy if exists content_reports_select_cms on public.content_reports;
create policy content_reports_select_cms on public.content_reports
  for select to authenticated
  using (public.has_permission('report.manage'));

drop policy if exists content_reports_update_cms on public.content_reports;
create policy content_reports_update_cms on public.content_reports
  for update to authenticated
  using (public.has_permission('report.manage'))
  with check (public.has_permission('report.manage'));

-- =============================================================================
-- Audit logs — append-only
-- =============================================================================

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.has_permission('audit.view'));

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
revoke all on public.contact_submissions  from anon, authenticated;

-- Audit logs: read-only for privileged users; writes via the definer function.
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Identity: user_roles is never directly writable.
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;

grant select on public.roles, public.permissions, public.role_permissions to authenticated;

-- Role management happens server-side via the service-role client.
revoke insert, update, delete on public.roles            from authenticated;
revoke insert, update, delete on public.permissions      from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;

grant select, insert, update on public.profiles to authenticated;
revoke delete on public.profiles from authenticated;

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

-- Anonymous users may submit a content report; nothing else is writable.
grant insert on public.content_reports to anon, authenticated;
grant select on public.consent_records to anon, authenticated;
grant insert on public.consent_records to anon, authenticated;
