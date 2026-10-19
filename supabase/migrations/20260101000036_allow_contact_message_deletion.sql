-- Contact deletion is an explicitly authorized, audited CMS action.
grant delete on public.contact_submissions to authenticated;

drop policy if exists contact_submissions_delete_cms on public.contact_submissions;
create policy contact_submissions_delete_cms on public.contact_submissions
  for delete to authenticated
  using (public.has_permission('contact.manage'));

notify pgrst, 'reload schema';
