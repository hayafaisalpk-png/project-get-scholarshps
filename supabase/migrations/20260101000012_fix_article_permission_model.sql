-- =============================================================================
-- 012_fix_article_permission_model.sql
--
-- CORRECTIVE MIGRATION.
--
-- Problem discovered by RLS testing (see docs/CHANGELOG.md 0.2.0):
--
--   `article.manage` was used in the articles UPDATE policy as the
--   "may edit ANY article in ANY status" branch, but it was ALSO granted to the
--   author and reviewer roles. The first branch therefore short-circuited for
--   those roles, which let an author:
--     * publish their own draft (bypassing review), and
--     * modify another author's draft.
--
-- Fix: split the capability into distinct permissions so that role grants and
-- policy branches mean the same thing.
--
--   article.create   create a new own draft
--   article.edit_own edit one's OWN draft, only while draft/in_review
--   article.manage   edit ANY article in ANY status (editor and above)
--   article.publish  publish/schedule/archive
--   article.review   see unpublished articles and record review decisions
--
-- This migration is idempotent and only touches the role_permissions grants
-- that the seed created seconds earlier; it deletes no user content.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, category, description) values
  ('article.create',   'article', 'Create a new article draft'),
  ('article.edit_own', 'article', 'Edit one''s own article while it is a draft or in review')
on conflict (key) do update
  set category    = excluded.category,
      description = excluded.description;

-- -----------------------------------------------------------------------------
-- Withdraw the over-broad grant from author and reviewer.
-- An author must never hold the "edit any article" capability.
-- -----------------------------------------------------------------------------
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = 'article.manage'
  and r.key in ('author', 'reviewer');

-- -----------------------------------------------------------------------------
-- Correct grants
-- -----------------------------------------------------------------------------

-- Author: create and edit only their own drafts. No manage, no publish.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'author'
  and p.key in ('article.create', 'article.edit_own', 'media.upload')
on conflict do nothing;

-- Reviewer: see unpublished content and record decisions. May not edit or publish.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'reviewer'
  and p.key in ('article.review', 'article.create', 'scholarship.verify', 'report.manage')
on conflict do nothing;

-- Editor: full article control including publishing.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'editor'
  and p.key in ('article.manage', 'article.create', 'article.edit_own', 'article.publish')
on conflict do nothing;

-- Administrators and super administrators keep every capability.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('admin', 'super_admin')
  and p.key in ('article.create', 'article.edit_own')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Replace the article policies with the corrected branching.
-- -----------------------------------------------------------------------------

-- SELECT -----------------------------------------------------------------------
drop policy if exists articles_select_public on public.articles;
create policy articles_select_public on public.articles
  for select to anon, authenticated
  using (
    public.article_is_public(status, published_at)
    or public.has_permission('article.manage')
    -- Reviewers must be able to read unpublished content in order to review it.
    or public.has_permission('article.review')
    or (
      public.has_permission('article.edit_own')
      and public.is_article_author(id)
    )
  );

-- INSERT -----------------------------------------------------------------------
drop policy if exists articles_insert_manage on public.articles;
create policy articles_insert_manage on public.articles
  for insert to authenticated
  with check (
    (public.has_permission('article.create')
     or public.has_permission('article.manage'))
    and created_by = auth.uid()
  );

-- UPDATE -----------------------------------------------------------------------
-- The second branch is deliberately bounded twice over: the caller must hold
-- article.edit_own, must own the article, and the resulting status must still
-- be a draft or awaiting review. That final condition is what stops
-- self-publishing and self-scheduling.
drop policy if exists articles_update_policy on public.articles;
create policy articles_update_policy on public.articles
  for update to authenticated
  using (
    public.has_permission('article.manage')
    or (
      public.has_permission('article.edit_own')
      and public.is_article_author(id)
      and status in ('draft', 'in_review')
    )
  )
  with check (
    public.has_permission('article.manage')
    or (
      public.has_permission('article.edit_own')
      and public.is_article_author(id)
      and status in ('draft', 'in_review')
    )
  );

-- DELETE -----------------------------------------------------------------------
drop policy if exists articles_delete_policy on public.articles;
create policy articles_delete_policy on public.articles
  for delete to authenticated
  using (
    public.has_permission('article.delete')
    or (
      public.has_permission('article.edit_own')
      and public.is_article_author(id)
      and status = 'draft'
    )
  );

-- Revisions ---------------------------------------------------------------------
drop policy if exists article_revisions_select on public.article_revisions;
create policy article_revisions_select on public.article_revisions
  for select to authenticated
  using (
    public.has_permission('article.manage')
    or public.has_permission('article.review')
    or public.is_article_author(article_id)
  );

-- Article join tables -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['article_category_links', 'article_tag_links', 'article_scholarships']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (
           public.has_permission(''article.manage'')
           or (
             public.has_permission(''article.edit_own'')
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
             public.has_permission(''article.edit_own'')
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

-- Authors (bylines) ---------------------------------------------------------------
-- Only those who can actually manage content may edit the byline list.
drop policy if exists authors_write_manage on public.authors;
create policy authors_write_manage on public.authors
  for all to authenticated
  using (public.has_permission('article.manage'))
  with check (public.has_permission('article.manage'));
