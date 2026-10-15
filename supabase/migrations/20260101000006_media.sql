-- =============================================================================
-- 006_media.sql
-- Central media library metadata. Binary objects live in Supabase Storage
-- (buckets and their policies are created in migration 011).
-- =============================================================================

create table public.media_assets (
  id             uuid primary key default gen_random_uuid(),
  -- Path within the storage bucket. Randomised on upload; the original
  -- filename is retained only as metadata so it can never influence the path.
  storage_path   text not null unique,
  public_url     text,
  -- True once the asset is confirmed to live in the public bucket.
  is_public      boolean not null default false,

  file_name      text not null,
  mime_type      text not null,
  file_size      bigint not null,
  width          integer,
  height         integer,

  alt_text       text,
  caption        text,
  attribution    text,
  credit_url     text,

  folder         text not null default 'general',
  uploaded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,

  constraint media_assets_file_name_not_blank check (char_length(btrim(file_name)) > 0),
  constraint media_assets_size_positive    check (file_size > 0),
  constraint media_assets_dimensions_valid  check (
    (width is null and height is null) or (width > 0 and height > 0)
  ),
  constraint media_assets_mime_allowed check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/svg+xml'
    )
  )
);

comment on table public.media_assets is
  'Image metadata for the media library. Only images are permitted.';

create index media_assets_mime_idx on public.media_assets (mime_type);
create index media_assets_created_idx on public.media_assets (created_at desc);
create index media_assets_folder_idx on public.media_assets (folder);

-- Filename search for the admin media browser.
create index media_assets_filename_trgm_idx
  on public.media_assets using gin (file_name extensions.gin_trgm_ops);

-- Assets used as a scholarship hero image (reverse lookup from scholarships).
create index media_assets_uploaded_by_idx on public.media_assets (uploaded_by);

select public.attach_updated_at_trigger('media_assets');
