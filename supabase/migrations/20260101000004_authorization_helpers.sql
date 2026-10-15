-- =============================================================================
-- 004_authorization_helpers.sql
-- SECURITY DEFINER functions used by RLS policies and by server-side checks.
--
-- These are SECURITY DEFINER because the policies that call them query
-- user_roles, which itself has RLS. Without SECURITY DEFINER the policy would
-- recurse indefinitely. `search_path` is pinned to defeat search-path hijacking.
--
-- Identity always comes from auth.uid(), which is derived from the JWT that the
-- server has already signature-verified. No client-supplied value is trusted.
-- =============================================================================

-- Role keys held by the current authenticated user. Empty for anonymous.
create or replace function public.current_user_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(distinct r.key::text),
    '{}'::text[]
  )
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

comment on function public.current_user_role_keys() is
  'Text array of role keys assigned to the current authenticated user.';

-- True when the caller holds the named role. Anonymous callers are always false.
create or replace function public.has_role(v_role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.roles r
    join public.user_roles ur on ur.role_id = r.id
    where r.key = v_role_key
      and ur.user_id = auth.uid()
  );
$$;

-- True when the caller holds ANY of the supplied roles.
create or replace function public.has_any_role(v_role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.roles r
    join public.user_roles ur on ur.role_id = r.id
    where r.key::text = any (v_role_keys)
      and ur.user_id = auth.uid()
  );
$$;

-- True when the caller holds the named permission, via any assigned role.
-- super_admin implicitly holds every permission.
create or replace function public.has_permission(v_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid()
          and p.key = v_permission_key
      );
$$;

comment on function public.has_permission(text) is
  'True when the current user holds the permission, or is a super_admin.';

-- True when the caller has the permission OR any of the listed roles.
-- Used for "administrators and above" style checks.
create or replace function public.can(v_permission_key text, v_role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission(v_permission_key)
      or public.has_any_role(v_role_keys);
$$;

-- The CMS management roles, in the order used by hierarchy checks.
create or replace function public.is_cms_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_any_role(
    array['super_admin', 'admin', 'editor', 'author', 'reviewer']
  );
$$;

-- Editorial staff who may publish (authors may not).
create or replace function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_any_role(array['super_admin', 'admin', 'editor']);
$$;

-- A public scholarship is one that is published and not archived.
-- Kept as a function so the rule is defined exactly once.
create or replace function public.scholarship_is_public(p_status public.scholarship_status)
returns boolean
language sql
immutable
as $$
  select p_status = 'published';
$$;

-- A public article is published AND its publication time has passed.
-- Scheduled articles are therefore invisible until they actually publish.
create or replace function public.article_is_public(
  p_status public.article_status,
  p_published_at timestamptz
)
returns boolean
language sql
stable
as $$
  select p_status = 'published'
     and p_published_at is not null
     and p_published_at <= now();
$$;

-- -----------------------------------------------------------------------------
-- Execute grants
--
-- These functions must be callable from RLS policies running as anon/authenticated,
-- but only anon/authenticated/ service_role need them. Revoke from PUBLIC.
-- -----------------------------------------------------------------------------
revoke execute on function public.current_user_role_keys() from public;
revoke execute on function public.has_role(text) from public;
revoke execute on function public.has_any_role(text[]) from public;
revoke execute on function public.has_permission(text) from public;
revoke execute on function public.can(text, text[]) from public;
revoke execute on function public.is_cms_role() from public;
revoke execute on function public.can_publish() from public;

grant execute on function public.current_user_role_keys() to anon, authenticated, service_role;
grant execute on function public.has_role(text) to anon, authenticated, service_role;
grant execute on function public.has_any_role(text[]) to anon, authenticated, service_role;
grant execute on function public.has_permission(text) to anon, authenticated, service_role;
grant execute on function public.can(text, text[]) to anon, authenticated, service_role;
grant execute on function public.is_cms_role() to anon, authenticated, service_role;
grant execute on function public.can_publish() to anon, authenticated, service_role;

-- Internal helpers: not callable by end users.
revoke execute on function public.scholarship_is_public(public.scholarship_status) from public;
revoke execute on function public.article_is_public(public.article_status, timestamptz) from public;
