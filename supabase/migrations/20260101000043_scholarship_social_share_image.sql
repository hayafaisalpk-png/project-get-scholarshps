-- =============================================================================
-- 043_scholarship_social_share_image.sql
-- Dedicated social-media sharing image for scholarships.
--
-- A separate, optional URL used ONLY for Open Graph / Twitter card previews.
-- It never replaces the institution logo, featured image or any on-page image.
-- =============================================================================

alter table public.scholarships
  add column if not exists social_media_share_image_url text;

comment on column public.scholarships.social_media_share_image_url is
  'Optional absolute URL used only for social media sharing previews (OG/Twitter). Does not affect on-page images.';