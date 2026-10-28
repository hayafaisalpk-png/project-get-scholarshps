-- =============================================================================
-- 044_media_public_token.sql
-- Opaque public identifier for media assets.
--
-- `public_token` is a non-guessable UUID used in public URLs (/media/<token>)
-- instead of exposing storage paths, bucket names or database ids.
-- =============================================================================

alter table public.media_assets
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists media_assets_public_token_idx
  on public.media_assets (public_token);

comment on column public.media_assets.public_token is
  'Opaque, non-guessable identifier used in public media URLs. Never the database id.';