-- =============================================================================
-- 011_storage.sql
-- Supabase Storage buckets and access policies for the media library.
--
-- Two buckets:
--   public-media  — published assets, world-readable.
--   private-media — uploads not yet approved for public use; readable by the
--                   uploader and media managers only.
--
-- Only image MIME types are accepted. Executables, scripts and archives are
-- rejected by the bucket file_mime_types constraint below.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      "public"           = excluded."public";

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-media',
  'private-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      "public"           = excluded."public";

-- -----------------------------------------------------------------------------
-- Public bucket: readable by anyone, writable by authenticated media managers.
-- -----------------------------------------------------------------------------
drop policy if exists "public media is world readable" on storage.objects;
create policy "public media is world readable"
  on storage.objects for select
  using (bucket_id = 'public-media');

drop policy if exists "media managers upload to public bucket" on storage.objects;
create policy "media managers upload to public bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-media'
    and public.has_permission('media.upload')
  );

drop policy if exists "media managers update public bucket" on storage.objects;
create policy "media managers update public bucket"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'public-media'
    and public.has_permission('media.manage')
  )
  with check (
    bucket_id = 'public-media'
    and public.has_permission('media.manage')
  );

drop policy if exists "media managers delete from public bucket" on storage.objects;
create policy "media managers delete from public bucket"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-media'
    and public.has_permission('media.manage')
  );

-- -----------------------------------------------------------------------------
-- Private bucket: never world-readable. Uploader and managers only.
-- -----------------------------------------------------------------------------
drop policy if exists "private media readable by uploader or manager" on storage.objects;
create policy "private media readable by uploader or manager"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'private-media'
    and (
      public.has_permission('media.manage')
      or owner_id::text = auth.uid()::text
    )
  );

drop policy if exists "authenticated users upload to private bucket" on storage.objects;
create policy "authenticated users upload to private bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'private-media'
    and public.has_permission('media.upload')
    and owner_id::text = auth.uid()::text
  );

drop policy if exists "media managers update private bucket" on storage.objects;
create policy "media managers update private bucket"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'private-media'
    and public.has_permission('media.manage')
  )
  with check (
    bucket_id = 'private-media'
    and public.has_permission('media.manage')
  );

drop policy if exists "media managers delete from private bucket" on storage.objects;
create policy "media managers delete from private bucket"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'private-media'
    and public.has_permission('media.manage')
  );
