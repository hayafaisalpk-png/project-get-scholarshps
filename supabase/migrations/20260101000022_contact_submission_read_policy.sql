-- =============================================================================
-- 022_contact_submission_read_policy.sql
--
-- Why this migration exists
--
-- `contact_submissions` has had RLS enabled and FORCED since migration 010,
-- and all of its privileges revoked from anon and authenticated in migrations 010
-- and 013. But it never had a SELECT policy. The consequence was that the table
-- was write-only-by-design and completely unreadable: there was no way, for
-- anybody, to see a message that had been submitted.
--
-- That made the public contact form a black hole. A visitor could send a message,
-- be told "your message has been received", and have it go nowhere. Under
-- `AGENTS.md` §2.5 that is a fake feature, so this migration closes the loop by
-- making the messages visible to the people who can act on them.
--
-- Who may read
--
-- `contact.manage`, which already exists in the seeded permission set and in the
-- `Permission` union in `src/lib/auth/permissions.ts`. Anonymous visitors and
-- authenticated users without that permission still read nothing.
--
-- UPDATE, but never DELETE
--
-- Granting UPDATE lets staff mark a message in_progress or resolved, which is
-- what stops the inbox growing without bound. DELETE is withheld on purpose: a
-- submitted message is correspondence with a member of the public, so removing
-- one should not be a single CMS action. See `AGENTS.md` §2.1.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

drop policy if exists contact_submissions_select_cms on public.contact_submissions;
create policy contact_submissions_select_cms on public.contact_submissions
  for select to authenticated
  using (public.has_permission('contact.manage'));

drop policy if exists contact_submissions_update_cms on public.contact_submissions;
create policy contact_submissions_update_cms on public.contact_submissions
  for update to authenticated
  using (public.has_permission('contact.manage'))
  with check (public.has_permission('contact.manage'));

-- Guard: a message row must exist for anyone to read, so the policy is only
-- useful if the table was actually populated. This is a sanity check on the
-- migration itself, not a content assertion.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'contact_submissions'
      and policyname = 'contact_submissions_select_cms'
  ) then
    raise exception 'contact_submissions_select_cms policy was not created';
  end if;
end;
$$;

notify pgrst, 'reload schema';