-- Migration 031: allow role.manage holders to assign and revoke roles.
--
-- `user_roles` previously had only a SELECT policy (own rows or user.manage),
-- so no client could INSERT or DELETE a role assignment. Role management in the
-- CMS therefore needs the service-role client or a policy. This adds the
-- missing policies, gated on `role.manage`, so the session client can do it and
-- RLS re-checks the permission on every write.

drop policy if exists user_roles_insert_manage on public.user_roles;
create policy user_roles_insert_manage on public.user_roles
  for insert
  with check (has_permission('role.manage'::text));

drop policy if exists user_roles_delete_manage on public.user_roles;

create policy user_roles_delete_manage on public.user_roles
  for delete
  using (has_permission('role.manage'::text));